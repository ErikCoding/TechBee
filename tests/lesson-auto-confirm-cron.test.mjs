import assert from 'node:assert/strict'
import test from 'node:test'
import { authorizeCronRequest, AUTO_CONFIRM_BATCH_SIZE, isLessonReleaseEligible, isReportAutoConfirmEligible, REPORT_AUTO_CONFIRM_MS, selectAutoConfirmCronBatch } from '../lib/lesson-report-auto-confirm.ts'
import { lessonTeacherTransferIdempotencyKey } from '../lib/lesson-release-core.ts'

const now = new Date('2026-09-24T12:00:00.000Z').getTime()

function lesson(patch = {}) {
  return {
    report: { topic: 'Algebra' },
    reportSubmittedAt: now - REPORT_AUTO_CONFIRM_MS - 1,
    paymentStatus: 'paid',
    paymentReleased: false,
    reportConfirmedAt: null,
    teacherAmountGrosze: 7600,
    ...patch,
  }
}

test('report younger than 24h is not auto-confirm eligible', () => {
  assert.equal(isReportAutoConfirmEligible(lesson({ reportSubmittedAt: now - REPORT_AUTO_CONFIRM_MS + 1 }), now), false)
})

test('report older than 24h is auto-confirm eligible', () => {
  assert.equal(isReportAutoConfirmEligible(lesson(), now), true)
})

test('cron batch selector does not fetch fresh reports under 24h', () => {
  const selected = selectAutoConfirmCronBatch([
    lesson({ reportSubmittedAt: now - REPORT_AUTO_CONFIRM_MS + 1 }),
    lesson({ reportSubmittedAt: now - REPORT_AUTO_CONFIRM_MS }),
  ], now)

  assert.equal(selected.length, 1)
  assert.equal(selected[0].reportSubmittedAt, now - REPORT_AUTO_CONFIRM_MS)
})

test('overdue report is a cron batch candidate', () => {
  assert.equal(selectAutoConfirmCronBatch([lesson()], now).length, 1)
})

test('cron batch selector respects the batch limit', () => {
  const rows = Array.from({ length: AUTO_CONFIRM_BATCH_SIZE + 5 }, (_, index) => lesson({
    reportSubmittedAt: now - REPORT_AUTO_CONFIRM_MS - 1 - index,
  }))

  assert.equal(selectAutoConfirmCronBatch(rows, now).length, AUTO_CONFIRM_BATCH_SIZE)
})

test('already confirmed report is skipped', () => {
  assert.equal(isReportAutoConfirmEligible(lesson({ reportConfirmedAt: now - 1_000 }), now), false)
})

test('already released payment is skipped', () => {
  assert.equal(isReportAutoConfirmEligible(lesson({ paymentReleased: true }), now), false)
  assert.equal(isLessonReleaseEligible(lesson({ paymentReleased: true })), false)
})

test('existing Stripe transfer is skipped', () => {
  assert.equal(isReportAutoConfirmEligible(lesson({ stripeTransferId: 'tr_123' }), now), false)
  assert.equal(isLessonReleaseEligible(lesson({ stripeTransferId: 'tr_123' })), false)
})

test('confirmed report after re-read is not release eligible', () => {
  assert.equal(isLessonReleaseEligible(lesson({ reportConfirmedAt: now - 1 })), false)
})

test('active dispute is skipped', () => {
  assert.equal(isReportAutoConfirmEligible(lesson({ dispute: { status: 'open' } }), now), false)
  assert.equal(isLessonReleaseEligible(lesson({ dispute: { status: 'open' } })), false)
})

test('dispute created between query and re-read blocks release', () => {
  assert.equal(isLessonReleaseEligible(lesson({ dispute: { status: 'open' } })), false)
})

test('unpaid or refunded reports are skipped', () => {
  assert.equal(isReportAutoConfirmEligible(lesson({ paymentStatus: 'unpaid' }), now), false)
  assert.equal(isReportAutoConfirmEligible(lesson({ paymentStatus: 'refunded' }), now), false)
  assert.equal(isLessonReleaseEligible(lesson({ paymentStatus: 'unpaid' })), false)
  assert.equal(isLessonReleaseEligible(lesson({ paymentStatus: 'refunded' })), false)
})

test('payment status changed between query and re-read blocks release', () => {
  assert.equal(isLessonReleaseEligible(lesson({ paymentStatus: 'refunded' })), false)
})

test('manual confirmation before 24h remains release eligible', () => {
  const fresh = lesson({ reportSubmittedAt: now - REPORT_AUTO_CONFIRM_MS + 1 })
  assert.equal(isReportAutoConfirmEligible(fresh, now), false)
  assert.equal(isLessonReleaseEligible(fresh), true)
})

test('cron auto-confirm requires the full 24h window', () => {
  assert.equal(isReportAutoConfirmEligible(lesson({ reportSubmittedAt: now - REPORT_AUTO_CONFIRM_MS + 1 }), now), false)
  assert.equal(isReportAutoConfirmEligible(lesson({ reportSubmittedAt: now - REPORT_AUTO_CONFIRM_MS }), now), true)
})

test('retry and concurrent release attempts share one Stripe idempotency key per lesson', () => {
  const first = lessonTeacherTransferIdempotencyKey('lesson_123')
  const retry = lessonTeacherTransferIdempotencyKey('lesson_123')
  const otherLesson = lessonTeacherTransferIdempotencyKey('lesson_456')

  assert.equal(first, retry)
  assert.notEqual(first, otherLesson)
  assert.equal(first, 'lesson:lesson_123:teacher-release:v1')
})

test('cron authorization requires configured CRON_SECRET and matching bearer token', () => {
  assert.deepEqual(authorizeCronRequest('Bearer secret', undefined), {
    ok: false,
    status: 503,
    error: 'CRON_SECRET is not configured.',
  })
  assert.deepEqual(authorizeCronRequest(null, 'secret'), {
    ok: false,
    status: 401,
    error: 'Unauthorized cron request.',
  })
  assert.deepEqual(authorizeCronRequest('Bearer wrong', 'secret'), {
    ok: false,
    status: 401,
    error: 'Unauthorized cron request.',
  })
  assert.deepEqual(authorizeCronRequest('Bearer secret', 'secret'), { ok: true })
})
