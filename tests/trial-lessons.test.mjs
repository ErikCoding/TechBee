import assert from 'node:assert/strict'
import test from 'node:test'
import {
  checkoutAutoRefundIdempotencyKey,
  normalizeLessonKind,
  resolveCheckoutLessonTermsWithOptions,
  resolveTeacherTrialLessonConfigWithOptions,
  studentHasConsumedTrialLesson,
  trialLessonConsumesEligibility,
} from '../lib/trial-lessons-core.ts'
import { LESSON_DURATION_OPTIONS } from '../lib/lesson-durations.ts'

const allowedDurations = LESSON_DURATION_OPTIONS.map((option) => option.minutes)

function resolveTeacherTrialLessonConfig(teacher) {
  return resolveTeacherTrialLessonConfigWithOptions(teacher, allowedDurations)
}

function resolveCheckoutLessonTerms(input) {
  return resolveCheckoutLessonTermsWithOptions({ ...input, allowedDurations })
}

test('legacy teachers without trial fields do not expose a trial lesson', () => {
  assert.deepEqual(resolveTeacherTrialLessonConfig({}), { enabled: false })
})

test('legacy lessons without lessonKind are treated as regular lessons', () => {
  assert.equal(normalizeLessonKind(undefined), 'regular')
  assert.equal(trialLessonConsumesEligibility({ paymentStatus: 'paid', status: 'completed' }), false)
})

test('regular lesson checkout keeps the existing server-computed price', () => {
  assert.deepEqual(
    resolveCheckoutLessonTerms({
      lessonKind: 'regular',
      requestedDuration: 60,
      regularPriceGrosze: 15000,
      teacher: {},
    }),
    { ok: true, lessonKind: 'regular', duration: 60, priceGrosze: 15000 },
  )
})

test('automatic checkout refund idempotency key is stable per session id', () => {
  const first = checkoutAutoRefundIdempotencyKey('cs_test_duplicate_trial')
  const retry = checkoutAutoRefundIdempotencyKey('cs_test_duplicate_trial')

  assert.equal(first, 'auto-refund-checkout:cs_test_duplicate_trial')
  assert.equal(retry, first)
})

test('trial checkout is rejected when the teacher has trial disabled', () => {
  assert.deepEqual(
    resolveCheckoutLessonTerms({
      lessonKind: 'trial',
      requestedDuration: 30,
      regularPriceGrosze: 7500,
      teacher: { trialLessonEnabled: false },
    }),
    { ok: false, error: 'trial_disabled' },
  )
})

test('trial checkout is rejected when requested duration differs from teacher config', () => {
  assert.deepEqual(
    resolveCheckoutLessonTerms({
      lessonKind: 'trial',
      requestedDuration: 60,
      regularPriceGrosze: 15000,
      teacher: {
        trialLessonEnabled: true,
        trialLessonDuration: 30,
        trialLessonPriceGrosze: 4900,
      },
    }),
    { ok: false, error: 'invalid_trial_duration' },
  )
})

test('trial checkout price comes from teacher config, not the regular lesson price', () => {
  assert.deepEqual(
    resolveCheckoutLessonTerms({
      lessonKind: 'trial',
      requestedDuration: 30,
      regularPriceGrosze: 999999,
      teacher: {
        trialLessonEnabled: true,
        trialLessonDuration: 30,
        trialLessonPriceGrosze: 4900,
      },
    }),
    { ok: true, lessonKind: 'trial', duration: 30, priceGrosze: 4900 },
  )
})

test('a paid non-refunded trial consumes the one-trial allowance', () => {
  assert.equal(studentHasConsumedTrialLesson([
    { lessonKind: 'trial', paymentStatus: 'refunded', status: 'cancelled', stripeRefundId: 're_123' },
    { lessonKind: 'trial', paymentStatus: 'paid', status: 'upcoming' },
  ]), true)
})

test('cancelled refunded trials do not consume the one-trial allowance', () => {
  assert.equal(studentHasConsumedTrialLesson([
    { lessonKind: 'trial', paymentStatus: 'refunded', status: 'cancelled', stripeRefundId: 're_123' },
  ]), false)
})

test('cancelled paid trials without a refund id still consume the allowance fail-closed', () => {
  assert.equal(studentHasConsumedTrialLesson([
    { lessonKind: 'trial', paymentStatus: 'paid', status: 'cancelled' },
  ]), true)
})
