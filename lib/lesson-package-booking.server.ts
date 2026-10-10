import 'server-only'
import { createHash } from 'node:crypto'
import type { Firestore } from 'firebase-admin/firestore'
import { collections } from '@/lib/firebase'
import { BOOKING_WINDOW_DAYS, getAvailabilityHoursForWeekday } from '@/lib/availability'
import { buildWeeklyLessonOccurrences, LESSON_BUFFER_MINUTES, minutesToTime, slotOverlapsBookedLesson, timeToMinutes } from '@/lib/lesson-time'
import { packageSubjectKey, reservePackageCredits, validatePackageForBooking } from '@/lib/lesson-packages-core'
import { runbeeAppUrl, sendProductNotificationEmail } from '@/lib/email/product-notifications.server'
import type { BookedLessonSlot, Lesson, LessonPackage, WeekdayCode } from '@/lib/types'

const MAX_PACKAGE_BOOKING_OCCURRENCES = 10

export function normalizePackageBookingOccurrenceCount(value: unknown): number | null {
  if (value === undefined || value === null) return 1
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 1 || value > MAX_PACKAGE_BOOKING_OCCURRENCES) return null
  return value
}

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

export function packageBookingRequestDocId(input: { packageId: string; bookingRequestId: string }): string {
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

export type PackageCreditBookingResult =
  | { ok: true; lessonIds: string[]; recurringSeriesId?: string; deduped: boolean }
  | { ok: false; status: number; error: string; code?: 'slot_conflict' | 'invalid_request' | 'package_unavailable' }

export async function bookLessonWithPackageCreditServer(input: {
  database: Firestore
  packageId: string
  teacherId: string
  dateIso: string
  time: string
  duration: number
  topic: string
  subjectCategoryId?: string
  specialty?: string
  studentId: string
  studentName: string
  occurrenceCount?: number
  bookingRequestId?: string
}): Promise<PackageCreditBookingResult> {
  const occurrenceCount = normalizePackageBookingOccurrenceCount(input.occurrenceCount)
  if (occurrenceCount === null) return { ok: false, status: 400, error: 'Nieprawidłowa liczba spotkań.', code: 'invalid_request' }
  if (!input.packageId || !input.teacherId || !input.dateIso || !input.time || !input.duration || !input.topic.trim() || !input.studentId || !input.studentName) {
    return { ok: false, status: 400, error: 'Brak wymaganych danych rezerwacji.', code: 'invalid_request' }
  }
  if (occurrenceCount > 1 && !input.bookingRequestId) {
    return { ok: false, status: 400, error: 'Brak identyfikatora żądania rezerwacji cyklicznej.', code: 'invalid_request' }
  }

  const teacherSnap = await input.database.collection(collections.teachers).doc(input.teacherId).get()
  const teacher = teacherSnap.data() as { status?: string; availability?: string[]; availabilityStart?: string; availabilityEnd?: string; availabilityHours?: Record<string, { start: string; end: string }> } | undefined
  if (!teacher || (teacher.status && teacher.status !== 'approved')) {
    return { ok: false, status: 404, error: 'Nie znaleziono tego nauczyciela.', code: 'invalid_request' }
  }

  const occurrences = buildWeeklyLessonOccurrences({ firstDateIso: input.dateIso, time: input.time, count: occurrenceCount })
  if (!occurrences) return { ok: false, status: 400, error: 'Nieprawidłowy termin lekcji.', code: 'invalid_request' }

  const requestedStart = timeToMinutes(input.time)
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
      requestedStart + input.duration > availabilityEnd
    ) {
      return {
        ok: false,
        status: 409,
        error: `Termin ${occurrence.date} o ${occurrence.time} nie mieści się już w dostępności nauczyciela.`,
        code: 'slot_conflict',
      }
    }
  }

  const selectedSubjectKey = packageSubjectKey({ subjectCategoryId: input.subjectCategoryId, specialty: input.specialty })
  if (!selectedSubjectKey) return { ok: false, status: 400, error: 'Wybierz przedmiot lekcji.', code: 'invalid_request' }

  const packageRef = input.database.collection(collections.lessonPackages).doc(input.packageId)
  const lessonRefs = occurrences.map(() => input.database.collection(collections.lessons).doc())
  const lockIdsByOccurrence = occurrences.map((occurrence) => slotLockIds(input.teacherId, occurrence.dateIso, occurrence.time, input.duration))
  const recurringSeriesId = occurrenceCount > 1 && input.bookingRequestId
    ? `pkgseries_${packageBookingRequestDocId({ packageId: input.packageId, bookingRequestId: input.bookingRequestId }).slice(0, 24)}`
    : undefined
  const requestRef = input.bookingRequestId
    ? input.database.collection(collections.lessonPackageBookingRequests).doc(packageBookingRequestDocId({ packageId: input.packageId, bookingRequestId: input.bookingRequestId }))
    : null
  const requestFingerprint = input.bookingRequestId
    ? bookingFingerprint({
        packageId: input.packageId,
        teacherId: input.teacherId,
        studentId: input.studentId,
        subjectKey: selectedSubjectKey,
        duration: input.duration,
        firstDateIso: input.dateIso,
        time: input.time,
        occurrenceCount,
        topic: input.topic.trim(),
      })
    : null
  const now = Date.now()

  let creditInfo: { payerId: string; remaining: number } | null = null
  const result = await input.database.runTransaction(async (tx): Promise<PackageCreditBookingResult> => {
    if (requestRef && requestFingerprint) {
      const requestSnap = await tx.get(requestRef)
      if (requestSnap.exists) {
        const existing = requestSnap.data() as { fingerprint?: string; lessonIds?: string[]; recurringSeriesId?: string }
        if (existing.fingerprint !== requestFingerprint || !Array.isArray(existing.lessonIds) || existing.lessonIds.length === 0) {
          return { ok: false, status: 409, error: 'Ten identyfikator rezerwacji został już użyty dla innego żądania.', code: 'invalid_request' }
        }
        return { ok: true, lessonIds: existing.lessonIds, recurringSeriesId: existing.recurringSeriesId, deduped: true }
      }
    }

    const packageSnap = await tx.get(packageRef)
    if (!packageSnap.exists) return { ok: false, status: 404, error: 'Nie znaleziono pakietu.', code: 'package_unavailable' }
    const pkg = { id: packageSnap.id, ...packageSnap.data() } as LessonPackage
    const packageError = validatePackageForBooking(pkg, {
      teacherId: input.teacherId,
      studentId: input.studentId,
      subjectKey: selectedSubjectKey,
      duration: input.duration,
    })
    if (packageError) return { ok: false, status: 409, error: validationMessage(packageError), code: 'package_unavailable' }
    if (pkg.remainingCredits < occurrenceCount) {
      return { ok: false, status: 409, error: 'Ten pakiet nie ma wystarczającej liczby dostępnych lekcji.', code: 'package_unavailable' }
    }

    const lockRefs = lockIdsByOccurrence.flatMap((ids) => ids.map((id) => input.database.collection(collections.lessonSlotLocks).doc(id)))
    const lockSnaps = await Promise.all(lockRefs.map((lockRef) => tx.get(lockRef)))
    for (const [lockIndex, lockSnap] of lockSnaps.entries()) {
      if (!lockSnap.exists) continue
      const occurrenceIndex = lockIdsByOccurrence.findIndex((ids) => ids.includes(lockRefs[lockIndex].id))
      const occurrence = occurrences[occurrenceIndex] ?? occurrences[0]
      const lockedLessonId = lockSnap.data()?.lessonId
      if (typeof lockedLessonId !== 'string') {
        return { ok: false, status: 409, error: `Termin ${occurrence.date} o ${occurrence.time} jest już zajęty. Wybierz inną godzinę.`, code: 'slot_conflict' }
      }
      const lockedLessonSnap = await tx.get(input.database.collection(collections.lessons).doc(lockedLessonId))
      if (!lockedLessonSnap.exists) continue
      const lockedLesson = { id: lockedLessonSnap.id, ...lockedLessonSnap.data() } as BookedLessonSlot
      if (slotOverlapsBookedLesson({ dateIso: occurrence.dateIso, time: occurrence.time, duration: input.duration, booked: [lockedLesson] })) {
        return { ok: false, status: 409, error: `Termin ${occurrence.date} o ${occurrence.time} jest już zajęty. Wybierz inną godzinę.`, code: 'slot_conflict' }
      }
    }

    const nextPackage = reservePackageCredits(pkg, occurrenceCount)
    creditInfo = { payerId: (typeof pkg.payerId === 'string' && pkg.payerId) || input.studentId, remaining: nextPackage.remainingCredits }
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
        ...(input.subjectCategoryId ? { subjectCategoryId: input.subjectCategoryId } : {}),
        specialty: input.specialty ?? pkg.specialty,
        date: occurrence.date,
        dateIso: occurrence.dateIso,
        time: occurrence.time,
        scheduledStartAt: occurrence.scheduledStartAt,
        duration: input.duration,
        lessonKind: 'regular',
        paymentSource: 'package',
        packageId: pkg.id,
        packageCreditState: 'reserved',
        ...(recurringSeriesId ? { recurringSeriesId } : {}),
        status: 'pending',
        price: pkg.perLessonGrossGrosze / 100,
        topic: input.topic.trim(),
        createdAt: now,
        payerId: pkg.payerId,
        payerRole: pkg.payerRole,
        paymentStatus: 'paid',
        priceGrosze: pkg.perLessonGrossGrosze,
        subtotalGrosze: pkg.perLessonGrossGrosze,
        studentServiceFeeGrosze: 0,
        studentTotalGrosze: pkg.perLessonGrossGrosze,
        commissionPercent: pkg.effectiveCommissionPercent,
        effectiveCommissionPercent: pkg.effectiveCommissionPercent,
        commissionSource: pkg.commissionSource,
        platformFeeGrosze: pkg.platformFeePerLessonGrosze,
        teacherAmountGrosze: pkg.teacherAmountPerLessonGrosze,
        livemode: pkg.livemode,
      }

      tx.set(lessonRef, lesson)
      for (const lockId of lockIdsByOccurrence[index]) {
        tx.set(input.database.collection(collections.lessonSlotLocks).doc(lockId), {
          teacherId: input.teacherId,
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
        packageId: input.packageId,
        teacherId: input.teacherId,
        studentId: input.studentId,
        subjectKey: selectedSubjectKey,
        duration: input.duration,
        firstDateIso: input.dateIso,
        time: input.time,
        occurrenceCount,
        fingerprint: requestFingerprint,
        lessonIds: lessonRefs.map((ref) => ref.id),
        ...(recurringSeriesId ? { recurringSeriesId } : {}),
        createdAt: now,
      })
    }
    return { ok: true, lessonIds: lessonRefs.map((ref) => ref.id), recurringSeriesId, deduped: false }
  })

  if (result.ok && !result.deduped) {
    await input.database.collection(collections.notifications).add({
      userId: input.teacherId,
      type: 'lesson',
      title: occurrenceCount > 1 ? 'Nowa seria rezerwacji z pakietu' : 'Nowa rezerwacja z pakietu',
      description: occurrenceCount > 1
        ? `${input.studentName} użył(a) ${occurrenceCount} lekcji z pakietu na „${input.topic.trim()}" — co tydzień od ${occurrences[0].date} o ${input.time}. Potwierdź lub odrzuć lekcje w panelu.`
        : `${input.studentName} użył(a) lekcji z pakietu na „${input.topic.trim()}" — ${occurrences[0].date} o ${input.time}. Potwierdź lub odrzuć w panelu.`,
      date: new Date(now).toLocaleDateString('pl-PL', { day: 'numeric', month: 'short', year: 'numeric' }),
      read: false,
      createdAt: now,
    })
    await sendProductNotificationEmail({
      eventId: `lesson-package-booking:${result.lessonIds.join(',')}:teacher`,
      recipientUid: input.teacherId,
      type: 'lessons.bookingCreated',
      subject: occurrenceCount > 1 ? 'Nowa seria rezerwacji z pakietu' : 'Nowa rezerwacja z pakietu',
      title: occurrenceCount > 1 ? 'Masz nową serię rezerwacji' : 'Masz nową rezerwację',
      preheader: `${input.studentName} użył(a) lekcji z pakietu.`,
      body: occurrenceCount > 1
        ? `${input.studentName} użył(a) ${occurrenceCount} lekcji z pakietu. Potwierdź albo odrzuć lekcje w panelu nauczyciela.`
        : `${input.studentName} użył(a) lekcji z pakietu. Potwierdź albo odrzuć rezerwację w panelu nauczyciela.`,
      details: [
        { label: 'Uczeń', value: input.studentName },
        { label: 'Termin', value: `${occurrences[0].date} ${input.time}` },
        { label: 'Temat', value: input.topic.trim() },
      ],
      cta: { label: 'Otwórz panel lekcji', href: runbeeAppUrl('/dashboard') },
    })
    // Payer/student confirmation of the credit use (the teacher mail above is the other side).
    const credit = creditInfo as { payerId: string; remaining: number } | null
    if (credit) {
      await sendProductNotificationEmail({
        eventId: `lesson-package-booking:${result.lessonIds.join(',')}:payer`,
        recipientUid: credit.payerId,
        type: 'lessons.bookingCreated',
        subject: 'Lekcja z pakietu zarezerwowana',
        title: 'Zarezerwowano lekcję z pakietu',
        preheader: 'Wykorzystaliśmy kredyt z Twojego pakietu lekcji.',
        body: `${occurrenceCount > 1 ? `Zarezerwowano ${occurrenceCount} lekcje` : 'Zarezerwowano lekcję'} z pakietu — czekają na potwierdzenie nauczyciela. Po rezerwacji w pakiecie zostało ${credit.remaining} ${credit.remaining === 1 ? 'lekcja' : 'lekcji'}.${credit.remaining === 1 ? ' To Twoja ostatnia lekcja z tego pakietu.' : ''} Jeśli nauczyciel odrzuci termin, kredyt wróci do pakietu.`,
        details: [
          { label: 'Termin', value: `${occurrences[0].date} ${input.time}` },
          { label: 'Temat', value: input.topic.trim() },
          { label: 'Pozostało w pakiecie', value: String(credit.remaining) },
        ],
        cta: { label: 'Otwórz panel lekcji', href: runbeeAppUrl('/dashboard') },
      })
    }
  }

  return result
}
