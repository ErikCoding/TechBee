import assert from 'node:assert/strict'
import test from 'node:test'
import {
  buildPackageRefundReviewPatch,
  paymentIntentIdFromRefundLike,
  selectPackageRefundReviewPatch,
  stripeRefundListDataOrThrow,
  writePackageRefundReview,
} from '../lib/lesson-package-refunds-core.ts'
import { reservePackageCredits, validatePackageForBooking } from '../lib/lesson-packages-core.ts'

function pkg(patch = {}) {
  return {
    teacherId: 'teacher-1',
    studentId: 'student-1',
    subjectKey: 'category:math',
    duration: 60,
    remainingCredits: 5,
    reservedCredits: 0,
    usedCredits: 0,
    status: 'active',
    ...patch,
  }
}

function fakeDatabase(initialPackage) {
  const state = { package: initialPackage ? { ...initialPackage } : null, updates: 0 }
  return {
    state,
    async runTransaction(fn) {
      return fn({
        async get() {
          return { exists: Boolean(state.package) }
        },
        update(_ref, patch) {
          state.package = { ...state.package, ...patch }
          state.updates += 1
        },
      })
    },
  }
}

test('pending package refund without a balance transaction creates a refund review lock patch', () => {
  const patch = buildPackageRefundReviewPatch({
    stripeRefundId: 're_pending',
    refundStatus: 'pending',
    refundAmountGrosze: 10000,
    now: 123,
  })
  assert.equal(patch?.status, 'refund_review')
  assert.equal(patch?.stripeRefundStatus, 'pending')
  assert.equal(patch?.refundRequiresAdminReview, true)
})

test('succeeded package refund creates a refund review lock patch', () => {
  const patch = buildPackageRefundReviewPatch({
    stripeRefundId: 're_ok',
    refundStatus: 'succeeded',
    refundFull: true,
    now: 456,
  })
  assert.equal(patch?.status, 'refund_review')
  assert.equal(patch?.refundFull, true)
})

test('failed or canceled package refund does not create a new lock patch', () => {
  assert.equal(buildPackageRefundReviewPatch({ stripeRefundId: 're_failed', refundStatus: 'failed', now: 1 }), null)
  assert.equal(buildPackageRefundReviewPatch({ stripeRefundId: 're_canceled', refundStatus: 'canceled', now: 1 }), null)
})

test('refund reconciliation selects the first actionable refund and ignores failed refunds', () => {
  const patch = selectPackageRefundReviewPatch({
    refunds: [
      { id: 're_failed', status: 'failed', amount: 5000 },
      { id: 're_pending', status: 'pending', amount: 5000 },
    ],
    now: 321,
  })
  assert.equal(patch?.status, 'refund_review')
  assert.equal(patch?.stripeRefundId, 're_pending')
  assert.equal(patch?.refundAmountGrosze, 5000)
})

test('refund preflight fails closed on an incomplete Stripe refund list response', () => {
  assert.throws(
    () => stripeRefundListDataOrThrow({}),
    /incomplete/,
  )
})

test('refund PaymentIntent is read from refund or expanded charge and missing PaymentIntent stays unrelated', () => {
  assert.equal(paymentIntentIdFromRefundLike({ payment_intent: 'pi_refund' }), 'pi_refund')
  assert.equal(paymentIntentIdFromRefundLike({ payment_intent: { id: 'pi_expanded' } }), 'pi_expanded')
  assert.equal(paymentIntentIdFromRefundLike({ charge: 'ch_1' }, { payment_intent: 'pi_charge' }), 'pi_charge')
  assert.equal(paymentIntentIdFromRefundLike({ charge: 'ch_1' }, null), null)
})

test('repeated package refund lock is idempotent and never reactivates the package', async () => {
  const database = fakeDatabase(pkg())
  const patch = buildPackageRefundReviewPatch({ stripeRefundId: 're_repeat', refundStatus: 'pending', now: 100 })
  assert.equal(await writePackageRefundReview({ database, packageRef: { id: 'pkg-1' }, patch }), true)
  assert.equal(await writePackageRefundReview({ database, packageRef: { id: 'pkg-1' }, patch }), true)
  assert.equal(database.state.package.status, 'refund_review')
  assert.equal(database.state.updates, 2)
})

test('Firestore transaction errors are propagated so Stripe can retry the webhook', async () => {
  const database = {
    async runTransaction() {
      throw new Error('firestore unavailable')
    },
  }
  const patch = buildPackageRefundReviewPatch({ stripeRefundId: 're_retry', refundStatus: 'pending', now: 100 })
  await assert.rejects(
    () => writePackageRefundReview({ database, packageRef: { id: 'pkg-1' }, patch }),
    /firestore unavailable/,
  )
})

test('refund review status wins the refund vs booking race by blocking later reservations', () => {
  const locked = pkg(buildPackageRefundReviewPatch({ stripeRefundId: 're_race', refundStatus: 'pending', now: 100 }))
  const expected = { teacherId: 'teacher-1', studentId: 'student-1', subjectKey: 'category:math', duration: 60 }
  assert.equal(validatePackageForBooking(locked, expected), 'package_not_active')
  assert.deepEqual(reservePackageCredits(locked, 1), locked)
})

test('missing package ref behaves like an unrelated PaymentIntent and writes nothing', async () => {
  const database = fakeDatabase(pkg())
  const patch = buildPackageRefundReviewPatch({ stripeRefundId: 're_unrelated', refundStatus: 'pending', now: 100 })
  assert.equal(await writePackageRefundReview({ database, packageRef: null, patch }), false)
  assert.equal(database.state.updates, 0)
})
