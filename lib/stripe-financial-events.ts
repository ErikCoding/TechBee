import 'server-only'
import type Stripe from 'stripe'
import { adminDb } from '@/lib/firebase-admin'
import { collections } from '@/lib/firebase'
import { stripe } from '@/lib/stripe'
import { STRIPE_CURRENCY } from '@/lib/stripe-config'
import type { Lesson, StripeFinancialEvent } from '@/lib/types'
import type { StripeFinancialEventLike } from '@/lib/stripe-financial-metrics'

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

export async function readStripeRefundFinancialEvent(refundInput: Stripe.Refund): Promise<{
  event: Omit<StripeFinancialEvent, 'id'>
  balanceTransactionId: string
  lessonRef?: FirebaseFirestore.DocumentReference
  fullRefundForLesson: boolean
} | null> {
  if (!stripe) return null
  const refund = refundInput.balance_transaction && refundInput.charge
    ? refundInput
    : await stripe.refunds.retrieve(refundInput.id, { expand: ['balance_transaction', 'charge.balance_transaction', 'payment_intent'] })
  const refundBalanceTransaction = objectWithId<Stripe.BalanceTransaction>(refund.balance_transaction)
  if (!refundBalanceTransaction) return null

  const charge = objectWithId<Stripe.Charge>(refund.charge)
    ?? (typeof refund.charge === 'string'
      ? await stripe.charges.retrieve(refund.charge, { expand: ['balance_transaction', 'payment_intent'] })
      : null)
  const chargeBalanceTransaction = objectWithId<Stripe.BalanceTransaction>(charge?.balance_transaction)
  const paymentIntentId = typeof refund.payment_intent === 'string'
    ? refund.payment_intent
    : objectWithId<Stripe.PaymentIntent>(refund.payment_intent)?.id
      ?? (typeof charge?.payment_intent === 'string' ? charge.payment_intent : objectWithId<Stripe.PaymentIntent>(charge?.payment_intent)?.id)
  const lessonHit = await findLessonByPaymentIntent(paymentIntentId)
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
      livemode: Boolean(charge?.livemode),
      recordedAt: Date.now(),
    },
  }
}

export async function persistStripeRefundFinancialEvent(refund: Stripe.Refund): Promise<void> {
  if (!adminDb) return
  const prepared = await readStripeRefundFinancialEvent(refund)
  if (!prepared) return

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
  })
}

function platformCostCategory(transaction: Stripe.BalanceTransaction): StripeFinancialEventLike['financeCategory'] | null {
  const transactionType = transaction.type as string
  if (transactionType === 'refund' || transactionType === 'payment_refund') return null
  if (transactionType === 'charge' || transactionType === 'payment') return null
  if (transactionType === 'transfer' || transactionType === 'payout') {
    return transaction.fee > 0 ? 'connect_payout_fee' : null
  }
  if (transactionType === 'stripe_fee') return 'connect_payout_fee'
  if (transactionType === 'network_cost') return 'other_stripe_cost'
  if (transaction.net < 0 && (
    transactionType === 'adjustment' ||
    transactionType === 'application_fee_refund' ||
    transactionType === 'transfer_reversal' ||
    transactionType === 'other'
  )) {
    return 'other_stripe_cost'
  }
  if (transaction.net > 0 && (
    transactionType === 'adjustment' ||
    transactionType === 'transfer_reversal' ||
    transactionType === 'other'
  )) {
    return 'other_stripe_credit'
  }
  return null
}

export async function readPlatformStripeCostFinancialEvents(existingBalanceTransactionIds: Set<string>): Promise<StripeFinancialEventLike[]> {
  if (!stripe) return []

  const events: StripeFinancialEventLike[] = []
  for await (const transaction of stripe.balanceTransactions.list({ limit: 100, currency: STRIPE_CURRENCY })) {
    if (existingBalanceTransactionIds.has(transaction.id)) continue
    const financeCategory = platformCostCategory(transaction)
    if (!financeCategory) continue
    events.push({
      type: 'other',
      amountGrosze: transaction.amount,
      feeGrosze: transaction.fee,
      netGrosze: transaction.type === 'transfer' || transaction.type === 'payout'
        ? -Math.abs(transaction.fee)
        : transaction.net,
      financeCategory,
    })
  }
  return events
}
