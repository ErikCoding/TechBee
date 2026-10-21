import 'server-only'
import { adminDb, isAdminConfigured } from '@/lib/firebase-admin'
import { collections } from '@/lib/firebase'
import { stripe, isStripeConfigured } from '@/lib/stripe'
import { STRIPE_CURRENCY } from '@/lib/stripe-config'
import { lessonTeacherTransferAttemptIdempotencyKey } from '@/lib/lesson-release-core'
import { isLessonReleaseEligible } from '@/lib/lesson-report-auto-confirm'
import { runbeeAppUrl, sendProductNotificationEmail } from '@/lib/email/product-notifications.server'
import type { Lesson } from '@/lib/types'

export type LessonTeacherReleaseResult =
  | { ok: true; transferId: string; alreadyTransferred: boolean }
  | { ok: false; status: number; error: string; code: string }

export async function releaseLessonTeacherPayment(lessonId: string, now = Date.now()): Promise<LessonTeacherReleaseResult> {
  if (!isStripeConfigured || !stripe) {
    return { ok: false, status: 503, error: 'Płatności Stripe nie są jeszcze skonfigurowane.', code: 'stripe_not_configured' }
  }
  if (!isAdminConfigured || !adminDb) {
    return { ok: false, status: 503, error: 'Zaufane zapisy Firestore nie są skonfigurowane.', code: 'admin_not_configured' }
  }

  const lessonRef = adminDb.collection(collections.lessons).doc(lessonId)
  const lessonSnap = await lessonRef.get()
  if (!lessonSnap.exists) return { ok: false, status: 404, error: 'Nie znaleziono lekcji.', code: 'lesson_not_found' }

  const lesson = lessonSnap.data() as Lesson
  if (lesson.stripeTransferId) {
    return { ok: true, transferId: lesson.stripeTransferId, alreadyTransferred: true }
  }
  if (!isLessonReleaseEligible(lesson, { allowResolvedTeacherDispute: true })) {
    return { ok: false, status: 409, error: 'Lekcja nie kwalifikuje się już do zwolnienia płatności.', code: 'not_release_eligible' }
  }

  const teacherSnap = await adminDb.collection(collections.teachers).doc(lesson.teacherId).get()
  const teacherAccountId = teacherSnap.data()?.stripe?.accountId as string | undefined
  if (!teacherAccountId) {
    return { ok: false, status: 400, error: 'Nauczyciel nie ma jeszcze skonfigurowanego konta Stripe.', code: 'missing_teacher_stripe_account' }
  }

  const amount = lesson.teacherAmountGrosze!

  try {
    // Safety net: a transfer for this lesson may already exist at Stripe (e.g. created under the old
    // v1 key but the Firestore write failed). Reuse it instead of paying twice.
    const existing = await stripe.transfers.list({ transfer_group: `lesson_${lessonId}`, limit: 10 })
    const alreadyPaid = existing.data.find((t) => t.metadata?.lessonId === lessonId && !t.reversed)
    if (alreadyPaid) {
      await lessonRef.update({ stripeTransferId: alreadyPaid.id, reportConfirmedAt: now, paymentReleased: true })
      return { ok: true, transferId: alreadyPaid.id, alreadyTransferred: true }
    }

    // Fund the transfer from this lesson's own charge: works while the payment is still in
    // Stripe's *pending* balance (no dependency on the platform's available balance).
    let sourceTransaction: string | undefined
    if (lesson.stripePaymentIntentId) {
      try {
        const pi = await stripe.paymentIntents.retrieve(lesson.stripePaymentIntentId)
        const charge = pi.latest_charge
        sourceTransaction = typeof charge === 'string' ? charge : charge?.id
      } catch (piErr) {
        console.error('[lesson-release] Could not resolve charge for source_transaction, falling back to balance:', piErr)
      }
    }

    const transfer = await stripe.transfers.create({
      amount,
      currency: STRIPE_CURRENCY,
      destination: teacherAccountId,
      transfer_group: `lesson_${lessonId}`,
      metadata: { lessonId, teacherId: lesson.teacherId },
      ...(sourceTransaction ? { source_transaction: sourceTransaction } : {}),
    }, {
      idempotencyKey: lessonTeacherTransferAttemptIdempotencyKey(lessonId, lesson.transferRetryCount ?? 0)
        + (sourceTransaction ? '' : ':nosrc'),
    })

    await lessonRef.update({ stripeTransferId: transfer.id, reportConfirmedAt: now, paymentReleased: true })
    // Informational only — sendProductNotificationEmail never throws and never undoes the transfer.
    await sendProductNotificationEmail({
      eventId: `lesson:${lessonId}:transfer-released:teacher`,
      recipientUid: lesson.teacherId,
      type: 'payments.payout',
      subject: 'Środki za lekcję zostały zwolnione',
      title: 'Płatność za lekcję została zwolniona',
      preheader: 'Środki za lekcję trafiły na Twoje konto Stripe Connect.',
      body: `Raport z lekcji „${lesson.topic ?? 'Lekcja'}” został zaakceptowany, a należność została przekazana na Twoje konto Stripe Connect. Wypłatę na rachunek bankowy zlecisz w portfelu.`,
      details: [
        { label: 'Kwota', value: `${(amount / 100).toLocaleString('pl-PL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} zł` },
        { label: 'Lekcja', value: lesson.topic ?? 'Lekcja' },
      ],
      cta: { label: 'Otwórz portfel', href: runbeeAppUrl('/dashboard') },
    })
    return { ok: true, transferId: transfer.id, alreadyTransferred: false }
  } catch (err) {
    console.error('[lesson-release] Failed to release teacher payment:', err)
    if ((err as { code?: string })?.code === 'balance_insufficient') {
      // Stripe caches the failure per idempotency key for ~24h; bump the attempt so the next try is a fresh request.
      try { await lessonRef.update({ transferRetryCount: (lesson.transferRetryCount ?? 0) + 1 }) } catch { /* best effort */ }
    }
    return { ok: false, status: 500, error: 'Nie udało się zwolnić płatności. Spróbuj ponownie.', code: 'transfer_failed' }
  }
}
