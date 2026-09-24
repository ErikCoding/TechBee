import 'server-only'
import type Stripe from 'stripe'
import { stripe } from '@/lib/stripe'

export type StripePaymentFeeSnapshot = {
  stripeFeeGrosze: number
  stripeBalanceTransactionId: string
  stripeChargeId: string
}

function objectWithId<T extends { id: string }>(value: string | T | null | undefined): T | null {
  return value && typeof value !== 'string' ? value : null
}

export async function getStripePaymentFeeSnapshot(paymentIntentId: string): Promise<StripePaymentFeeSnapshot | null> {
  if (!stripe || !paymentIntentId) return null

  const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId, {
    expand: ['latest_charge.balance_transaction'],
  })
  const charge = objectWithId<Stripe.Charge>(paymentIntent.latest_charge)
  const balanceTransaction = objectWithId<Stripe.BalanceTransaction>(charge?.balance_transaction)
  if (!charge || !balanceTransaction || !Number.isFinite(balanceTransaction.fee)) return null

  return {
    stripeFeeGrosze: balanceTransaction.fee,
    stripeBalanceTransactionId: balanceTransaction.id,
    stripeChargeId: charge.id,
  }
}
