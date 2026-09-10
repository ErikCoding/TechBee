import 'server-only'
import type Stripe from 'stripe'
import { adminDb } from '@/lib/firebase-admin'
import { collections } from '@/lib/firebase'
import { stripe } from '@/lib/stripe'
import { LESSON_BUFFER_MINUTES, minutesToTime, slotOverlapsBookedLesson, timeToMinutes } from '@/lib/lesson-time'
import type { Lesson } from '@/lib/types'

function paidCheckoutSession(session: Stripe.Checkout.Session): boolean {
  return session.status === 'complete' && session.payment_status === 'paid'
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

async function refundPaidSession(session: Stripe.Checkout.Session) {
  const paymentIntentId = typeof session.payment_intent === 'string' ? session.payment_intent : session.payment_intent?.id
  if (!paymentIntentId || !stripe) return
  await stripe.refunds.create({
    payment_intent: paymentIntentId,
    metadata: { reason: 'lesson_slot_unavailable_after_payment', checkoutSessionId: session.id },
  })
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
  const database = adminDb

  const existing = await database.collection(collections.lessons).where('stripeCheckoutSessionId', '==', session.id).limit(1).get()
  if (!existing.empty) return existing.docs[0].id

  if (!paidCheckoutSession(session)) return null

  const m = session.metadata
  if (!m?.teacherId || !m.studentId || !m.priceGrosze) {
    console.error('[stripe/checkout] paid session missing required metadata', session.id)
    return null
  }

  const paymentIntentId = typeof session.payment_intent === 'string' ? session.payment_intent : session.payment_intent?.id
  const now = Date.now()
  const duration = Number(m.duration ?? 60)
  const scheduledStartAt = Number(m.scheduledStartAt)
  const lesson: Omit<Lesson, 'id'> = {
    teacherId: m.teacherId,
    studentId: m.studentId,
    teacherName: m.teacherName ?? '',
    studentName: m.studentName ?? '',
    teacherInitials: m.teacherInitials ?? '',
    teacherColor: m.teacherColor || '#F4B400',
    ...(m.teacherPhotoUrl ? { teacherPhotoUrl: m.teacherPhotoUrl } : {}),
    specialty: m.specialty ?? '',
    date: m.date ?? '',
    ...(m.dateIso ? { dateIso: m.dateIso } : {}),
    time: m.time ?? '',
    ...(Number.isFinite(scheduledStartAt) && scheduledStartAt > 0 ? { scheduledStartAt } : {}),
    duration,
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
    ...(paymentIntentId ? { stripePaymentIntentId: paymentIntentId } : {}),
    // See the Lesson.livemode doc comment (lib/types.ts) — this is what
    // lets the admin wallet panel separate real revenue from sandbox
    // testing without needing a second Firebase project.
    livemode: Boolean(session.livemode),
  }

  const lockIds = m.dateIso && m.time ? slotLockIds(m.teacherId, m.dateIso, m.time, duration) : []
  const ref = database.collection(collections.lessons).doc()
  const lessonId = await database.runTransaction(async (tx) => {
    if (lockIds.length > 0) {
      const lockRefs = lockIds.map((id) => database.collection(collections.lessonSlotLocks).doc(id))
      const lockSnaps = await Promise.all(lockRefs.map((lockRef) => tx.get(lockRef)))
      for (const lockSnap of lockSnaps) {
        if (!lockSnap.exists) continue
        const lockedLessonId = lockSnap.data()?.lessonId
        if (typeof lockedLessonId !== 'string') return null
        const lockedLessonSnap = await tx.get(database.collection(collections.lessons).doc(lockedLessonId))
        if (!lockedLessonSnap.exists) continue
        const lockedLesson = { id: lockedLessonSnap.id, ...lockedLessonSnap.data() } as Lesson
        if (slotOverlapsBookedLesson({ dateIso: m.dateIso, time: m.time, duration, booked: [lockedLesson] })) {
          return null
        }
      }
      for (const lockRef of lockRefs) {
        tx.set(lockRef, {
          teacherId: m.teacherId,
          dateIso: m.dateIso,
          time: m.time,
          checkoutSessionId: session.id,
          lessonId: ref.id,
          createdAt: now,
        })
      }
    }
    tx.set(ref, lesson)
    return ref.id
  })

  if (!lessonId) {
    await refundPaidSession(session)
    await database.collection(collections.notifications).add({
      userId: m.payerId || m.studentId,
      type: 'payment',
      title: 'Termin został zajęty',
      description: `Płatność za lekcję „${m.topic}" została zwrócona, ponieważ ktoś zarezerwował ten termin chwilę wcześniej. Wybierz inną godzinę.`,
      date: new Date(now).toLocaleDateString('pl-PL', { day: 'numeric', month: 'short', year: 'numeric' }),
      read: false,
      createdAt: now,
    })
    return null
  }

  await database.collection(collections.notifications).add({
    userId: m.teacherId,
    type: 'lesson',
    title: 'Nowa opłacona rezerwacja',
    description: `${m.studentName} zapłacił(a) za lekcję „${m.topic}" — ${m.date} o ${m.time}. Potwierdź lub odrzuć w panelu.`,
    date: new Date(now).toLocaleDateString('pl-PL', { day: 'numeric', month: 'short', year: 'numeric' }),
    read: false,
    createdAt: now,
  })

  console.log(`[stripe/checkout] Created lesson ${lessonId} from checkout session ${session.id}`)
  return lessonId
}
