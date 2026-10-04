import assert from 'node:assert/strict'
import test from 'node:test'
import {
  TEACHER_MIN_PAYOUT_ERROR,
  TEACHER_MIN_PAYOUT_GROSZE,
  TEACHER_PAYOUT_IN_PROGRESS_ERROR,
  TEACHER_PAYOUT_UNRESOLVED_ERROR,
  beginTeacherPayoutAttempt,
  canStartTeacherPayoutAttempt,
  createTeacherStripePayout,
  teacherPayoutAttemptIdempotencyKey,
  validateTeacherPayoutAmount,
} from '../lib/teacher-payout-core.ts'

test('rejects payout below 100 PLN', () => {
  assert.deepEqual(validateTeacherPayoutAmount(9_999, 20_000), {
    ok: false,
    status: 400,
    error: TEACHER_MIN_PAYOUT_ERROR,
    code: 'below_minimum',
  })
})

test('allows payout exactly at 100 PLN', () => {
  assert.deepEqual(validateTeacherPayoutAmount(TEACHER_MIN_PAYOUT_GROSZE, 20_000), { ok: true })
})

test('allows payout above 100 PLN', () => {
  assert.deepEqual(validateTeacherPayoutAmount(10_001, 20_000), { ok: true })
})

test('rejects payout greater than current Stripe available balance', () => {
  assert.deepEqual(validateTeacherPayoutAmount(10_001, 10_000), {
    ok: false,
    status: 400,
    error: 'Kwota przekracza dostępne saldo.',
    code: 'insufficient_balance',
  })
})

test('rejects invalid, zero and negative payout amounts', () => {
  for (const amount of [Number.NaN, Number.POSITIVE_INFINITY, 0, -1]) {
    assert.deepEqual(validateTeacherPayoutAmount(amount, 20_000), {
      ok: false,
      status: 400,
      error: 'Nieprawidłowa kwota.',
      code: 'invalid_amount',
    })
  }
})

test('active payout lock blocks duplicate concurrent payout attempts', () => {
  const now = Date.parse('2026-10-03T12:00:00.000Z')
  assert.equal(canStartTeacherPayoutAttempt(null, now), true)
  assert.equal(canStartTeacherPayoutAttempt({ status: 'failed', expiresAt: now + 1_000 }, now), true)
  assert.equal(canStartTeacherPayoutAttempt({ status: 'succeeded', expiresAt: now + 1_000 }, now), true)
  assert.equal(canStartTeacherPayoutAttempt({ status: 'processing', expiresAt: now + 1_000 }, now), false)
})

test('stale payout lock can be retried without permanently blocking payouts', () => {
  const now = Date.parse('2026-10-03T12:00:00.000Z')
  assert.equal(canStartTeacherPayoutAttempt({ status: 'processing', expiresAt: now }, now), true)
  assert.equal(canStartTeacherPayoutAttempt({ status: 'processing', expiresAt: now - 1 }, now), true)
})

test('transaction acquire lets only one fresh payout attempt start', () => {
  const now = Date.parse('2026-10-03T12:00:00.000Z')
  const first = beginTeacherPayoutAttempt({
    existingLock: null,
    teacherId: 'teacher-1',
    amountGrosze: 10_000,
    now,
    createAttemptId: () => 'attempt-first',
  })
  assert.equal(first.ok, true)
  assert.equal(first.ok && first.reused, false)

  const second = beginTeacherPayoutAttempt({
    existingLock: first.ok ? first.lock : null,
    teacherId: 'teacher-1',
    amountGrosze: 10_000,
    now: now + 1,
    createAttemptId: () => 'attempt-second',
  })
  assert.deepEqual(second, {
    ok: false,
    status: 409,
    error: TEACHER_PAYOUT_IN_PROGRESS_ERROR,
    code: 'payout_in_progress',
  })
})

test('fresh payout attempt persists attemptId before any Stripe call', () => {
  const now = Date.parse('2026-10-03T12:00:00.000Z')
  let stripeCalls = 0
  const decision = beginTeacherPayoutAttempt({
    existingLock: null,
    teacherId: 'teacher-1',
    amountGrosze: 10_000,
    now,
    createAttemptId: () => 'attempt-before-stripe',
  })

  assert.equal(decision.ok, true)
  assert.equal(decision.ok && decision.lock.attemptId, 'attempt-before-stripe')
  assert.equal(decision.ok && decision.lock.status, 'processing')
  assert.equal(stripeCalls, 0)
})

test('stale processing attempt for the same amount reuses the stored attemptId', () => {
  const now = Date.parse('2026-10-03T12:00:00.000Z')
  const decision = beginTeacherPayoutAttempt({
    existingLock: {
      status: 'processing',
      attemptId: 'attempt-old',
      amountGrosze: 15_000,
      expiresAt: now - 1,
    },
    teacherId: 'teacher-1',
    amountGrosze: 15_000,
    now,
    createAttemptId: () => 'attempt-new',
  })

  assert.equal(decision.ok, true)
  assert.equal(decision.ok && decision.reused, true)
  assert.equal(decision.ok && decision.attemptId, 'attempt-old')
  assert.equal(decision.ok && decision.lock.retryStartedAt, now)
})

test('stale processing attempt for a different amount fails closed before Stripe', async () => {
  const now = Date.parse('2026-10-03T12:00:00.000Z')
  let stripeCalls = 0
  const decision = beginTeacherPayoutAttempt({
    existingLock: {
      status: 'processing',
      attemptId: 'attempt-old',
      amountGrosze: 15_000,
      expiresAt: now - 1,
    },
    teacherId: 'teacher-1',
    amountGrosze: 20_000,
    now,
    createAttemptId: () => 'attempt-new',
  })

  if (decision.ok) {
    await createTeacherStripePayout({
      create: async () => {
        stripeCalls += 1
        return { id: 'po_should_not_exist' }
      },
    }, {
      amountGrosze: 20_000,
      currency: 'pln',
      stripeAccount: 'acct_mock',
      attemptId: decision.attemptId,
    })
  }

  assert.deepEqual(decision, {
    ok: false,
    status: 409,
    error: TEACHER_PAYOUT_UNRESOLVED_ERROR,
    code: 'unresolved_attempt',
  })
  assert.equal(stripeCalls, 0)
})

test('retry after Stripe success and Firestore success-write failure keeps the same idempotency key', async () => {
  const now = Date.parse('2026-10-03T12:00:00.000Z')
  const decision = beginTeacherPayoutAttempt({
    existingLock: {
      status: 'processing',
      attemptId: 'attempt-survived-stripe',
      amountGrosze: 10_000,
      stripePayoutId: 'po_created_before_crash',
      expiresAt: now - 1,
    },
    teacherId: 'teacher-1',
    amountGrosze: 10_000,
    now,
    createAttemptId: () => 'attempt-new',
  })
  assert.equal(decision.ok, true)
  assert.equal(decision.ok && decision.attemptId, 'attempt-survived-stripe')
  assert.equal(decision.ok && decision.lock.stripePayoutId, 'po_created_before_crash')

  const calls = []
  await createTeacherStripePayout({
    create: async (params, options) => {
      calls.push({ params, options })
      return { id: 'po_created_before_crash', status: 'pending' }
    },
  }, {
    amountGrosze: 10_000,
    currency: 'pln',
    stripeAccount: 'acct_mock',
    attemptId: decision.ok ? decision.attemptId : 'wrong',
  })

  assert.equal(calls[0].options.idempotencyKey, 'teacher-payout:attempt-survived-stripe')
})

test('succeeded payout attempt allows a later legal payout to get a new attemptId', () => {
  const now = Date.parse('2026-10-03T12:00:00.000Z')
  const decision = beginTeacherPayoutAttempt({
    existingLock: {
      status: 'succeeded',
      attemptId: 'attempt-old',
      amountGrosze: 10_000,
      expiresAt: now + 10_000,
    },
    teacherId: 'teacher-1',
    amountGrosze: 10_000,
    now,
    createAttemptId: () => 'attempt-new',
  })

  assert.equal(decision.ok, true)
  assert.equal(decision.ok && decision.reused, false)
  assert.equal(decision.ok && decision.attemptId, 'attempt-new')
})

test('failed-before-Stripe attempt allows a legal retry with a new attemptId', () => {
  const now = Date.parse('2026-10-03T12:00:00.000Z')
  const decision = beginTeacherPayoutAttempt({
    existingLock: {
      status: 'failed',
      attemptId: 'attempt-failed-before-stripe',
      amountGrosze: 10_000,
      expiresAt: now + 10_000,
    },
    teacherId: 'teacher-1',
    amountGrosze: 10_000,
    now,
    createAttemptId: () => 'attempt-retry',
  })

  assert.equal(decision.ok, true)
  assert.equal(decision.ok && decision.reused, false)
  assert.equal(decision.ok && decision.attemptId, 'attempt-retry')
})

test('Stripe idempotency key is scoped to one concrete payout attempt', () => {
  assert.equal(teacherPayoutAttemptIdempotencyKey('attempt-1'), 'teacher-payout:attempt-1')
  assert.notEqual(teacherPayoutAttemptIdempotencyKey('attempt-1'), teacherPayoutAttemptIdempotencyKey('attempt-2'))
})

test('creates Stripe payout through a mocked payouts client with per-attempt idempotency', async () => {
  const calls = []
  const payout = await createTeacherStripePayout({
    create: async (params, options) => {
      calls.push({ params, options })
      return { id: 'po_mock', status: 'pending' }
    },
  }, {
    amountGrosze: 10_000,
    currency: 'pln',
    stripeAccount: 'acct_mock',
    attemptId: 'attempt-100',
  })

  assert.deepEqual(payout, { id: 'po_mock', status: 'pending' })
  assert.deepEqual(calls, [{
    params: { amount: 10_000, currency: 'pln' },
    options: { stripeAccount: 'acct_mock', idempotencyKey: 'teacher-payout:attempt-100' },
  }])
})

test('below-minimum payout is rejected before mocked Stripe payout creation', async () => {
  let stripeCalls = 0
  const validation = validateTeacherPayoutAmount(9_999, 20_000)
  if (validation.ok) {
    await createTeacherStripePayout({
      create: async () => {
        stripeCalls += 1
        return { id: 'po_should_not_exist' }
      },
    }, {
      amountGrosze: 9_999,
      currency: 'pln',
      stripeAccount: 'acct_mock',
      attemptId: 'attempt-rejected',
    })
  }

  assert.equal(validation.ok, false)
  assert.equal(stripeCalls, 0)
})
