import type { PlatformStripeCostBreakdownEntry, PlatformWalletEntry } from '@/lib/types'

function stripeCostTopic(event: PlatformStripeCostBreakdownEntry): string {
  return event.description?.trim() || event.stripeType || 'Stripe / Connect fee'
}

export function stripeCostTransactionLabel(event: Pick<PlatformStripeCostBreakdownEntry, 'financeCategory' | 'stripeType'>): string {
  if (event.financeCategory === 'other_stripe_credit') return 'Stripe credit'
  if (event.financeCategory === 'other_stripe_cost') return 'Stripe fee'
  if (event.stripeType === 'payout') return 'Payout fee'
  return 'Connect fee'
}

export function buildStripeCostWalletEntry(event: PlatformStripeCostBreakdownEntry): PlatformWalletEntry {
  return {
    id: `stripe-cost:${event.stripeBalanceTransactionId ?? event.id}`,
    transactionType: 'stripe_connect_fee',
    stripeBalanceTransactionId: event.stripeBalanceTransactionId,
    stripeType: event.stripeType,
    stripeDescription: event.description,
    stripeSource: event.source,
    stripeCostFinanceCategory: event.financeCategory,
    countsAsPaidVolume: false,
    topic: stripeCostTopic(event),
    date: typeof event.createdAt === 'number'
      ? new Date(event.createdAt).toLocaleDateString('pl-PL', { day: 'numeric', month: 'short', year: 'numeric' })
      : 'Stripe / Connect',
    grossGrosze: event.financeCategory === 'other_stripe_credit'
      ? Math.abs(event.netGrosze || event.amountGrosze)
      : -Math.abs(event.netGrosze || event.amountGrosze || event.feeGrosze),
    platformFeeGrosze: 0,
    stripeFeeGrosze: event.feeGrosze,
    netPlatformRevenueGrosze: event.netGrosze,
    teacherAmountGrosze: 0,
    status: 'posted',
    settlementStatus: 'stripe_cost',
    transferStatus: 'not_applicable',
    createdAt: event.createdAt ?? 0,
  }
}

export function mergeAndSortPlatformWalletEntries(
  entries: PlatformWalletEntry[],
  stripeCostEvents: PlatformStripeCostBreakdownEntry[],
): PlatformWalletEntry[] {
  return [
    ...entries,
    ...stripeCostEvents.map(buildStripeCostWalletEntry),
  ].sort((a, b) => b.createdAt - a.createdAt)
}
