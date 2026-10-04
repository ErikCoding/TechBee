import 'server-only'
import type Stripe from 'stripe'
import { adminDb } from '@/lib/firebase-admin'
import { collections } from '@/lib/firebase'
import { stripe } from '@/lib/stripe'
import { LESSON_BUFFER_MINUTES, minutesToTime, slotOverlapsBookedLesson, timeToMinutes } from '@/lib/lesson-time'
import { getStripePaymentFeeSnapshot } from '@/lib/stripe-payment-fees'
import { resolveCheckoutSessionRaceDecision } from '@/lib/stripe-checkout-lessons-core'
import { checkoutAutoRefundIdempotencyKey, normalizeLessonKind, trialLessonConsumesEligibility } from '@/lib/trial-lessons'
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

function trialGuardId(studentId: string, teacherId: string): string {
  return `${encodeURIComponent(studentId)}__${encodeURIComponent(teacherId)}`
}

async function refundPaidSession(session: Stripe.Checkout.Session) {
  const paymentIntentId = typeof session.payment_intent === 'string' ? session.payment_intent : session.payment_intent?.id
  if (!paymentIntentId || !stripe) return
  await stripe.refunds.create({
    payment_intent: paymentIntentId,
    metadata: { reason: 'lesson_slot_unavailable_after_payment', checkoutSessionId: session.id },
  }, {
    idempotencyKey: checkoutAutoRefundIdempotencyKey(session.id),
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
  let feeSnapshot: Awaited<ReturnType<typeof getStripePaymentFeeSnapshot>> = null
  if (paymentIntentId) {
    try {
      feeSnapshot = await getStripePaymentFeeSnapshot(paymentIntentId)
    } catch (err) {
      console.error('[stripe/checkout] Failed to read Stripe fee snapshot:', err)
    }
  }
  const now = Date.now()
  const duration = Number(m.duration ?? 60)
  const scheduledStartAt = Number(m.scheduledStartAt)
  const lessonKind = normalizeLessonKind(m.lessonKind)
  const lesson: Omit<Lesson, 'id'> = {
    teacherId: m.teacherId,
    studentId: m.studentId,
    teacherName: m.teacherName ?? '',
    studentName: m.studentName ?? '',
    teacherInitials: m.teacherInitials ?? '',
    teacherColor: m.teacherColor || '#F4B400',
    ...(m.teacherPhotoUrl ? { teacherPhotoUrl: m.teacherPhotoUrl } : {}),
    ...(m.subjectCategoryId ? { subjectCategoryId: m.subjectCategoryId } : {}),
    specialty: m.specialty ?? '',
    date: m.date ?? '',
    ...(m.dateIso ? { dateIso: m.dateIso } : {}),
    time: m.time ?? '',
    ...(Number.isFinite(scheduledStartAt) && scheduledStartAt > 0 ? { scheduledStartAt } : {}),
    duration,
    lessonKind,
    status: 'pending',
    price: Math.round(Number(m.priceGrosze)) / 100,
    topic: m.topic ?? '',
    createdAt: now,
    payerId: m.payerId || m.studentId,
    payerRole: (m.payerRole as Lesson['payerRole']) || 'student',
    paymentStatus: 'paid',
    priceGrosze: Number(m.priceGrosze),
    commissionPercent: Number(m.commissionPercent ?? 0),
    effectiveCommissionPercent: Number(m.effectiveCommissionPercent ?? m.commissionPercent ?? 0),
    commissionSource: m.commissionSource === 'founding_teacher' ? 'founding_teacher' : 'standard',
    platformFeeGrosze: Number(m.platformFeeGrosze ?? 0),
    teacherAmountGrosze: Number(m.teacherAmountGrosze ?? 0),
    ...(feeSnapshot ? {
      stripeFeeGrosze: feeSnapshot.stripeFeeGrosze,
    } : {}),
    stripeCheckoutSessionId: session.id,
    ...(paymentIntentId ? { stripePaymentIntentId: paymentIntentId } : {}),
    // See the Lesson.livemode doc comment (lib/types.ts) — this is what
    // lets the admin wallet panel separate real revenue from sandbox
    // testing without needing a second Firebase project.
    livemode: Boolean(session.livemode),
  }

  const lockIds = m.dateIso && m.time ? slotLockIds(m.teacherId, m.dateIso, m.time, duration) : []
  const ref = database.collection(collections.lessons).doc()
  const result = await database.runTransaction(async (tx): Promise<{ lessonId: string | null; created: boolean; reason?: 'slot_unavailable' | 'trial_already_used' | 'same_session_in_progress' }> => {
    const existingInTx = await tx.get(database.collection(collections.lessons).where('stripeCheckoutSessionId', '==', session.id).limit(1))
    if (!existingInTx.empty) return { lessonId: existingInTx.docs[0].id, created: false }

    const trialGuardRef = lessonKind === 'trial'
      ? database.collection(collections.trialLessonGuards).doc(trialGuardId(m.studentId, m.teacherId))
      : null
    if (trialGuardRef) {
      const guardSnap = await tx.get(trialGuardRef)
      if (guardSnap.exists) {
        const guardedLessonId = guardSnap.data()?.lessonId
        if (typeof guardedLessonId !== 'string') return { lessonId: null, created: false, reason: 'trial_already_used' }
        const guardedLessonSnap = await tx.get(database.collection(collections.lessons).doc(guardedLessonId))
        if (!guardedLessonSnap.exists) return { lessonId: null, created: false, reason: 'trial_already_used' }
        const guardedLesson = { id: guardedLessonSnap.id, ...guardedLessonSnap.data() } as Lesson
        if (trialLessonConsumesEligibility(guardedLesson)) return { lessonId: null, created: false, reason: 'trial_already_used' }
      }
    }

    if (lockIds.length > 0) {
      const lockRefs = lockIds.map((id) => database.collection(collections.lessonSlotLocks).doc(id))
      const lockSnaps = await Promise.all(lockRefs.map((lockRef) => tx.get(lockRef)))
      for (const lockSnap of lockSnaps) {
        if (!lockSnap.exists) continue
        const lockDecision = resolveCheckoutSessionRaceDecision({
          currentCheckoutSessionId: session.id,
          slotLocks: [{
            exists: true,
            checkoutSessionId: lockSnap.data()?.checkoutSessionId,
            lessonId: lockSnap.data()?.lessonId,
          }],
        })
        if (lockDecision.action === 'return_existing_lesson') {
          const sameSessionLessonSnap = await tx.get(database.collection(collections.lessons).doc(lockDecision.lessonId))
          if (sameSessionLessonSnap.exists) return { lessonId: lockDecision.lessonId, created: false }
          return { lessonId: null, created: false, reason: 'same_session_in_progress' }
        }
        if (lockDecision.action === 'same_session_in_progress') {
          return { lessonId: null, created: false, reason: 'same_session_in_progress' }
        }
        const lockedLessonId = lockSnap.data()?.lessonId
        if (typeof lockedLessonId !== 'string') return { lessonId: null, created: false, reason: 'slot_unavailable' }
        const lockedLessonSnap = await tx.get(database.collection(collections.lessons).doc(lockedLessonId))
        if (!lockedLessonSnap.exists) continue
        const lockedLesson = { id: lockedLessonSnap.id, ...lockedLessonSnap.data() } as Lesson
        if (slotOverlapsBookedLesson({ dateIso: m.dateIso, time: m.time, duration, booked: [lockedLesson] })) {
          return { lessonId: null, created: false, reason: 'slot_unavailable' }
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
    if (trialGuardRef) {
      tx.set(trialGuardRef, {
        teacherId: m.teacherId,
        studentId: m.studentId,
        lessonId: ref.id,
        checkoutSessionId: session.id,
        createdAt: now,
      })
    }
    tx.set(ref, lesson)
    if (feeSnapshot) {
      tx.set(database.collection(collections.lessonPaymentSnapshots).doc(ref.id), {
        lessonId: ref.id,
        ...(paymentIntentId ? { stripePaymentIntentId: paymentIntentId } : {}),
        stripeFeeGrosze: feeSnapshot.stripeFeeGrosze,
        stripeChargeId: feeSnapshot.stripeChargeId,
        stripeBalanceTransactionId: feeSnapshot.stripeBalanceTransactionId,
        livemode: Boolean(session.livemode),
        createdAt: now,
      })
    }
    return { lessonId: ref.id, created: true }
  })

  if (!result.lessonId) {
    if (result.reason === 'same_session_in_progress') return null
    await refundPaidSession(session)
    await database.collection(collections.notifications).add({
      userId: m.payerId || m.studentId,
      type: 'payment',
      title: result.reason === 'trial_already_used' ? 'Lekcja próbna została już wykorzystana' : 'Termin został zajęty',
      description: result.reason === 'trial_already_used'
        ? `Płatność za lekcję próbną „${m.topic}" została zwrócona, ponieważ u tego nauczyciela można wykorzystać tylko jedną opłaconą lekcję próbną.`
        : `Płatność za lekcję „${m.topic}" została zwrócona, ponieważ ktoś zarezerwował ten termin chwilę wcześniej. Wybierz inną godzinę.`,
      date: new Date(now).toLocaleDateString('pl-PL', { day: 'numeric', month: 'short', year: 'numeric' }),
      read: false,
      createdAt: now,
    })
    return null
  }

  if (!result.created) return result.lessonId

  await database.collection(collections.notifications).add({
    userId: m.teacherId,
    type: 'lesson',
    title: 'Nowa opłacona rezerwacja',
    description: `${m.studentName} zapłacił(a) za lekcję „${m.topic}" — ${m.date} o ${m.time}. Potwierdź lub odrzuć w panelu.`,
    date: new Date(now).toLocaleDateString('pl-PL', { day: 'numeric', month: 'short', year: 'numeric' }),
    read: false,
    createdAt: now,
  })

  console.log(`[stripe/checkout] Created lesson ${result.lessonId} from checkout session ${session.id}`)
  return result.lessonId
}
