import assert from 'node:assert/strict'
import test from 'node:test'
import { computePlatformFinance, computeRefundCostGrosze } from '../lib/stripe-financial-metrics.ts'

test('full refund without a lesson counts only the unrecovered processing fee as refund cost', () => {
  const refundEvents = [{
    type: 'refund',
    amountGrosze: -500,
    feeGrosze: 0,
    netGrosze: -500,
    stripeChargeId: 'ch_test',
    chargeAmountGrosze: 500,
    chargeFeeGrosze: 108,
    chargeNetGrosze: 392,
  }]

  assert.equal(computeRefundCostGrosze(refundEvents), 108)
})

test('partial refund remains a refund cost while the original lesson stays paid', () => {
  const result = computePlatformFinance({
    lessons: [{
      paymentStatus: 'paid',
      priceGrosze: 10000,
      platformFeeGrosze: 800,
      teacherAmountGrosze: 9200,
      stripeFeeGrosze: 300,
    }],
    events: [{
      type: 'refund',
      amountGrosze: -2000,
      feeGrosze: 0,
      netGrosze: -2000,
      stripeChargeId: 'ch_partial',
      chargeAmountGrosze: 10000,
      chargeFeeGrosze: 300,
      chargeNetGrosze: 9700,
    }],
  })

  assert.equal(result.refundAmountGrosze, 2000)
  assert.equal(result.refundCostGrosze, 2000)
  assert.equal(result.netPlatformRevenueGrosze, -1500)
  assert.equal(result.netPlatformRevenuePartial, false)
})

test('refund without lesson is included in platform refund totals', () => {
  const result = computePlatformFinance({
    lessons: [],
    events: [{
      type: 'refund',
      amountGrosze: -500,
      feeGrosze: 0,
      netGrosze: -500,
      stripeChargeId: 'ch_legacy',
      chargeAmountGrosze: 500,
      chargeFeeGrosze: 108,
      chargeNetGrosze: 392,
    }],
  })

  assert.equal(result.refundAmountGrosze, 500)
  assert.equal(result.refundCostGrosze, 108)
  assert.equal(result.netPlatformRevenueGrosze, -108)
  assert.equal(result.netPlatformRevenuePartial, false)
})

test('does not double-count charge fee for full refund groups', () => {
  const result = computePlatformFinance({
    lessons: [{
      paymentStatus: 'paid',
      priceGrosze: 8000,
      platformFeeGrosze: 400,
      teacherAmountGrosze: 7600,
      stripeFeeGrosze: 228,
    }],
    events: [{
      type: 'refund',
      amountGrosze: -500,
      feeGrosze: 0,
      netGrosze: -500,
      stripeChargeId: 'ch_legacy',
      chargeAmountGrosze: 500,
      chargeFeeGrosze: 108,
      chargeNetGrosze: 392,
    }],
  })

  assert.equal(result.grossPlatformCommissionGrosze, 400)
  assert.equal(result.stripeProcessingFeesGrosze, 228)
  assert.equal(result.refundCostGrosze, 108)
  assert.equal(result.netPlatformRevenueGrosze, 64)
  assert.equal(result.netPlatformRevenuePartial, false)
})

test('normal paid lesson without refund uses platform commission minus processing fee', () => {
  const result = computePlatformFinance({
    lessons: [{
      paymentStatus: 'paid',
      priceGrosze: 8000,
      platformFeeGrosze: 400,
      teacherAmountGrosze: 7600,
      stripeFeeGrosze: 228,
    }],
    events: [],
  })

  assert.equal(result.refundAmountGrosze, 0)
  assert.equal(result.refundCostGrosze, 0)
  assert.equal(result.netPlatformRevenueGrosze, 172)
  assert.equal(result.netPlatformRevenuePartial, false)
})

test('missing Stripe fee still returns a known partial Runbee net amount', () => {
  const result = computePlatformFinance({
    lessons: [
      {
        paymentStatus: 'paid',
        priceGrosze: 10000,
        platformFeeGrosze: 800,
        teacherAmountGrosze: 9200,
        stripeFeeGrosze: 228,
      },
      {
        paymentStatus: 'paid',
        priceGrosze: 10000,
        platformFeeGrosze: 800,
        teacherAmountGrosze: 9200,
      },
    ],
    events: [{
      type: 'refund',
      amountGrosze: -500,
      feeGrosze: 0,
      netGrosze: -500,
      stripeChargeId: 'ch_refund',
      chargeAmountGrosze: 500,
      chargeFeeGrosze: 108,
      chargeNetGrosze: 392,
    }],
  })

  assert.equal(result.knownPlatformCommissionGrosze, 800)
  assert.equal(result.stripeProcessingFeesGrosze, 228)
  assert.equal(result.refundCostGrosze, 108)
  assert.equal(result.netPlatformRevenueGrosze, 464)
  assert.equal(result.netPlatformRevenuePartial, true)
  assert.equal(result.stripeFeesMissingCount, 1)
})

test('confirmed Connect and payout fees reduce Runbee net without counting teacher transfer principal', () => {
  const result = computePlatformFinance({
    lessons: [{
      paymentStatus: 'paid',
      priceGrosze: 10000,
      platformFeeGrosze: 800,
      teacherAmountGrosze: 9200,
      stripeFeeGrosze: 228,
    }],
    events: [
      {
        type: 'other',
        amountGrosze: -9200,
        feeGrosze: 123,
        netGrosze: -123,
        financeCategory: 'connect_payout_fee',
      },
      {
        type: 'other',
        amountGrosze: -900,
        feeGrosze: 0,
        netGrosze: -900,
        financeCategory: 'other_stripe_cost',
      },
    ],
  })

  assert.equal(result.connectPayoutFeesGrosze, 123)
  assert.equal(result.otherStripeCostsGrosze, 900)
  assert.equal(result.netPlatformRevenueGrosze, -451)
})

test('uncategorized Stripe balance events are not counted as Runbee costs to avoid double counting', () => {
  const result = computePlatformFinance({
    lessons: [{
      paymentStatus: 'paid',
      priceGrosze: 10000,
      platformFeeGrosze: 800,
      teacherAmountGrosze: 9200,
      stripeFeeGrosze: 228,
    }],
    events: [{
      type: 'other',
      amountGrosze: -9200,
      feeGrosze: 0,
      netGrosze: -9200,
    }],
  })

  assert.equal(result.connectPayoutFeesGrosze, 0)
  assert.equal(result.otherStripeCostsGrosze, 0)
  assert.equal(result.netPlatformRevenueGrosze, 572)
})

test('single charge and package purchase are counted once while package-funded lesson does not double-count paid volume', () => {
  const result = computePlatformFinance({
    lessons: [
      {
        paymentStatus: 'paid',
        paymentSource: 'stripe_checkout',
        priceGrosze: 10000,
        platformFeeGrosze: 800,
        teacherAmountGrosze: 9200,
        stripeFeeGrosze: 300,
      },
      {
        paymentStatus: 'paid',
        paymentSource: 'package',
        packageId: 'pkg_5',
        packageCreditState: 'used',
        priceGrosze: 10000,
        platformFeeGrosze: 800,
        teacherAmountGrosze: 9200,
      },
    ],
    packages: [{
      id: 'pkg_5',
      packageSize: 5,
      status: 'active',
      totalPriceGrosze: 50000,
      remainingCredits: 4,
      reservedCredits: 0,
      usedCredits: 1,
      perLessonGrossGrosze: 10000,
      platformFeePerLessonGrosze: 800,
      teacherAmountPerLessonGrosze: 9200,
      stripeFeeGrosze: 1200,
    }],
    events: [],
  })

  assert.equal(result.paidVolumeGrosze, 60000)
  assert.equal(result.packagePurchaseVolumeGrosze, 50000)
  assert.equal(result.packageDeferredGrossGrosze, 40000)
  assert.equal(result.packageUsedGrossGrosze, 10000)
  assert.equal(result.grossPlatformCommissionGrosze, 1600)
  assert.equal(result.knownPlatformCommissionGrosze, 1600)
  assert.equal(result.netPlatformRevenueGrosze, 100)
  assert.equal(result.netPlatformRevenuePartial, false)
})

test('package purchase 10 is classified as one real charge with deferred credits', () => {
  const result = computePlatformFinance({
    lessons: [],
    packages: [{
      packageSize: 10,
      status: 'active',
      totalPriceGrosze: 120000,
      remainingCredits: 10,
      reservedCredits: 0,
      usedCredits: 0,
      perLessonGrossGrosze: 12000,
      platformFeePerLessonGrosze: 960,
      teacherAmountPerLessonGrosze: 11040,
    }],
    events: [],
  })

  assert.equal(result.paidVolumeGrosze, 120000)
  assert.equal(result.packagePurchaseVolumeGrosze, 120000)
  assert.equal(result.packageDeferredGrossGrosze, 120000)
  assert.equal(result.grossPlatformCommissionGrosze, 0)
  assert.equal(result.netPlatformRevenuePartial, true)
})

test('historical commission snapshots keep 5 percent and 8 percent amounts', () => {
  const result = computePlatformFinance({
    lessons: [
      {
        paymentStatus: 'paid',
        priceGrosze: 10000,
        platformFeeGrosze: 500,
        teacherAmountGrosze: 9500,
        stripeFeeGrosze: 300,
      },
      {
        paymentStatus: 'paid',
        priceGrosze: 10000,
        platformFeeGrosze: 800,
        teacherAmountGrosze: 9200,
        stripeFeeGrosze: 300,
      },
    ],
    events: [],
  })

  assert.equal(result.grossPlatformCommissionGrosze, 1300)
  assert.equal(result.teacherAmountGrosze, 18700)
  assert.equal(result.knownPlatformCommissionGrosze, 1300)
  assert.equal(result.netPlatformRevenueGrosze, 700)
  assert.equal(result.netPlatformRevenuePartial, false)
})

test('idempotent webhook storage is represented by one event per balance transaction id', () => {
  const uniqueByBalanceTransaction = new Map()
  for (const event of [
    { stripeBalanceTransactionId: 'txn_1', type: 'refund', amountGrosze: -500, feeGrosze: 0, netGrosze: -500, stripeChargeId: 'ch_1', chargeAmountGrosze: 500, chargeNetGrosze: 392 },
    { stripeBalanceTransactionId: 'txn_1', type: 'refund', amountGrosze: -500, feeGrosze: 0, netGrosze: -500, stripeChargeId: 'ch_1', chargeAmountGrosze: 500, chargeNetGrosze: 392 },
  ]) {
    uniqueByBalanceTransaction.set(event.stripeBalanceTransactionId, event)
  }

  assert.equal(computeRefundCostGrosze([...uniqueByBalanceTransaction.values()]), 108)
})
