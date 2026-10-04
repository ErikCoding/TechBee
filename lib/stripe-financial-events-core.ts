import type { StripeFinancialEventLike } from './stripe-financial-metrics'

export type PlatformStripeBalanceTransaction = {
  id: string
  type: string
  amount: number
  fee: number
  net: number
  created?: number
  description?: string | null
  source?: string | { id?: string } | null
}

function sourceId(source: PlatformStripeBalanceTransaction['source']): string | undefined {
  if (!source) return undefined
  return typeof source === 'string' ? source : source.id
}

export function toPlatformStripeCostFinancialEvent(transaction: PlatformStripeBalanceTransaction): StripeFinancialEventLike | null {
  let financeCategory: StripeFinancialEventLike['financeCategory'] | null = null
  if (transaction.type === 'refund' || transaction.type === 'payment_refund') return null
  if (transaction.type === 'charge' || transaction.type === 'payment') return null
  if (transaction.type === 'transfer' || transaction.type === 'payout') {
    financeCategory = transaction.fee > 0 ? 'connect_payout_fee' : null
  } else if (transaction.type === 'stripe_fee') {
    financeCategory = 'connect_payout_fee'
  } else if (transaction.type === 'network_cost') {
    financeCategory = 'other_stripe_cost'
  } else if (transaction.net < 0 && (
    transaction.type === 'adjustment' ||
    transaction.type === 'application_fee_refund' ||
    transaction.type === 'transfer_reversal' ||
    transaction.type === 'other'
  )) {
    financeCategory = 'other_stripe_cost'
  } else if (transaction.net > 0 && (
    transaction.type === 'adjustment' ||
    transaction.type === 'transfer_reversal' ||
    transaction.type === 'other'
  )) {
    financeCategory = 'other_stripe_credit'
  }
  if (!financeCategory) return null

  return {
    type: 'other',
    amountGrosze: transaction.amount,
    feeGrosze: transaction.fee,
    netGrosze: transaction.type === 'transfer' || transaction.type === 'payout'
      ? -Math.abs(transaction.fee)
      : transaction.net,
    financeCategory,
    stripeBalanceTransactionId: transaction.id,
    stripeType: transaction.type,
    ...(transaction.description ? { description: transaction.description } : {}),
    ...(sourceId(transaction.source) ? { source: sourceId(transaction.source) } : {}),
    ...(typeof transaction.created === 'number' ? { createdAt: transaction.created * 1000 } : {}),
  }
}
