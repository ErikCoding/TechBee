import type { PlatformStripeCostBreakdownEntry, PlatformWalletEntry } from '@/lib/types'

type PayoutCostContext = {
  payouts?: { stripePayoutId: string; teacherId: string }[]
  teachers?: { id: string; name?: string; stripe?: { accountId?: string } }[]
}

function stripeCostTopic(event: PlatformStripeCostBreakdownEntry): string {
  return event.description?.trim() || event.stripeType || 'Stripe / Connect fee'
}

export function stripeCostTransactionLabel(event: Pick<PlatformStripeCostBreakdownEntry, 'financeCategory' | 'stripeType'> | Pick<PlatformWalletEntry, 'transactionType' | 'stripeCostFinanceCategory' | 'stripeType'>): string {
  if ('transactionType' in event) {
    if (event.transactionType === 'teacher_payout_fee') return 'Payout fee'
    if (event.transactionType === 'teacher_account_fee') return 'Koszt konta'
    if (event.stripeCostFinanceCategory === 'other_stripe_credit') return 'Stripe credit'
    if (event.stripeCostFinanceCategory === 'other_stripe_cost') return 'Stripe fee'
    if (event.stripeType === 'payout') return 'Payout fee'
    return 'Connect fee'
  }
  if (event.financeCategory === 'other_stripe_credit') return 'Stripe credit'
  if (event.financeCategory === 'other_stripe_cost') return 'Stripe fee'
  if (event.stripeType === 'payout') return 'Payout fee'
  return 'Connect fee'
}

function stripeCostAmount(event: PlatformStripeCostBreakdownEntry): number {
  return event.financeCategory === 'other_stripe_credit'
    ? Math.abs(event.netGrosze || event.amountGrosze)
    : -Math.abs(event.netGrosze || event.amountGrosze || event.feeGrosze)
}

function baseStripeCostWalletEntry(event: PlatformStripeCostBreakdownEntry): PlatformWalletEntry {
  return {
    id: `stripe-cost:${event.stripeBalanceTransactionId ?? event.id}`,
    transactionType: 'stripe_connect_fee',
    stripeBalanceTransactionId: event.stripeBalanceTransactionId,
    stripeType: event.stripeType,
    stripeDescription: event.description,
    stripeSource: event.source,
    stripeCostFinanceCategory: event.financeCategory,
    stripeChargeId: event.stripeChargeId,
    stripePaymentIntentId: event.stripePaymentIntentId,
    countsAsPaidVolume: false,
    topic: stripeCostTopic(event),
    date: typeof event.createdAt === 'number'
      ? new Date(event.createdAt).toLocaleDateString('pl-PL', { day: 'numeric', month: 'short', year: 'numeric' })
      : 'Stripe / Connect',
    grossGrosze: stripeCostAmount(event),
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

export function buildStripeCostWalletEntry(event: PlatformStripeCostBreakdownEntry, context: PayoutCostContext = {}): PlatformWalletEntry {
  const base = baseStripeCostWalletEntry(event)
  const payout = event.source
    ? context.payouts?.find((item) => item.stripePayoutId === event.source)
    : undefined
  if (event.stripeType === 'payout' && payout) {
    const teacher = context.teachers?.find((item) => item.id === payout.teacherId)
    return {
      ...base,
      transactionType: 'teacher_payout_fee',
      teacherName: teacher?.name,
      teacherId: payout.teacherId,
    }
  }

  const connectedAccountTeacher = event.source
    ? context.teachers?.find((teacher) => teacher.stripe?.accountId === event.source)
    : undefined
  if (connectedAccountTeacher) {
    return {
      ...base,
      transactionType: 'teacher_account_fee',
      teacherName: connectedAccountTeacher.name,
      teacherId: connectedAccountTeacher.id,
    }
  }

  return base
}

function attributionIds(event: PlatformStripeCostBreakdownEntry): string[] {
  return [
    event.stripeChargeId,
    event.stripePaymentIntentId,
    event.source?.startsWith('ch_') || event.source?.startsWith('pi_') ? event.source : undefined,
  ].filter((value): value is string => Boolean(value))
}

function matchingPaymentEntry(event: PlatformStripeCostBreakdownEntry, entries: PlatformWalletEntry[]): PlatformWalletEntry | undefined {
  const ids = attributionIds(event)
  if (ids.length === 0) return undefined
  return entries.find((entry) => (
    entry.transactionType !== 'refund' &&
    entry.transactionType !== 'stripe_connect_fee' &&
    entry.transactionType !== 'teacher_payout_fee' &&
    entry.transactionType !== 'teacher_account_fee' &&
    ((entry.stripeChargeId && ids.includes(entry.stripeChargeId)) ||
      (entry.stripePaymentIntentId && ids.includes(entry.stripePaymentIntentId)))
  ))
}

export function mergeAndSortPlatformWalletEntries(
  entries: PlatformWalletEntry[],
  stripeCostEvents: PlatformStripeCostBreakdownEntry[],
  context: PayoutCostContext = {},
): PlatformWalletEntry[] {
  const mergedById = new Map(entries.map((entry) => [entry.id, { ...entry, attributedStripeCosts: [...(entry.attributedStripeCosts ?? [])] }]))
  const unattributed: PlatformWalletEntry[] = []

  for (const event of stripeCostEvents) {
    const paymentEntry = matchingPaymentEntry(event, [...mergedById.values()])
    if (paymentEntry) {
      const current = mergedById.get(paymentEntry.id)!
      const amountGrosze = stripeCostAmount(event)
      current.attributedStripeCosts = [
        ...(current.attributedStripeCosts ?? []),
        {
          id: event.stripeBalanceTransactionId ?? event.id,
          label: stripeCostTransactionLabel(event),
          amountGrosze,
          stripeBalanceTransactionId: event.stripeBalanceTransactionId,
          stripeType: event.stripeType,
          description: event.description,
          source: event.source,
        },
      ]
      current.assignedStripeCostGrosze = (current.assignedStripeCostGrosze ?? 0) + amountGrosze
      if (typeof current.netPlatformRevenueGrosze === 'number') {
        current.netAfterAssignedCostsGrosze = current.netPlatformRevenueGrosze + amountGrosze
      }
      mergedById.set(current.id, current)
    } else {
      unattributed.push(buildStripeCostWalletEntry(event, context))
    }
  }

  return [...mergedById.values(), ...unattributed].sort((a, b) => b.createdAt - a.createdAt)
}
