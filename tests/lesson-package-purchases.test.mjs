import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { creditsAfterPackagePurchase, normalizeLessonPackagePurchaseMode } from '../lib/lesson-package-purchases-core.ts'

describe('lesson package purchase modes', () => {
  it('normalizes unknown purchase modes to package_only', () => {
    assert.equal(normalizeLessonPackagePurchaseMode('package_and_book'), 'package_and_book')
    assert.equal(normalizeLessonPackagePurchaseMode('unexpected'), 'package_only')
    assert.equal(normalizeLessonPackagePurchaseMode(undefined), 'package_only')
  })

  it('keeps all credits for package-only purchases', () => {
    assert.deepEqual(
      creditsAfterPackagePurchase({ packageSize: 5, purchaseMode: 'package_only' }),
      { remainingCredits: 5, reservedCredits: 0 },
    )
  })

  it('reserves one credit only when first booking is created', () => {
    assert.deepEqual(
      creditsAfterPackagePurchase({ packageSize: 10, purchaseMode: 'package_and_book', firstBookingStatus: 'booked' }),
      { remainingCredits: 9, reservedCredits: 1 },
    )
    assert.deepEqual(
      creditsAfterPackagePurchase({ packageSize: 10, purchaseMode: 'package_and_book', firstBookingStatus: 'slot_conflict' }),
      { remainingCredits: 10, reservedCredits: 0 },
    )
  })
})
