import assert from 'node:assert/strict'
import test from 'node:test'
import { computeAdminPlatformRevenue } from '../lib/admin-revenue-metrics.ts'

const now = new Date('2026-09-24T12:00:00.000Z')
const currentMonth = new Date('2026-09-20T10:00:00.000Z').getTime()
const previousMonth = new Date('2026-08-20T10:00:00.000Z').getTime()

test('admin monthly revenue counts only paid live lessons in the current month', () => {
  const result = computeAdminPlatformRevenue([
    {
      paymentStatus: 'paid',
      livemode: true,
      priceGrosze: 8000,
      platformFeeGrosze: 400,
      teacherAmountGrosze: 7600,
      stripeFeeGrosze: 228,
      createdAt: currentMonth,
    },
    {
      paymentStatus: 'paid',
      livemode: false,
      priceGrosze: 15000,
      platformFeeGrosze: 1200,
      teacherAmountGrosze: 13800,
      stripeFeeGrosze: 500,
      createdAt: currentMonth,
    },
    {
      paymentStatus: 'paid',
      priceGrosze: 15000,
      platformFeeGrosze: 1200,
      teacherAmountGrosze: 13800,
      stripeFeeGrosze: 500,
      createdAt: currentMonth,
    },
    {
      paymentStatus: 'refunded',
      livemode: true,
      priceGrosze: 500,
      platformFeeGrosze: 25,
      teacherAmountGrosze: 475,
      stripeFeeGrosze: 108,
      createdAt: currentMonth,
    },
    {
      paymentStatus: 'pending',
      livemode: true,
      priceGrosze: 9000,
      platformFeeGrosze: 720,
      teacherAmountGrosze: 8280,
      stripeFeeGrosze: 250,
      createdAt: currentMonth,
    },
    {
      paymentStatus: 'unpaid',
      livemode: true,
      priceGrosze: 7000,
      platformFeeGrosze: 560,
      teacherAmountGrosze: 6440,
      stripeFeeGrosze: 240,
      createdAt: currentMonth,
    },
  ], now)

  assert.equal(result.monthlyRevenue, 80)
  assert.equal(result.monthlyNetRevenue, 1.72)
  assert.equal(result.monthlyNetRevenueComplete, true)

  const september = result.revenueChart.find((entry) => entry.month === 'Wrz')
  assert.equal(september?.amount, 80)
  assert.equal(september?.platformFee, 4)
  assert.equal(september?.teacherAmount, 76)
  assert.equal(september?.netPlatformRevenue, 1.72)
})

test('admin revenue comparison ignores previous-month sandbox and missing livemode lessons', () => {
  const result = computeAdminPlatformRevenue([
    {
      paymentStatus: 'paid',
      livemode: true,
      priceGrosze: 8000,
      platformFeeGrosze: 400,
      teacherAmountGrosze: 7600,
      stripeFeeGrosze: 228,
      createdAt: currentMonth,
    },
    {
      paymentStatus: 'paid',
      livemode: true,
      priceGrosze: 10000,
      platformFeeGrosze: 800,
      teacherAmountGrosze: 9200,
      stripeFeeGrosze: 300,
      createdAt: previousMonth,
    },
    {
      paymentStatus: 'paid',
      livemode: false,
      priceGrosze: 40000,
      platformFeeGrosze: 3200,
      teacherAmountGrosze: 36800,
      stripeFeeGrosze: 1000,
      createdAt: previousMonth,
    },
    {
      paymentStatus: 'paid',
      priceGrosze: 50000,
      platformFeeGrosze: 4000,
      teacherAmountGrosze: 46000,
      stripeFeeGrosze: 1200,
      createdAt: previousMonth,
    },
  ], now)

  assert.equal(result.monthlyRevenue, 80)
  assert.equal(result.revenueChange, -20)

  const august = result.revenueChart.find((entry) => entry.month === 'Sie')
  const september = result.revenueChart.find((entry) => entry.month === 'Wrz')
  assert.equal(august?.amount, 100)
  assert.equal(september?.amount, 80)
})
