import 'server-only'
import type Stripe from 'stripe'
import { adminDb } from '@/lib/firebase-admin'
import { collections } from '@/lib/firebase'
import type { Lesson } from '@/lib/types'

function paidCheckoutSession(session: Stripe.Checkout.Session): boolean {
  return session.status === 'complete' && session.payment_status === 'paid'
}

/**
 * Idempotently turns a paid Checkout Session into a Lesson doc.
 *
 * The webhook normally calls this first. `/api/stripe/checkout/status` also
 * calls it as a fallback after the user returns from Stripe, because local
 * development often has no Stripe CLI webhook tunnel running even though the
 * payment itself succeeded in Stripe.
 */
export async function ensureLessonForCheckoutSession(session: Stripe.Checkout.Session): Promise<string | null> {
  if (!adminDb) return null

  const existing = await adminDb.collection(collections.lessons).where('stripeCheckoutSessionId', '==', session.id).limit(1).get()
  if (!existing.empty) return existing.docs[0].id

  if (!paidCheckoutSession(session)) return null

  const m = session.metadata
  if (!m?.teacherId || !m.studentId || !m.priceGrosze) {
    console.error('[stripe/checkout] paid session missing required metadata', session.id)
    return null
  }

  const paymentIntentId = typeof session.payment_intent === 'string' ? session.payment_intent : session.payment_intent?.id
  const now = Date.now()
  const lesson: Omit<Lesson, 'id'> = {
    teacherId: m.teacherId,
    studentId: m.studentId,
    teacherName: m.teacherName ?? '',
    studentName: m.studentName ?? '',
    teacherInitials: m.teacherInitials ?? '',
    teacherColor: m.teacherColor || '#F4B400',
    specialty: m.specialty ?? '',
    date: m.date ?? '',
    time: m.time ?? '',
    duration: Number(m.duration ?? 60),
    status: 'pending',
    price: Math.round(Number(m.priceGrosze)) / 100,
    topic: m.topic ?? '',
    createdAt: now,
    payerId: m.payerId || m.studentId,
    payerRole: (m.payerRole as Lesson['payerRole']) || 'student',
    paymentStatus: 'paid',
    priceGrosze: Number(m.priceGrosze),
    commissionPercent: Number(m.commissionPercent ?? 0),
    platformFeeGrosze: Number(m.platformFeeGrosze ?? 0),
    teacherAmountGrosze: Number(m.teacherAmountGrosze ?? 0),
    stripeCheckoutSessionId: session.id,
    stripePaymentIntentId: paymentIntentId,
  }

  const ref = await adminDb.collection(collections.lessons).add(lesson)

  await adminDb.collection(collections.notifications).add({
    userId: m.teacherId,
    type: 'lesson',
    title: 'Nowa opłacona rezerwacja',
    description: `${m.studentName} zapłacił(a) za lekcję „${m.topic}" — ${m.date} o ${m.time}. Potwierdź lub odrzuć w panelu.`,
    date: new Date(now).toLocaleDateString('pl-PL', { day: 'numeric', month: 'short', year: 'numeric' }),
    read: false,
    createdAt: now,
  })

  console.log(`[stripe/checkout] Created lesson ${ref.id} from checkout session ${session.id}`)
  return ref.id
}
