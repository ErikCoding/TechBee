import { NextResponse } from 'next/server'
import { createHash } from 'node:crypto'
import { adminDb, isAdminConfigured } from '@/lib/firebase-admin'
import { verifyCaller } from '@/lib/stripe-server-auth'
import { collections } from '@/lib/firebase'
import { BOOKING_WINDOW_DAYS, getAvailabilityHoursForWeekday } from '@/lib/availability'
import { buildWeeklyLessonOccurrences, LESSON_BUFFER_MINUTES, minutesToTime, slotOverlapsBookedLesson, timeToMinutes } from '@/lib/lesson-time'
import { normalizePackageCreditLessonKind, packageSubjectKey, reservePackageCredits, validatePackageForBooking } from '@/lib/lesson-packages-core'
import type { BookedLessonSlot, Lesson, LessonPackage, WeekdayCode } from '@/lib/types'

export const runtime = 'nodejs'

interface PackageBookingRequestBody {
  idToken?: string
  packageId?: string
  teacherId?: string
  date?: string
  dateIso?: string
  time?: string
  duration?: number
  topic?: string
  subjectCategoryId?: string
  specialty?: string
  studentId?: string
  studentName?: string
  lessonKind?: string
  occurrenceCount?: number
  bookingRequestId?: string
}

const MAX_PACKAGE_BOOKING_OCCURRENCES = 10

function slotLockIds(teacherId: string, dateIso: string, time: string, duration: number): string[] {
  const start = timeToMinutes(time)
  if (start === null) return []
  const ids: string[] = []
  for (let m = start; m < start + duration + LESSON_BUFFER_MINUTES; m += 15) {
    ids.push(`${teacherId}__${dateIso}__${minutesToTime(m).replace(':', '-')}`)
  }
  return ids
}

function validationMessage(error: ReturnType<typeof validatePackageForBooking>): string {
  switch (error) {
    case 'package_not_active':
      return 'Ten pakiet nie jest aktywny.'
    case 'ownership_mismatch':
      return 'Ten pakiet należy do innego ucznia.'
    case 'teacher_mismatch':
      return 'Ten pakiet dotyczy innego nauczyciela.'
    case 'subject_mismatch':
      return 'Ten pakiet dotyczy innego przedmiotu.'
    case 'duration_mismatch':
      return 'Ten pakiet dotyczy innej długości lekcji.'
    case 'no_credits':
      return 'Ten pakiet nie ma dostępnych lekcji.'
    default:
      return 'Pakiet nie pasuje do tej rezerwacji.'
  }
}

function normalizeOccurrenceCount(value: unknown): number | null {
  if (value === undefined || value === null) return 1
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 1 || value > MAX_PACKAGE_BOOKING_OCCURRENCES) return null
  return value
}

function bookingRequestDocId(input: { packageId: string; bookingRequestId: string }): string {
  return createHash('sha256')
    .update(`${input.packageId}:${input.bookingRequestId}`)
    .digest('hex')
}

function bookingFingerprint(input: {
  packageId: string
  teacherId: string
  studentId: string
  subjectKey: string
  duration: number
  firstDateIso: string
  time: string
  occurrenceCount: number
  topic: string
}): string {
  return createHash('sha256')
    .update(JSON.stringify(input))
    .digest('hex')
}

export async function POST(request: Request) {
  if (!isAdminConfigured || !adminDb) {
    return NextResponse.json({ error: 'Zaufane zapisy Firestore nie są skonfigurowane.' }, { status: 503 })
  }
  const database = adminDb

  let body: PackageBookingRequestBody
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Nieprawidłowe żądanie.' }, { status: 400 })
  }

  if (!normalizePackageCreditLessonKind(body.lessonKind)) {
    return NextResponse.json({ error: 'Pakietem można rezerwować wyłącznie standardowe lekcje.' }, { status: 400 })
  }

  const { packageId, teacherId, dateIso, time, duration, topic, subjectCategoryId, specialty, studentId, studentName, bookingRequestId } = body
  const occurrenceCount = normalizeOccurrenceCount(body.occurrenceCount)
  if (occurrenceCount === null) {
    return NextResponse.json({ error: 'Nieprawidłowa liczba spotkań.' }, { status: 400 })
  }
  if (!packageId || !teacherId || !dateIso || !time || !duration || !topic?.trim() || !studentId || !studentName) {
    return NextResponse.json({ error: 'Brak wymaganych danych rezerwacji.' }, { status: 400 })
  }
  if (occurrenceCount > 1 && !bookingRequestId) {
    return NextResponse.json({ error: 'Brak identyfikatora żądania rezerwacji cyklicznej.' }, { status: 400 })
  }

  const uid = await verifyCaller(body.idToken)
  if (!uid) return NextResponse.json({ error: 'Musisz być zalogowany.' }, { status: 401 })

  const [studentSnap, teacherSnap] = await Promise.all([
    database.collection(collections.users).doc(studentId).get(),
    database.collection(collections.teachers).doc(teacherId).get(),
  ])
  const studentProfile = studentSnap.data() as { role?: string; linkedParentIds?: string[] } | undefined
  if (!studentProfile || studentProfile.role !== 'student') {
    return NextResponse.json({ error: 'Nie znaleziono konta ucznia.' }, { status: 404 })
  }
  if (uid !== studentId && !studentProfile.linkedParentIds?.includes(uid)) {
    return NextResponse.json({ error: 'Nie możesz użyć pakietu tego ucznia.' }, { status: 403 })
  }

  const teacher = teacherSnap.data() as { status?: string; availability?: string[]; availabilityStart?: string; availabilityEnd?: string; availabilityHours?: Record<string, { start: string; end: string }> } | undefined
  if (!teacher || (teacher.status && teacher.status !== 'approved')) {
    return NextResponse.json({ error: 'Nie znaleziono tego nauczyciela.' }, { status: 404 })
  }

  const occurrences = buildWeeklyLessonOccurrences({ firstDateIso: dateIso, time, count: occurrenceCount })
  if (!occurrences) {
    return NextResponse.json({ error: 'Nieprawidłowy termin lekcji.' }, { status: 400 })
  }

  const requestedStart = timeToMinutes(time)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const latestDate = new Date(today)
  latestDate.setDate(today.getDate() + BOOKING_WINDOW_DAYS)
  const teacherAvailability = teacher.availability ?? []
  for (const [index, occurrence] of occurrences.entries()) {
    const requestedDate = new Date(`${occurrence.dateIso}T12:00:00`)
    const weekdayCode = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][requestedDate.getDay()] as WeekdayCode
    const dayHours = getAvailabilityHoursForWeekday(
      weekdayCode,
      { start: teacher.availabilityStart ?? '09:00', end: teacher.availabilityEnd ?? '17:00' },
      teacher.availabilityHours,
    )
    const availabilityStart = timeToMinutes(dayHours.start)
    const availabilityEnd = timeToMinutes(dayHours.end)
    if (
      requestedStart === null ||
      availabilityStart === null ||
      availabilityEnd === null ||
      Number.isNaN(requestedDate.getTime()) ||
      requestedDate <= today ||
      (index === 0 && requestedDate > latestDate) ||
      !teacherAvailability.includes(weekdayCode) ||
      requestedStart < availabilityStart ||
      requestedStart + duration > availabilityEnd
    ) {
      return NextResponse.json({ error: `Termin ${occurrence.date} o ${occurrence.time} nie mieści się już w dostępności nauczyciela.` }, { status: 409 })
    }
  }

  const selectedSubjectKey = packageSubjectKey({ subjectCategoryId, specialty })
  if (!selectedSubjectKey) return NextResponse.json({ error: 'Wybierz przedmiot lekcji.' }, { status: 400 })

  const packageRef = database.collection(collections.lessonPackages).doc(packageId)
  const lessonRefs = occurrences.map(() => database.collection(collections.lessons).doc())
  const lockIdsByOccurrence = occurrences.map((occurrence) => slotLockIds(teacherId, occurrence.dateIso, occurrence.time, duration))
  const recurringSeriesId = occurrenceCount > 1 && bookingRequestId
    ? `pkgseries_${bookingRequestDocId({ packageId, bookingRequestId }).slice(0, 24)}`
    : undefined
  const requestRef = bookingRequestId
    ? database.collection(collections.lessonPackageBookingRequests).doc(bookingRequestDocId({ packageId, bookingRequestId }))
    : null
  const requestFingerprint = bookingRequestId
    ? bookingFingerprint({
        packageId,
        teacherId,
        studentId,
        subjectKey: selectedSubjectKey,
        duration,
        firstDateIso: dateIso,
        time,
        occurrenceCount,
        topic: topic.trim(),
      })
    : null
  const now = Date.now()

  const result = await database.runTransaction(async (tx): Promise<{ ok: true; lessonIds: string[]; recurringSeriesId?: string; deduped: boolean } | { ok: false; status: number; error: string }> => {
    if (requestRef && requestFingerprint) {
      const requestSnap = await tx.get(requestRef)
      if (requestSnap.exists) {
        const existing = requestSnap.data() as { fingerprint?: string; lessonIds?: string[]; recurringSeriesId?: string }
        if (existing.fingerprint !== requestFingerprint || !Array.isArray(existing.lessonIds) || existing.lessonIds.length === 0) {
          return { ok: false, status: 409, error: 'Ten identyfikator rezerwacji został już użyty dla innego żądania.' }
        }
        return { ok: true, lessonIds: existing.lessonIds, recurringSeriesId: existing.recurringSeriesId, deduped: true }
      }
    }

    const packageSnap = await tx.get(packageRef)
    if (!packageSnap.exists) return { ok: false, status: 404, error: 'Nie znaleziono pakietu.' }
    const pkg = { id: packageSnap.id, ...packageSnap.data() } as LessonPackage
    const packageError = validatePackageForBooking(pkg, {
      teacherId,
      studentId,
      subjectKey: selectedSubjectKey,
      duration,
    })
    if (packageError) return { ok: false, status: 409, error: validationMessage(packageError) }
    if (pkg.remainingCredits < occurrenceCount) {
      return { ok: false, status: 409, error: 'Ten pakiet nie ma wystarczającej liczby dostępnych lekcji.' }
    }

    const lockRefs = lockIdsByOccurrence.flatMap((ids) => ids.map((id) => database.collection(collections.lessonSlotLocks).doc(id)))
    const lockSnaps = await Promise.all(lockRefs.map((lockRef) => tx.get(lockRef)))
    for (const [lockIndex, lockSnap] of lockSnaps.entries()) {
      if (!lockSnap.exists) continue
      const occurrenceIndex = lockIdsByOccurrence.findIndex((ids) => ids.includes(lockRefs[lockIndex].id))
      const occurrence = occurrences[occurrenceIndex] ?? occurrences[0]
      const lockedLessonId = lockSnap.data()?.lessonId
      if (typeof lockedLessonId !== 'string') return { ok: false, status: 409, error: `Termin ${occurrence.date} o ${occurrence.time} jest już zajęty. Wybierz inną godzinę.` }
      const lockedLessonSnap = await tx.get(database.collection(collections.lessons).doc(lockedLessonId))
      if (!lockedLessonSnap.exists) continue
      const lockedLesson = { id: lockedLessonSnap.id, ...lockedLessonSnap.data() } as BookedLessonSlot
      if (slotOverlapsBookedLesson({ dateIso: occurrence.dateIso, time: occurrence.time, duration, booked: [lockedLesson] })) {
        return { ok: false, status: 409, error: `Termin ${occurrence.date} o ${occurrence.time} jest już zajęty. Wybierz inną godzinę.` }
      }
    }

    const nextPackage = reservePackageCredits(pkg, occurrenceCount)

    tx.update(packageRef, {
      remainingCredits: nextPackage.remainingCredits,
      reservedCredits: nextPackage.reservedCredits,
      usedCredits: nextPackage.usedCredits,
      status: nextPackage.status,
      updatedAt: now,
    })

    for (const [index, occurrence] of occurrences.entries()) {
      const lessonRef = lessonRefs[index]
      const lesson: Omit<Lesson, 'id'> = {
        teacherId: pkg.teacherId,
        studentId: pkg.studentId,
        teacherName: pkg.teacherName,
        studentName: pkg.studentName,
        teacherInitials: pkg.teacherInitials,
        teacherColor: pkg.teacherColor,
        ...(pkg.teacherPhotoUrl ? { teacherPhotoUrl: pkg.teacherPhotoUrl } : {}),
        ...(subjectCategoryId ? { subjectCategoryId } : {}),
        specialty: specialty ?? pkg.specialty,
        date: occurrence.date,
        dateIso: occurrence.dateIso,
        time: occurrence.time,
        scheduledStartAt: occurrence.scheduledStartAt,
        duration,
        lessonKind: 'regular',
        paymentSource: 'package',
        packageId: pkg.id,
        packageCreditState: 'reserved',
        ...(recurringSeriesId ? { recurringSeriesId } : {}),
        status: 'pending',
        price: pkg.perLessonGrossGrosze / 100,
        topic: topic.trim(),
        createdAt: now,
        payerId: pkg.payerId,
        payerRole: pkg.payerRole,
        paymentStatus: 'paid',
        priceGrosze: pkg.perLessonGrossGrosze,
        commissionPercent: pkg.effectiveCommissionPercent,
        effectiveCommissionPercent: pkg.effectiveCommissionPercent,
        commissionSource: pkg.commissionSource,
        platformFeeGrosze: pkg.platformFeePerLessonGrosze,
        teacherAmountGrosze: pkg.teacherAmountPerLessonGrosze,
        livemode: pkg.livemode,
      }

      tx.set(lessonRef, lesson)
      for (const lockId of lockIdsByOccurrence[index]) {
        tx.set(database.collection(collections.lessonSlotLocks).doc(lockId), {
          teacherId,
          dateIso: occurrence.dateIso,
          time: occurrence.time,
          lessonId: lessonRef.id,
          packageId: pkg.id,
          ...(recurringSeriesId ? { recurringSeriesId } : {}),
          createdAt: now,
        })
      }
    }

    if (requestRef && requestFingerprint) {
      tx.set(requestRef, {
        packageId,
        teacherId,
        studentId,
        subjectKey: selectedSubjectKey,
        duration,
        firstDateIso: dateIso,
        time,
        occurrenceCount,
        fingerprint: requestFingerprint,
        lessonIds: lessonRefs.map((ref) => ref.id),
        ...(recurringSeriesId ? { recurringSeriesId } : {}),
        createdAt: now,
      })
    }
    return { ok: true, lessonIds: lessonRefs.map((ref) => ref.id), recurringSeriesId, deduped: false }
  })

  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status })

  if (!result.deduped) {
    await database.collection(collections.notifications).add({
      userId: teacherId,
      type: 'lesson',
      title: occurrenceCount > 1 ? 'Nowa seria rezerwacji z pakietu' : 'Nowa rezerwacja z pakietu',
      description: occurrenceCount > 1
        ? `${studentName} użył(a) ${occurrenceCount} lekcji z pakietu na „${topic.trim()}" — co tydzień od ${occurrences[0].date} o ${time}. Potwierdź lub odrzuć lekcje w panelu.`
        : `${studentName} użył(a) lekcji z pakietu na „${topic.trim()}" — ${occurrences[0].date} o ${time}. Potwierdź lub odrzuć w panelu.`,
      date: new Date(now).toLocaleDateString('pl-PL', { day: 'numeric', month: 'short', year: 'numeric' }),
      read: false,
      createdAt: now,
    })
  }

  return NextResponse.json({ lessonId: result.lessonIds[0], lessonIds: result.lessonIds, recurringSeriesId: result.recurringSeriesId })
}
