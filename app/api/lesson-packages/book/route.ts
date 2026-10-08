import { NextResponse } from 'next/server'
import { adminDb, isAdminConfigured } from '@/lib/firebase-admin'
import { verifyCaller } from '@/lib/stripe-server-auth'
import { collections } from '@/lib/firebase'
import { normalizePackageCreditLessonKind } from '@/lib/lesson-packages-core'
import { lockLessonPackageIfStripeRefundExists } from '@/lib/stripe-package-refund-sync.server'
import { bookLessonWithPackageCreditServer, normalizePackageBookingOccurrenceCount } from '@/lib/lesson-package-booking.server'
import type { LessonPackage } from '@/lib/types'

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
  const occurrenceCount = normalizePackageBookingOccurrenceCount(body.occurrenceCount)
  if (occurrenceCount === null) {
    return NextResponse.json({ error: 'Nieprawidłowa liczba spotkań.' }, { status: 400 })
  }
  if (!packageId || !teacherId || !dateIso || !time || !duration || !topic?.trim() || !studentId || !studentName) {
    return NextResponse.json({ error: 'Brak wymaganych danych rezerwacji.' }, { status: 400 })
  }

  const uid = await verifyCaller(body.idToken)
  if (!uid) return NextResponse.json({ error: 'Musisz być zalogowany.' }, { status: 401 })

  const studentSnap = await database.collection(collections.users).doc(studentId).get()
  const studentProfile = studentSnap.data() as { role?: string; linkedParentIds?: string[] } | undefined
  if (!studentProfile || studentProfile.role !== 'student') {
    return NextResponse.json({ error: 'Nie znaleziono konta ucznia.' }, { status: 404 })
  }
  if (uid !== studentId && !studentProfile.linkedParentIds?.includes(uid)) {
    return NextResponse.json({ error: 'Nie możesz użyć pakietu tego ucznia.' }, { status: 403 })
  }

  try {
    const packageRef = database.collection(collections.lessonPackages).doc(packageId)
    const packagePreflightSnap = await packageRef.get()
    if (packagePreflightSnap.exists) {
      const preflightPackage = { id: packagePreflightSnap.id, ...packagePreflightSnap.data() } as LessonPackage & { id: string }
      const lockedByRefund = await lockLessonPackageIfStripeRefundExists({ database, pkg: preflightPackage })
      if (lockedByRefund) {
        return NextResponse.json({ error: 'Ten pakiet wymaga obsługi przez administratora po zwrocie płatności.' }, { status: 409 })
      }
    }
  } catch (error) {
    console.error('[lesson-packages/book] Failed to verify package refund status:', error)
    return NextResponse.json({ error: 'Nie udało się zweryfikować statusu płatności pakietu. Spróbuj ponownie.' }, { status: 503 })
  }

  const result = await bookLessonWithPackageCreditServer({
    database,
    packageId,
    teacherId,
    dateIso,
    time,
    duration,
    topic,
    subjectCategoryId,
    specialty,
    studentId,
    studentName,
    occurrenceCount,
    bookingRequestId,
  })

  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status })
  return NextResponse.json({ lessonId: result.lessonIds[0], lessonIds: result.lessonIds, recurringSeriesId: result.recurringSeriesId })
}
