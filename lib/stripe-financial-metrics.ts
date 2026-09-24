export type FinancialLesson = {
  id?: string
  paymentStatus?: 'paid' | 'refunded' | 'failed'
  platformFeeGrosze?: number
  teacherAmountGrosze?: number
  priceGrosze?: number
  stripeFeeGrosze?: number
  stripeTransferId?: string
}

export type StripeFinancialEventLike = {
  type: 'refund' | 'adjustment' | 'transfer_reversal' | 'application_fee' | 'application_fee_refund' | 'other'
  amountGrosze: number
  feeGrosze: number
  netGrosze: number
  stripeChargeId?: string
  stripePaymentIntentId?: string
  chargeAmountGrosze?: number
  chargeFeeGrosze?: number
  chargeNetGrosze?: number
}

function finite(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

function refundGroupKey(event: StripeFinancialEventLike, index: number): string {
  return event.stripeChargeId || event.stripePaymentIntentId || `event:${index}`
}

export function computeRefundCostGrosze(events: StripeFinancialEventLike[]): number {
  const groups = new Map<string, {
    refundAmount: number
    refundNet: number
    chargeAmount?: number
    chargeNet?: number
  }>()

  const refundEvents = events.filter((item) => item.type === 'refund')
  for (let index = 0; index < refundEvents.length; index += 1) {
    const event = refundEvents[index]
    const key = refundGroupKey(event, index)
    const current = groups.get(key) ?? { refundAmount: 0, refundNet: 0 }
    current.refundAmount += Math.abs(event.amountGrosze)
    current.refundNet += event.netGrosze
    if (finite(event.chargeAmountGrosze)) current.chargeAmount = event.chargeAmountGrosze
    if (finite(event.chargeNetGrosze)) current.chargeNet = event.chargeNetGrosze
    groups.set(key, current)
  }

  let total = 0
  for (const group of groups.values()) {
    const fullRefund = finite(group.chargeAmount) && group.refundAmount >= group.chargeAmount
    if (fullRefund && finite(group.chargeNet)) {
      total += Math.max(0, -(group.chargeNet + group.refundNet))
    } else {
      total += group.refundAmount
    }
  }
  return total
}

export function computePlatformFinance(input: {
  lessons: FinancialLesson[]
  events: StripeFinancialEventLike[]
}): {
  grossPlatformCommissionGrosze: number
  stripeProcessingFeesGrosze: number
  stripeFeesComplete: boolean
  stripeFeesMissingCount: number
  refundAmountGrosze: number
  refundCostGrosze: number
  refundCount: number
  stripeAdjustmentsGrosze: number
  netPlatformRevenueGrosze: number | null
  teacherAmountGrosze: number
  teacherTransferredGrosze: number
  paidVolumeGrosze: number
} {
  const paid = input.lessons.filter((lesson) => lesson.paymentStatus === 'paid')
  const knownFeePaid = paid.filter((lesson) => finite(lesson.stripeFeeGrosze))
  const stripeFeesMissingCount = paid.length - knownFeePaid.length
  const stripeFeesComplete = stripeFeesMissingCount === 0
  const grossPlatformCommissionGrosze = paid.reduce((sum, lesson) => sum + (lesson.platformFeeGrosze ?? 0), 0)
  const stripeProcessingFeesGrosze = knownFeePaid.reduce((sum, lesson) => sum + (lesson.stripeFeeGrosze ?? 0), 0)
  const refundEvents = input.events.filter((event) => event.type === 'refund')
  const refundAmountGrosze = refundEvents.reduce((sum, event) => sum + Math.abs(event.amountGrosze), 0)
  const refundCostGrosze = computeRefundCostGrosze(refundEvents)
  const stripeAdjustmentsGrosze = input.events
    .filter((event) => event.type !== 'refund')
    .reduce((sum, event) => sum + event.netGrosze, 0)

  return {
    grossPlatformCommissionGrosze,
    stripeProcessingFeesGrosze,
    stripeFeesComplete,
    stripeFeesMissingCount,
    refundAmountGrosze,
    refundCostGrosze,
    refundCount: refundEvents.length,
    stripeAdjustmentsGrosze,
    netPlatformRevenueGrosze: stripeFeesComplete
      ? grossPlatformCommissionGrosze - stripeProcessingFeesGrosze - refundCostGrosze + stripeAdjustmentsGrosze
      : null,
    teacherAmountGrosze: paid.reduce((sum, lesson) => sum + (lesson.teacherAmountGrosze ?? 0), 0),
    teacherTransferredGrosze: paid.filter((lesson) => lesson.stripeTransferId).reduce((sum, lesson) => sum + (lesson.teacherAmountGrosze ?? 0), 0),
    paidVolumeGrosze: paid.reduce((sum, lesson) => sum + (lesson.priceGrosze ?? 0), 0),
  }
}
