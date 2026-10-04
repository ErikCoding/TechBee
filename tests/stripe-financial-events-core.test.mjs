import assert from 'node:assert/strict'
import test from 'node:test'
import { toPlatformStripeCostFinancialEvent } from '../lib/stripe-financial-events-core.ts'

test('processing charge balance transactions are skipped to avoid double counting Stripe fees', () => {
  const event = toPlatformStripeCostFinancialEvent({
    id: 'txn_charge',
    type: 'charge',
    amount: 8000,
    fee: 228,
    net: 7772,
  })

  assert.equal(event, null)
})

test('refund balance transactions are skipped because refund events are persisted separately', () => {
  const event = toPlatformStripeCostFinancialEvent({
    id: 'txn_refund',
    type: 'refund',
    amount: -8000,
    fee: 0,
    net: -8000,
  })

  assert.equal(event, null)
})

test('Connect payout fee keeps Stripe type, description and source for admin breakdown', () => {
  const event = toPlatformStripeCostFinancialEvent({
    id: 'txn_fee',
    type: 'stripe_fee',
    amount: -1054,
    fee: 0,
    net: -1054,
    created: 1790000000,
    description: 'Connect active account fee',
    source: 'fee_123',
  })

  assert.equal(event?.financeCategory, 'connect_payout_fee')
  assert.equal(event?.stripeBalanceTransactionId, 'txn_fee')
  assert.equal(event?.stripeType, 'stripe_fee')
  assert.equal(event?.description, 'Connect active account fee')
  assert.equal(event?.source, 'fee_123')
})

test('transfer principal is not counted as a Runbee cost, only confirmed transfer fee is', () => {
  const freeTransfer = toPlatformStripeCostFinancialEvent({
    id: 'txn_transfer_free',
    type: 'transfer',
    amount: -7600,
    fee: 0,
    net: -7600,
  })
  const transferFee = toPlatformStripeCostFinancialEvent({
    id: 'txn_transfer_fee',
    type: 'transfer',
    amount: -7600,
    fee: 123,
    net: -7723,
  })

  assert.equal(freeTransfer, null)
  assert.equal(transferFee?.financeCategory, 'connect_payout_fee')
  assert.equal(transferFee?.netGrosze, -123)
})
