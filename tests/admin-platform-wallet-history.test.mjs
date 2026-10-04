import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { computePlatformFinance } from '../lib/stripe-financial-metrics.ts'

const routeSource = readFileSync(new URL('../app/api/admin/platform-wallet/route.ts', import.meta.url), 'utf8')
const uiSource = readFileSync(new URL('../components/admin/admin-platform-wallet.tsx', import.meta.url), 'utf8')

test('admin payment history does not merge global Stripe or Connect costs into entries', () => {
  assert.equal(routeSource.includes('mergeAndSortPlatformWalletEntries'), false)
  assert.equal(routeSource.includes('stripeCostBreakdown'), false)
  assert.equal(routeSource.includes("transactionType: 'stripe_connect_fee'"), false)
  assert.equal(routeSource.includes("transactionType: 'teacher_account_fee'"), false)
  assert.equal(routeSource.includes("transactionType: 'teacher_payout_fee'"), false)
})

test('admin payment history is compact and omits global Stripe fee event labels', () => {
  assert.equal(uiSource.includes('Ostatnie płatności'), true)
  assert.equal(uiSource.includes('Ostatnie płatności i koszty'), false)
  assert.equal(uiSource.includes('Active Account Billing'), false)
  assert.equal(uiSource.includes('Payout Fee'), false)
  assert.equal(uiSource.includes('Account Volume Billing'), false)
  assert.equal(uiSource.includes('Balance transaction:'), false)
  assert.equal(uiSource.includes('type:'), false)
  assert.equal(uiSource.includes('Rozliczenie'), false)
})

test('admin payment history keeps payment processing fee and transaction net labels', () => {
  assert.equal(uiSource.includes('Stripe / netto transakcji'), true)
  assert.equal(uiSource.includes('Stripe:'), true)
  assert.equal(uiSource.includes('Netto transakcji'), true)
})

test('refunds remain visible as payment history entries', () => {
  assert.equal(routeSource.includes("transactionType: 'refund'"), true)
  assert.equal(uiSource.includes('Refund'), true)
})

test('global Connect and payout costs still reduce Runbee net outside payment history', () => {
  const result = computePlatformFinance({
    lessons: [{
      paymentStatus: 'paid',
      priceGrosze: 8000,
      platformFeeGrosze: 400,
      teacherAmountGrosze: 7600,
      stripeFeeGrosze: 228,
    }],
    events: [
      {
        type: 'other',
        amountGrosze: -900,
        feeGrosze: 0,
        netGrosze: -900,
        financeCategory: 'connect_payout_fee',
        description: 'Active Account Billing',
      },
      {
        type: 'other',
        amountGrosze: -135,
        feeGrosze: 135,
        netGrosze: -135,
        financeCategory: 'connect_payout_fee',
        description: 'Payout Fee',
      },
      {
        type: 'other',
        amountGrosze: -19,
        feeGrosze: 0,
        netGrosze: -19,
        financeCategory: 'connect_payout_fee',
        description: 'Account Volume Billing',
      },
    ],
  })

  assert.equal(result.connectPayoutFeesGrosze, 1054)
  assert.equal(result.netPlatformRevenueGrosze, -882)
})
