import 'server-only'
import type Stripe from 'stripe'
import { adminDb } from '@/lib/firebase-admin'
import { collections } from '@/lib/firebase'
import { stripe } from '@/lib/stripe'
import { STRIPE_CURRENCY } from '@/lib/stripe-config'
import type { Lesson, LessonPackage, StripeFinancialEvent } from '@/lib/types'
import type { StripeFinancialEventLike } from '@/lib/stripe-financial-metrics'
import { toPlatformStripeCostFinancialEvent } from '@/lib/stripe-financial-events-core'
import {
  buildPackageRefundReviewPatch,
  paymentIntentIdFromRefundLike,
  writePackageRefundReview,
  type RefundReviewPatch,
} from '@/lib/lesson-package-refunds-core'

function objectWithId<T extends { id: string }>(value: string | T | null | undefined): T | null {
  return value && typeof value !== 'string' ? value : null
}

async function findLessonByPaymentIntent(paymentIntentId?: string | null): Promise<{ id: string; ref: FirebaseFirestore.DocumentReference; lesson: Lesson } | null> {
  if (!adminDb || !paymentIntentId) return null
  const snap = await adminDb.collection(collections.lessons).where('stripePaymentIntentId', '==', paymentIntentId).limit(1).get()
  if (snap.empty) return null
  const doc = snap.docs[0]
  return { id: doc.id, ref: doc.ref, lesson: { id: doc.id, ...(doc.data() as Omit<Lesson, 'id'>) } }
}

async function findLessonPackageByPaymentIntent(paymentIntentId?: string | null): Promise<{ id: string; ref: FirebaseFirestore.DocumentReference; lessonPackage: LessonPackage } | null> {
  if (!adminDb || !paymentIntentId) return null
  const snap = await adminDb.collection(collections.lessonPackages).where('stripePaymentIntentId', '==', paymentIntentId).limit(1).get()
  if (snap.empty) return null
  const doc = snap.docs[0]
  return { id: doc.id, ref: doc.ref, lessonPackage: { id: doc.id, ...(doc.data() as Omit<LessonPackage, 'id'>) } }
}

async function resolveRefund(refundInput: Stripe.Refund): Promise<Stripe.Refund | null> {
  if (!stripe) return null
  return refundInput.charge || refundInput.payment_intent
    ? refundInput
    : await stripe.refunds.retrieve(refundInput.id, { expand: ['balance_transaction', 'charge.balance_transaction', 'payment_intent'] })
}

async function resolveCharge(refund: Stripe.Refund): Promise<Stripe.Charge | null> {
  return objectWithId<Stripe.Charge>(refund.charge)
    ?? (typeof refund.charge === 'string'
      ? await stripe!.charges.retrieve(refund.charge, { expand: ['balance_transaction', 'payment_intent'] })
      : null)
}

async function readStripeRefundPackageReview(refundInput: Stripe.Refund): Promise<{
  packageRef: FirebaseFirestore.DocumentReference
  patch: RefundReviewPatch
} | null> {
  const refund = await resolveRefund(refundInput)
  if (!refund) return null
  const charge = await resolveCharge(refund)
  const paymentIntentId = paymentIntentIdFromRefundLike(refund, charge)
  const packageHit = await findLessonPackageByPaymentIntent(paymentIntentId)
  if (!packageHit) return null
  const fullRefundForCharge = Boolean(charge && (charge.amount_refunded ?? 0) >= charge.amount)
  const patch = buildPackageRefundReviewPatch({
    stripeRefundId: refund.id,
    refundStatus: refund.status,
    refundAmountGrosze: refund.amount,
    refundFull: fullRefundForCharge,
    now: Date.now(),
  })
  if (!patch) return null
  return { packageRef: packageHit.ref, patch }
}

export async function readStripeRefundFinancialEvent(refundInput: Stripe.Refund): Promise<{
  event: Omit<StripeFinancialEvent, 'id'>
  balanceTransactionId: string
  lessonRef?: FirebaseFirestore.DocumentReference
  fullRefundForLesson: boolean
} | null> {
  const refund = await resolveRefund(refundInput)
  if (!refund) return null
  const refundBalanceTransaction = objectWithId<Stripe.BalanceTransaction>(refund.balance_transaction)
  if (!refundBalanceTransaction) return null

  const charge = await resolveCharge(refund)
  const chargeBalanceTransaction = objectWithId<Stripe.BalanceTransaction>(charge?.balance_transaction)
  const paymentIntentId = paymentIntentIdFromRefundLike(refund, charge)
  const lessonHit = await findLessonByPaymentIntent(paymentIntentId)
  const packageHit = await findLessonPackageByPaymentIntent(paymentIntentId)
  const fullRefundForCharge = Boolean(charge && (charge.amount_refunded ?? 0) >= charge.amount)

  return {
    balanceTransactionId: refundBalanceTransaction.id,
    lessonRef: lessonHit?.ref,
    fullRefundForLesson: Boolean(lessonHit && fullRefundForCharge),
    event: {
      type: 'refund',
      amountGrosze: refundBalanceTransaction.amount,
      feeGrosze: refundBalanceTransaction.fee,
      netGrosze: refundBalanceTransaction.net,
      currency: refundBalanceTransaction.currency,
      status: refundBalanceTransaction.status,
      availableOn: refundBalanceTransaction.available_on ? refundBalanceTransaction.available_on * 1000 : undefined,
      createdAt: refundBalanceTransaction.created * 1000,
      stripeBalanceTransactionId: refundBalanceTransaction.id,
      stripeRefundId: refund.id,
      ...(charge?.id ? { stripeChargeId: charge.id } : {}),
      ...(paymentIntentId ? { stripePaymentIntentId: paymentIntentId } : {}),
      ...(typeof charge?.amount === 'number' ? { chargeAmountGrosze: charge.amount } : {}),
      ...(typeof chargeBalanceTransaction?.fee === 'number' ? { chargeFeeGrosze: chargeBalanceTransaction.fee } : {}),
      ...(typeof chargeBalanceTransaction?.net === 'number' ? { chargeNetGrosze: chargeBalanceTransaction.net } : {}),
      refundAmountGrosze: refund.amount,
      fullRefund: fullRefundForCharge,
      ...(lessonHit ? { lessonId: lessonHit.id } : {}),
      ...(packageHit ? { packageId: packageHit.id } : {}),
      livemode: Boolean(charge?.livemode),
      recordedAt: Date.now(),
    },
  }
}

export async function persistStripeRefundFinancialEvent(refund: Stripe.Refund): Promise<void> {
  if (!adminDb) return
  const packageReview = await readStripeRefundPackageReview(refund)
  const prepared = await readStripeRefundFinancialEvent(refund)
  if (!prepared) {
    if (packageReview) {
      await writePackageRefundReview({ database: adminDb, packageRef: packageReview.packageRef, patch: packageReview.patch })
    }
    return
  }

  const eventRef = adminDb.collection(collections.stripeFinancialEvents).doc(prepared.balanceTransactionId)
  await adminDb.runTransaction(async (tx) => {
    const existing = await tx.get(eventRef)
    if (!existing.exists) {
      tx.set(eventRef, prepared.event)
    }
    if (prepared.lessonRef && prepared.fullRefundForLesson) {
      const lessonSnap = await tx.get(prepared.lessonRef)
      if (lessonSnap.exists && lessonSnap.data()?.paymentStatus !== 'refunded') {
        tx.update(prepared.lessonRef, {
          stripeRefundId: prepared.event.stripeRefundId,
          paymentStatus: 'refunded',
          status: 'cancelled',
        })
      }
    }
    if (packageReview) {
      const packageSnap = await tx.get(packageReview.packageRef)
      if (packageSnap.exists) {
        tx.update(packageReview.packageRef, packageReview.patch)
      }
    }
  })
}

export async function readPlatformStripeCostFinancialEvents(existingBalanceTransactionIds: Set<string>): Promise<StripeFinancialEventLike[]> {
  if (!stripe) return []

  const events: StripeFinancialEventLike[] = []
  for await (const transaction of stripe.balanceTransactions.list({ limit: 100, currency: STRIPE_CURRENCY })) {
    if (existingBalanceTransactionIds.has(transaction.id)) continue
    const event = toPlatformStripeCostFinancialEvent({
      id: transaction.id,
      type: transaction.type as string,
      amount: transaction.amount,
      fee: transaction.fee,
      net: transaction.net,
      created: transaction.created,
      description: transaction.description,
      source: typeof transaction.source === 'string' ? transaction.source : transaction.source?.id,
    })
    if (event) events.push(event)
  }
  return events
}
