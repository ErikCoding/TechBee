import 'server-only'
import { adminDb, isAdminConfigured } from '@/lib/firebase-admin'
import { collections } from '@/lib/firebase'
import { stripe, isStripeConfigured } from '@/lib/stripe'
import { STRIPE_CURRENCY } from '@/lib/stripe-config'
import { lessonTeacherTransferIdempotencyKey } from '@/lib/lesson-release-core'
import { isLessonReleaseEligible } from '@/lib/lesson-report-auto-confirm'
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
    const transfer = await stripe.transfers.create({
      amount,
      currency: STRIPE_CURRENCY,
      destination: teacherAccountId,
      transfer_group: `lesson_${lessonId}`,
      metadata: { lessonId, teacherId: lesson.teacherId },
    }, {
      idempotencyKey: lessonTeacherTransferIdempotencyKey(lessonId),
    })

    await lessonRef.update({ stripeTransferId: transfer.id, reportConfirmedAt: now, paymentReleased: true })
    return { ok: true, transferId: transfer.id, alreadyTransferred: false }
  } catch (err) {
    console.error('[lesson-release] Failed to release teacher payment:', err)
    return { ok: false, status: 500, error: 'Nie udało się zwolnić płatności. Spróbuj ponownie.', code: 'transfer_failed' }
  }
}
