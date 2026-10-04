import assert from 'node:assert/strict'
import test from 'node:test'
import { selectMissingStripeFeeTargets, syncMissingStripeFeeTargets } from '../lib/stripe-fee-sync-core.ts'

test('missing Stripe fee can be supplemented from a real Stripe snapshot without estimation', async () => {
  const written = []
  const result = await syncMissingStripeFeeTargets({
    targets: [{ id: 'lesson_1', kind: 'lesson', stripePaymentIntentId: 'pi_1' }],
    fetchFeeSnapshot: async (paymentIntentId) => {
      assert.equal(paymentIntentId, 'pi_1')
      return { stripeFeeGrosze: 228, stripeChargeId: 'ch_1', stripeBalanceTransactionId: 'txn_1' }
    },
    writeFeeSnapshot: async (target, snapshot) => {
      written.push({ target, snapshot })
      return true
    },
  })

  assert.deepEqual(result, { checked: 1, updated: 1, missingFromStripe: 0 })
  assert.equal(written[0].snapshot.stripeFeeGrosze, 228)
})

test('existing Stripe fee is not selected or overwritten', () => {
  const targets = selectMissingStripeFeeTargets([
    { id: 'lesson_existing', kind: 'lesson', stripePaymentIntentId: 'pi_existing', stripeFeeGrosze: 300 },
    { id: 'lesson_missing', kind: 'lesson', stripePaymentIntentId: 'pi_missing' },
  ], 20)

  assert.deepEqual(targets.map((target) => target.id), ['lesson_missing'])
})

test('fee sync does not invent fees when Stripe has no balance transaction yet', async () => {
  let writes = 0
  const result = await syncMissingStripeFeeTargets({
    targets: [{ id: 'lesson_1', kind: 'lesson', stripePaymentIntentId: 'pi_1' }],
    fetchFeeSnapshot: async () => null,
    writeFeeSnapshot: async () => {
      writes += 1
      return true
    },
  })

  assert.deepEqual(result, { checked: 1, updated: 0, missingFromStripe: 1 })
  assert.equal(writes, 0)
})

test('package purchase fee is eligible, but package-funded lessons do not create extra fee targets', () => {
  const targets = selectMissingStripeFeeTargets([
    { id: 'pkg_5', kind: 'package', stripePaymentIntentId: 'pi_pkg' },
    { id: 'package_lesson_without_charge', kind: 'lesson' },
  ], 20)

  assert.deepEqual(targets.map((target) => target.id), ['pkg_5'])
})
