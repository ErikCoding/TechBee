import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { buildAdminStatsFromRows, emptyAdminStats } from '../lib/admin-stats-core.ts'
import { computeAdminPlatformRevenue } from '../lib/admin-revenue-metrics.ts'

const now = new Date('2026-09-24T12:00:00.000Z')
const currentMonth = new Date('2026-09-20T10:00:00.000Z').getTime()

test('admin stats are built from backend rows and include real users and revenue chart data', () => {
  const users = [
      { role: 'student', createdAt: now.getTime() - 2 * 24 * 60 * 60 * 1000 },
      { role: 'teacher', createdAt: now.getTime() - 20 * 24 * 60 * 60 * 1000 },
      { role: 'parent', createdAt: now.getTime() - 1 * 24 * 60 * 60 * 1000 },
      { role: 'admin', createdAt: now.getTime() - 1 * 24 * 60 * 60 * 1000 },
    ]
  const lessons = [{
      paymentStatus: 'paid',
      livemode: true,
      priceGrosze: 8000,
      platformFeeGrosze: 400,
      teacherAmountGrosze: 7600,
      stripeFeeGrosze: 228,
      createdAt: currentMonth,
    }]
  const packages = []
  const stats = buildAdminStatsFromRows({
    now,
    users,
    teachers: [{ status: 'pending' }, { status: 'approved' }],
    revenue: computeAdminPlatformRevenue(lessons, now, packages),
  })

  assert.equal(stats.totalUsers, 4)
  assert.equal(stats.totalStudents, 1)
  assert.equal(stats.totalTeachers, 1)
  assert.equal(stats.newSignupsThisWeek, 3)
  assert.equal(stats.pendingVerifications, 1)
  assert.equal(stats.monthlyRevenue, 80)
  assert.equal(stats.revenueChart.find((entry) => entry.month === 'Wrz')?.amount, 80)
})

test('admin stats service uses the admin-only endpoint instead of browser Firestore getDocs', () => {
  const serviceSource = readFileSync(new URL('../services/admin.service.ts', import.meta.url), 'utf8')
  const routeSource = readFileSync(new URL('../app/api/admin/stats/route.ts', import.meta.url), 'utf8')
  const overviewSource = readFileSync(new URL('../components/admin/admin-overview-client.tsx', import.meta.url), 'utf8')

  assert.equal(serviceSource.includes("adminJson<{ stats: AdminStats }>('/api/admin/stats', 'POST')"), true)
  assert.equal(serviceSource.includes('getDocs(collection(db, collections.users))'), false)
  assert.equal(routeSource.includes('requireAdminRequest'), true)
  assert.equal(routeSource.includes('buildAdminStatsFromRows'), true)
  assert.equal(routeSource.includes('computeAdminPlatformRevenue'), true)
  assert.equal(overviewSource.includes('setStatsError'), true)
  assert.equal(overviewSource.includes('Nie pokazujemy zer jako prawdziwych danych'), true)
})

test('empty admin stats remain explicit SSR placeholders only', () => {
  const stats = emptyAdminStats(now)

  assert.equal(stats.totalUsers, 0)
  assert.equal(stats.monthlyRevenue, 0)
  assert.equal(stats.revenueChart.length, 6)
})
