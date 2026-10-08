export type FinancialLesson = {
  id?: string
  paymentStatus?: 'paid' | 'refunded' | 'failed'
  lessonKind?: 'regular' | 'trial'
  paymentSource?: 'stripe_checkout' | 'package'
  packageId?: string
  packageCreditState?: 'reserved' | 'used' | 'returned'
  platformFeeGrosze?: number
  teacherAmountGrosze?: number
  priceGrosze?: number
  subtotalGrosze?: number
  studentServiceFeeGrosze?: number
  studentTotalGrosze?: number
  stripeFeeGrosze?: number
  stripeTransferId?: string
}

export type FinancialLessonPackage = {
  id?: string
  packageSize: 5 | 10
  status?: 'active' | 'exhausted' | 'cancelled' | 'refunded' | 'refund_review'
  totalPriceGrosze?: number
  subtotalGrosze?: number
  studentServiceFeeGrosze?: number
  studentTotalGrosze?: number
  remainingCredits?: number
  reservedCredits?: number
  usedCredits?: number
  perLessonGrossGrosze?: number
  platformFeePerLessonGrosze?: number
  teacherAmountPerLessonGrosze?: number
  stripeFeeGrosze?: number
}

export type StripeFinancialEventLike = {
  type: 'refund' | 'adjustment' | 'transfer_reversal' | 'application_fee' | 'application_fee_refund' | 'other'
  amountGrosze: number
  feeGrosze: number
  netGrosze: number
  financeCategory?: 'connect_payout_fee' | 'other_stripe_cost' | 'other_stripe_credit'
  stripeBalanceTransactionId?: string
  stripeType?: string
  description?: string
  source?: string
  createdAt?: number
  stripeChargeId?: string
  stripePaymentIntentId?: string
  chargeAmountGrosze?: number
  chargeFeeGrosze?: number
  chargeNetGrosze?: number
}

function finite(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

function lessonSubtotalGrosze(lesson: FinancialLesson): number {
  return lesson.subtotalGrosze ?? lesson.priceGrosze ?? 0
}

function lessonStudentTotalGrosze(lesson: FinancialLesson): number {
  return lesson.studentTotalGrosze ?? lessonSubtotalGrosze(lesson) + (lesson.studentServiceFeeGrosze ?? 0)
}

function packageSubtotalGrosze(pkg: FinancialLessonPackage): number {
  return pkg.subtotalGrosze ?? pkg.totalPriceGrosze ?? 0
}

function packageStudentTotalGrosze(pkg: FinancialLessonPackage): number {
  return pkg.studentTotalGrosze ?? packageSubtotalGrosze(pkg) + (pkg.studentServiceFeeGrosze ?? 0)
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
  packages?: FinancialLessonPackage[]
  events: StripeFinancialEventLike[]
}): {
  grossPlatformCommissionGrosze: number
  grossPlatformServiceFeeGrosze: number
  knownPlatformCommissionGrosze: number
  knownPlatformServiceFeeGrosze: number
  stripeProcessingFeesGrosze: number
  stripeFeesComplete: boolean
  stripeFeesMissingCount: number
  refundAmountGrosze: number
  refundCostGrosze: number
  refundCount: number
  stripeAdjustmentsGrosze: number
  connectPayoutFeesGrosze: number
  otherStripeCostsGrosze: number
  otherStripeCreditsGrosze: number
  netPlatformRevenueGrosze: number
  netPlatformRevenuePartial: boolean
  teacherAmountGrosze: number
  teacherTransferredGrosze: number
  paidVolumeGrosze: number
  packagePurchaseVolumeGrosze: number
  packageDeferredGrossGrosze: number
  packageReservedGrossGrosze: number
  packageUsedGrossGrosze: number
} {
  const paid = input.lessons.filter((lesson) => lesson.paymentStatus === 'paid')
  const paidChargeLessons = paid.filter((lesson) => lesson.paymentSource !== 'package')
  const paidPackageLessons = paid.filter((lesson) => lesson.paymentSource === 'package')
  const usedPackageLessons = paidPackageLessons.filter((lesson) => lesson.packageCreditState === 'used')
  const packages = (input.packages ?? []).filter((pkg) => pkg.status !== 'refunded')
  const knownFeeChargeLessons = paidChargeLessons.filter((lesson) => finite(lesson.stripeFeeGrosze))
  const knownFeePackages = packages.filter((pkg) => finite(pkg.stripeFeeGrosze))
  const knownFeePackageIds = new Set(knownFeePackages.map((pkg) => pkg.id).filter((id): id is string => typeof id === 'string' && id.length > 0))
  const knownFeePackageLessons = usedPackageLessons.filter((lesson) => typeof lesson.packageId === 'string' && knownFeePackageIds.has(lesson.packageId))
  const stripeFeesMissingCount = (paidChargeLessons.length - knownFeeChargeLessons.length) + (packages.length - knownFeePackages.length)
  const stripeFeesComplete = stripeFeesMissingCount === 0
  const grossPlatformCommissionGrosze = [...paidChargeLessons, ...usedPackageLessons].reduce((sum, lesson) => sum + (lesson.platformFeeGrosze ?? 0), 0)
  const knownPlatformCommissionGrosze = [...knownFeeChargeLessons, ...knownFeePackageLessons].reduce((sum, lesson) => sum + (lesson.platformFeeGrosze ?? 0), 0)
  const grossPlatformServiceFeeGrosze = paidChargeLessons.reduce((sum, lesson) => sum + (lesson.studentServiceFeeGrosze ?? 0), 0)
    + packages.reduce((sum, pkg) => sum + (pkg.studentServiceFeeGrosze ?? 0), 0)
  const knownPlatformServiceFeeGrosze = knownFeeChargeLessons.reduce((sum, lesson) => sum + (lesson.studentServiceFeeGrosze ?? 0), 0)
    + knownFeePackages.reduce((sum, pkg) => sum + (pkg.studentServiceFeeGrosze ?? 0), 0)
  const stripeProcessingFeesGrosze = knownFeeChargeLessons.reduce((sum, lesson) => sum + (lesson.stripeFeeGrosze ?? 0), 0)
    + knownFeePackages.reduce((sum, pkg) => sum + (pkg.stripeFeeGrosze ?? 0), 0)
  const refundEvents = input.events.filter((event) => event.type === 'refund')
  const refundAmountGrosze = refundEvents.reduce((sum, event) => sum + Math.abs(event.amountGrosze), 0)
  const refundCostGrosze = computeRefundCostGrosze(refundEvents)
  const connectPayoutFeesGrosze = input.events
    .filter((event) => event.financeCategory === 'connect_payout_fee')
    .reduce((sum, event) => sum + Math.abs(event.netGrosze || event.amountGrosze || event.feeGrosze), 0)
  const otherStripeCostsGrosze = input.events
    .filter((event) => event.financeCategory === 'other_stripe_cost')
    .reduce((sum, event) => sum + Math.abs(event.netGrosze || event.amountGrosze || event.feeGrosze), 0)
  const otherStripeCreditsGrosze = input.events
    .filter((event) => event.financeCategory === 'other_stripe_credit')
    .reduce((sum, event) => sum + Math.abs(event.netGrosze || event.amountGrosze), 0)
  const stripeAdjustmentsGrosze = otherStripeCreditsGrosze - connectPayoutFeesGrosze - otherStripeCostsGrosze

  return {
    grossPlatformCommissionGrosze,
    grossPlatformServiceFeeGrosze,
    knownPlatformCommissionGrosze,
    knownPlatformServiceFeeGrosze,
    stripeProcessingFeesGrosze,
    stripeFeesComplete,
    stripeFeesMissingCount,
    refundAmountGrosze,
    refundCostGrosze,
    refundCount: refundEvents.length,
    stripeAdjustmentsGrosze,
    connectPayoutFeesGrosze,
    otherStripeCostsGrosze,
    otherStripeCreditsGrosze,
    netPlatformRevenueGrosze: (stripeFeesComplete
      ? grossPlatformCommissionGrosze + grossPlatformServiceFeeGrosze
      : knownPlatformCommissionGrosze + knownPlatformServiceFeeGrosze)
      - stripeProcessingFeesGrosze
      - refundCostGrosze
      - connectPayoutFeesGrosze
      - otherStripeCostsGrosze
      + otherStripeCreditsGrosze,
    netPlatformRevenuePartial: !stripeFeesComplete,
    teacherAmountGrosze: paid.reduce((sum, lesson) => sum + (lesson.teacherAmountGrosze ?? 0), 0),
    teacherTransferredGrosze: paid.filter((lesson) => lesson.stripeTransferId).reduce((sum, lesson) => sum + (lesson.teacherAmountGrosze ?? 0), 0),
    paidVolumeGrosze: paidChargeLessons.reduce((sum, lesson) => sum + lessonStudentTotalGrosze(lesson), 0)
      + packages.reduce((sum, pkg) => sum + packageStudentTotalGrosze(pkg), 0),
    packagePurchaseVolumeGrosze: packages.reduce((sum, pkg) => sum + packageStudentTotalGrosze(pkg), 0),
    packageDeferredGrossGrosze: packages.reduce((sum, pkg) => sum + ((pkg.remainingCredits ?? 0) * (pkg.perLessonGrossGrosze ?? 0)), 0),
    packageReservedGrossGrosze: packages.reduce((sum, pkg) => sum + ((pkg.reservedCredits ?? 0) * (pkg.perLessonGrossGrosze ?? 0)), 0),
    packageUsedGrossGrosze: packages.reduce((sum, pkg) => sum + ((pkg.usedCredits ?? 0) * (pkg.perLessonGrossGrosze ?? 0)), 0),
  }
}
