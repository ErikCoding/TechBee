import { NextResponse } from 'next/server'
import { stripe } from '@/lib/stripe'
import { adminDb } from '@/lib/firebase-admin'
import { requireStripeBackend, verifyCaller } from '@/lib/stripe-server-auth'
import { getOrigin } from '@/lib/request-origin'
import { splitPayment, toGrosze, STRIPE_CURRENCY } from '@/lib/stripe-config'
import { getPlatformPaymentSettings } from '@/lib/platform-payment-settings'
import { collections } from '@/lib/firebase'
import { categoriesData } from '@/data/categories.data'
import { getTeacherCategoryIds, getTeacherCustomSubjects } from '@/lib/teacher-categories'
import { BOOKING_WINDOW_DAYS } from '@/lib/availability'
import { LESSON_BUFFER_MINUTES, slotOverlapsBookedLesson, timeToMinutes } from '@/lib/lesson-time'
import type { BookedLessonSlot } from '@/lib/types'

// ─────────────────────────────────────────────────────────────
// Starts payment for a specific lesson slot. A Lesson doc is
// deliberately NOT created here — see app/api/stripe/webhook/route.ts:
// the lesson only comes into existence once Stripe confirms the
// payment actually succeeded (checkout.session.completed), so there's
// no way for an unpaid booking to ever exist, and no `/payment/success`
// redirect can fake one either.
//
// The price is never trusted from the client: it's recomputed here
// from the teacher's real hourlyRate (read via the trusted admin
// connection, not the request body) × the requested duration — the
// only two numbers a client can influence (duration) are restricted
// to the same two options the booking UI offers (60/90 min).
// ─────────────────────────────────────────────────────────────

const ALLOWED_DURATIONS = [60, 90]

// Stripe metadata values are capped at 500 characters each. Most fields
// here are short user-entered strings and never came close, but teacher
// photos can be a problem: Firebase Storage isn't enabled everywhere yet
// (see .env.example — NEXT_PUBLIC_ENABLE_FIREBASE_STORAGE), so some
// teachers have their photo stored as an inline base64 `data:image/...`
// URI directly in Firestore instead of a short hosted URL — tens of
// thousands of characters, which made every checkout for that teacher
// fail with a 500 (`checkout.sessions.create` throwing "Metadata values
// can have up to 500 characters..."). Truncating a data: URI would just
// produce broken/corrupted image data, so it's dropped entirely instead:
// the resulting Lesson doc simply won't have a cached teacherPhotoUrl,
// and every place that renders it already falls back to the initials
// avatar (see components/ui/avatar.tsx AvatarFallback usage throughout).
const METADATA_MAX_LENGTH = 480

function safeMetaText(value: string): string {
  return value.length > METADATA_MAX_LENGTH ? value.slice(0, METADATA_MAX_LENGTH) : value
}

function safeMetaPhotoUrl(url: string | undefined): string {
  if (!url || url.length > METADATA_MAX_LENGTH) return ''
  return url
}

interface CheckoutRequestBody {
  idToken?: string
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
  payer?: { id: string; role: 'student' | 'parent' }
}

export async function POST(request: Request) {
  const backendError = requireStripeBackend()
  if (backendError) return backendError

  let body: CheckoutRequestBody
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Nieprawidłowe żądanie.' }, { status: 400 })
  }

  const { teacherId, date, dateIso, time, duration, topic, subjectCategoryId, specialty, studentId, studentName, payer } = body
  if (!teacherId || !date || !dateIso || !time || !duration || !topic?.trim() || !studentId || !studentName) {
    return NextResponse.json({ error: 'Brak wymaganych danych rezerwacji.' }, { status: 400 })
  }
  if (!ALLOWED_DURATIONS.includes(duration)) {
    return NextResponse.json({ error: 'Nieprawidłowa długość lekcji.' }, { status: 400 })
  }

  const uid = await verifyCaller(body.idToken)
  if (!uid) return NextResponse.json({ error: 'Musisz być zalogowany.' }, { status: 401 })

  // The caller must be either the student themselves, or the linked
  // parent paying on their behalf — never anyone else.
  const payerId = payer?.id ?? studentId
  const payerRole = payer?.role ?? 'student'
  if (uid !== payerId) {
    return NextResponse.json({ error: 'Nie możesz opłacić rezerwacji w imieniu innej osoby.' }, { status: 403 })
  }

  const teacherSnap = await adminDb!.collection(collections.teachers).doc(teacherId).get()
  const teacher = teacherSnap.data() as
    | { name?: string; initials?: string; avatarColor?: string; photoUrl?: string; specialty?: string; categoryId?: string; categoryIds?: string[]; customSubjects?: string[]; hourlyRate?: number; status?: string; availability?: string[]; availabilityStart?: string; availabilityEnd?: string }
    | undefined
  if (!teacher || !teacher.hourlyRate || (teacher.status && teacher.status !== 'approved')) {
    return NextResponse.json({ error: 'Nie znaleziono tego nauczyciela.' }, { status: 404 })
  }
  const teacherCategoryIds = getTeacherCategoryIds({
    categoryId: teacher.categoryId ?? '',
    categoryIds: teacher.categoryIds,
  })
  if (subjectCategoryId && !teacherCategoryIds.includes(subjectCategoryId)) {
    return NextResponse.json({ error: 'Ten nauczyciel nie prowadzi lekcji z wybranego przedmiotu.' }, { status: 409 })
  }
  const requestedCustomSubject = specialty?.trim()
  const customSubject = requestedCustomSubject
    ? getTeacherCustomSubjects({ customSubjects: teacher.customSubjects }).find((subject) => subject.toLowerCase() === requestedCustomSubject.toLowerCase())
    : undefined
  if (!subjectCategoryId && requestedCustomSubject && requestedCustomSubject !== teacher.specialty && !customSubject) {
    return NextResponse.json({ error: 'Ten nauczyciel nie prowadzi lekcji z wybranego przedmiotu.' }, { status: 409 })
  }
  const selectedSubjectCategoryId = subjectCategoryId ?? (customSubject ? undefined : teacherCategoryIds[0])
  const selectedSubjectName = selectedSubjectCategoryId
    ? categoriesData.find((category) => category.id === selectedSubjectCategoryId)?.name
    : undefined
  const selectedSpecialty = safeMetaText(selectedSubjectName || customSubject || teacher.specialty || '')

  const requestedStart = timeToMinutes(time)
  const availabilityStart = timeToMinutes(teacher.availabilityStart ?? '09:00')
  const availabilityEnd = timeToMinutes(teacher.availabilityEnd ?? '17:00')
  const requestedDate = new Date(`${dateIso}T12:00:00`)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const latestDate = new Date(today)
  latestDate.setDate(today.getDate() + BOOKING_WINDOW_DAYS)
  const weekdayCode = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][requestedDate.getDay()]
  const teacherAvailability = teacher.availability ?? []
  if (
    requestedStart === null ||
    availabilityStart === null ||
    availabilityEnd === null ||
    Number.isNaN(requestedDate.getTime()) ||
    requestedDate <= today ||
    requestedDate > latestDate ||
    !teacherAvailability.includes(weekdayCode) ||
    requestedStart < availabilityStart ||
    requestedStart + duration + LESSON_BUFFER_MINUTES > availabilityEnd
  ) {
    return NextResponse.json({ error: 'Ten termin nie mieści się już w dostępności nauczyciela.' }, { status: 409 })
  }

  const activeLessons = await adminDb!
    .collection(collections.lessons)
    .where('teacherId', '==', teacherId)
    .where('status', 'in', ['pending', 'upcoming'])
    .get()
  const bookedSlots: BookedLessonSlot[] = activeLessons.docs.map((doc) => {
    const lesson = doc.data() as BookedLessonSlot
    return {
      id: doc.id,
      date: lesson.date,
      dateIso: lesson.dateIso,
      time: lesson.time,
      scheduledStartAt: lesson.scheduledStartAt,
      duration: lesson.duration,
      status: lesson.status,
    }
  })
  if (slotOverlapsBookedLesson({ dateIso, time, duration, booked: bookedSlots })) {
    return NextResponse.json({ error: 'Ten termin jest już zajęty. Wybierz inną godzinę.' }, { status: 409 })
  }

  // Authoritative price — recomputed server-side, never trusted from the client.
  const pricePln = Math.round((teacher.hourlyRate / 60) * duration)
  const priceGrosze = toGrosze(pricePln)
  const paymentSettings = await getPlatformPaymentSettings()
  const { platformFeeGrosze, teacherAmountGrosze } = splitPayment(priceGrosze, paymentSettings.commissionPercent)
  const [year, month, day] = dateIso.split('-').map(Number)
  const scheduledStartAt = new Date(year, month - 1, day, Math.floor(requestedStart / 60), requestedStart % 60).getTime()

  try {
    const origin = getOrigin(request)
    const session = await stripe!.checkout.sessions.create({
      mode: 'payment',
      currency: STRIPE_CURRENCY,
      line_items: [
        {
          price_data: {
            currency: STRIPE_CURRENCY,
            product_data: { name: `Lekcja: ${topic.trim()}`, description: `${teacher.name} · ${selectedSpecialty} · ${date} o ${time} · ${duration} min` },
            unit_amount: priceGrosze,
          },
          quantity: 1,
        },
      ],
      metadata: {
        teacherId,
        teacherName: safeMetaText(teacher.name ?? ''),
        teacherInitials: teacher.initials ?? '',
        teacherColor: teacher.avatarColor ?? '#F4B400',
        teacherPhotoUrl: safeMetaPhotoUrl(teacher.photoUrl),
        subjectCategoryId: selectedSubjectCategoryId ?? '',
        specialty: selectedSpecialty,
        studentId,
        studentName: safeMetaText(studentName),
        payerId,
        payerRole,
        date,
        dateIso,
        time,
        scheduledStartAt: String(scheduledStartAt),
        duration: String(duration),
        topic: safeMetaText(topic.trim()),
        priceGrosze: String(priceGrosze),
        commissionPercent: String(paymentSettings.commissionPercent),
        platformFeeGrosze: String(platformFeeGrosze),
        teacherAmountGrosze: String(teacherAmountGrosze),
      },
      success_url: `${origin}/payment/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/teacher/${teacherId}/book`,
    })

    return NextResponse.json({ url: session.url })
  } catch (err) {
    console.error('[stripe/checkout/create-session] Failed:', err)
    return NextResponse.json({ error: 'Nie udało się rozpocząć płatności. Spróbuj ponownie.' }, { status: 500 })
  }
}
