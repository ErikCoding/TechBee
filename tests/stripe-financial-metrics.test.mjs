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
