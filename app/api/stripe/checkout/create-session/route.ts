import { NextResponse } from 'next/server'
import { stripe } from '@/lib/stripe'
import { adminDb } from '@/lib/firebase-admin'
import { requireStripeBackend, verifyCaller } from '@/lib/stripe-server-auth'
import { getOrigin } from '@/lib/request-origin'
import { splitPayment, toGrosze, STRIPE_CURRENCY } from '@/lib/stripe-config'
import { collections } from '@/lib/firebase'

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

interface CheckoutRequestBody {
  idToken?: string
  teacherId?: string
  date?: string
  time?: string
  duration?: number
  topic?: string
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

  const { teacherId, date, time, duration, topic, studentId, studentName, payer } = body
  if (!teacherId || !date || !time || !duration || !topic?.trim() || !studentId || !studentName) {
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
    | { name?: string; initials?: string; avatarColor?: string; specialty?: string; hourlyRate?: number; status?: string }
    | undefined
  if (!teacher || !teacher.hourlyRate || (teacher.status && teacher.status !== 'approved')) {
    return NextResponse.json({ error: 'Nie znaleziono tego nauczyciela.' }, { status: 404 })
  }

  // Authoritative price — recomputed server-side, never trusted from the client.
  const pricePln = Math.round((teacher.hourlyRate / 60) * duration)
  const priceGrosze = toGrosze(pricePln)
  const { platformFeeGrosze, teacherAmountGrosze } = splitPayment(priceGrosze)

  try {
    const origin = getOrigin(request)
    const session = await stripe!.checkout.sessions.create({
      mode: 'payment',
      currency: STRIPE_CURRENCY,
      line_items: [
        {
          price_data: {
            currency: STRIPE_CURRENCY,
            product_data: { name: `Lekcja: ${topic.trim()}`, description: `${teacher.name} · ${date} o ${time} · ${duration} min` },
            unit_amount: priceGrosze,
          },
          quantity: 1,
        },
      ],
      metadata: {
        teacherId,
        teacherName: teacher.name ?? '',
        teacherInitials: teacher.initials ?? '',
        teacherColor: teacher.avatarColor ?? '#F4B400',
        specialty: teacher.specialty ?? '',
        studentId,
        studentName,
        payerId,
        payerRole,
        date,
        time,
        duration: String(duration),
        topic: topic.trim(),
        priceGrosze: String(priceGrosze),
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
