import assert from 'node:assert/strict'
import test from 'node:test'
import { buildStripeCostWalletEntry, mergeAndSortPlatformWalletEntries, stripeCostTransactionLabel } from '../lib/admin-platform-wallet-history.ts'

test('Active Account Billing appears as a separate Stripe/Connect event row', () => {
  const entry = buildStripeCostWalletEntry({
    id: 'txn_active',
    stripeBalanceTransactionId: 'txn_active',
    financeCategory: 'connect_payout_fee',
    stripeType: 'stripe_fee',
    description: 'Active Account Billing',
    source: 'fee_active',
    amountGrosze: -900,
    feeGrosze: 0,
    netGrosze: -900,
    createdAt: Date.parse('2026-09-30T10:00:00.000Z'),
  })

  assert.equal(entry.transactionType, 'stripe_connect_fee')
  assert.equal(entry.topic, 'Active Account Billing')
  assert.equal(entry.grossGrosze, -900)
  assert.equal(entry.lessonId, undefined)
  assert.equal(stripeCostTransactionLabel(entry), 'Connect fee')
})

test('Payout Fee appears as a separate payout fee row', () => {
  const entry = buildStripeCostWalletEntry({
    id: 'txn_payout',
    stripeBalanceTransactionId: 'txn_payout',
    financeCategory: 'connect_payout_fee',
    stripeType: 'payout',
    description: 'Payout Fee',
    source: 'po_123',
    amountGrosze: -135,
    feeGrosze: 135,
    netGrosze: -135,
    createdAt: Date.parse('2026-09-30T11:00:00.000Z'),
  })

  assert.equal(entry.transactionType, 'stripe_connect_fee')
  assert.equal(entry.topic, 'Payout Fee')
  assert.equal(entry.grossGrosze, -135)
  assert.equal(stripeCostTransactionLabel(entry), 'Payout fee')
})

test('Account Volume Billing appears as a separate global Stripe fee row', () => {
  const entry = buildStripeCostWalletEntry({
    id: 'txn_volume',
    stripeBalanceTransactionId: 'txn_volume',
    financeCategory: 'connect_payout_fee',
    stripeType: 'stripe_fee',
    description: 'Account Volume Billing',
    source: 'fee_volume',
    amountGrosze: -19,
    feeGrosze: 0,
    netGrosze: -19,
    createdAt: Date.parse('2026-09-30T12:00:00.000Z'),
  })

  assert.equal(entry.transactionType, 'stripe_connect_fee')
  assert.equal(entry.topic, 'Account Volume Billing')
  assert.equal(entry.grossGrosze, -19)
})

test('global Stripe fee rows do not look attributable to a lesson', () => {
  const entry = buildStripeCostWalletEntry({
    id: 'txn_global',
    financeCategory: 'connect_payout_fee',
    stripeType: 'stripe_fee',
    description: 'Active Account Billing',
    amountGrosze: -900,
    feeGrosze: 0,
    netGrosze: -900,
    createdAt: Date.parse('2026-09-30T10:00:00.000Z'),
  })

  assert.equal(entry.lessonId, undefined)
  assert.equal(entry.teacherName, undefined)
  assert.equal(entry.studentName, undefined)
  assert.equal(entry.countsAsPaidVolume, false)
})

test('payments, refunds and Stripe/Connect costs are sorted together by timestamp', () => {
  const entries = mergeAndSortPlatformWalletEntries([
    {
      id: 'lesson:older',
      transactionType: 'single_lesson',
      countsAsPaidVolume: true,
      topic: 'Lekcja',
      date: '29 wrz',
      grossGrosze: 8000,
      platformFeeGrosze: 400,
      teacherAmountGrosze: 7600,
      status: 'paid',
      settlementStatus: 'waiting_lesson',
      transferStatus: 'pending',
      createdAt: Date.parse('2026-09-29T10:00:00.000Z'),
    },
    {
      id: 'refund:middle',
      transactionType: 'refund',
      countsAsPaidVolume: false,
      topic: 'Zwrot Stripe',
      date: '30 wrz',
      grossGrosze: 500,
      platformFeeGrosze: 0,
      teacherAmountGrosze: 0,
      status: 'refunded',
      settlementStatus: 'refunded',
      transferStatus: 'refunded',
      createdAt: Date.parse('2026-09-30T10:00:00.000Z'),
    },
  ], [{
    id: 'txn_newest',
    financeCategory: 'connect_payout_fee',
    stripeType: 'stripe_fee',
    description: 'Active Account Billing',
    amountGrosze: -900,
    feeGrosze: 0,
    netGrosze: -900,
    createdAt: Date.parse('2026-10-01T10:00:00.000Z'),
  }])

  assert.deepEqual(entries.map((entry) => entry.id), ['stripe-cost:txn_newest', 'refund:middle', 'lesson:older'])
})
