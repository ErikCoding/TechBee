import assert from 'node:assert/strict'
import test from 'node:test'
import {
  calculateFoundingPromotionEndsAt,
  computeNextFoundingTeacherNumber,
  foundingPromotionIsActive,
  foundingTeacherSlotId,
  normalizeFoundingTeacherConfig,
  resolveEffectiveCommission,
} from '../lib/founding-teacher-core.ts'
import { splitPayment } from '../lib/stripe-config.ts'

const now = new Date('2026-09-21T12:00:00.000Z').getTime()

function promotion(patch = {}) {
  return {
    type: 'founding_teacher',
    rate: 5,
    startedAt: now - 1_000,
    endsAt: now + 90 * 24 * 60 * 60 * 1000,
    assignedAt: now - 1_000,
    assignedBy: 'admin',
    marketplaceHighlight: true,
    ...patch,
  }
}

function resolveAndSplit({ standardCommissionPercent, foundingTeacherPromotion, at = now, priceGrosze = 10000 }) {
  const commission = resolveEffectiveCommission({
    standardCommissionPercent,
    foundingTeacherPromotion,
    now: at,
  })
  const split = splitPayment(priceGrosze, commission.effectiveCommissionPercent)
  return { ...commission, ...split }
}

test('uses founding teacher commission while promotion is active', () => {
  const result = resolveEffectiveCommission({
    standardCommissionPercent: 15,
    foundingTeacherPromotion: promotion(),
    now,
  })
  assert.equal(result.effectiveCommissionPercent, 5)
  assert.equal(result.commissionSource, 'founding_teacher')
})

test('falls back to standard commission after promotion ends', () => {
  const result = resolveEffectiveCommission({
    standardCommissionPercent: 15,
    foundingTeacherPromotion: promotion({ endsAt: now - 1 }),
    now,
  })
  assert.equal(result.effectiveCommissionPercent, 15)
  assert.equal(result.commissionSource, 'standard')
})

test('promotion snapshot is independent from later global commission changes', () => {
  const snap = promotion({ rate: 4 })
  assert.equal(resolveEffectiveCommission({ standardCommissionPercent: 15, foundingTeacherPromotion: snap, now }).effectiveCommissionPercent, 4)
  assert.equal(resolveEffectiveCommission({ standardCommissionPercent: 20, foundingTeacherPromotion: snap, now }).effectiveCommissionPercent, 4)
})

test('slot numbering stops exactly after the configured limit', () => {
  assert.equal(computeNextFoundingTeacherNumber(49, 50), 50)
  assert.equal(computeNextFoundingTeacherNumber(50, 50), null)
})

test('slot ids are stable and sortable', () => {
  assert.equal(foundingTeacherSlotId(1), '001')
  assert.equal(foundingTeacherSlotId(50), '050')
})

test('calculates promotion end from start and duration days', () => {
  assert.equal(calculateFoundingPromotionEndsAt(now, 90), now + 90 * 24 * 60 * 60 * 1000)
})

test('normalizes unsafe config input', () => {
  const config = normalizeFoundingTeacherConfig({
    enabled: true,
    limit: -10,
    promoRate: 200,
    durationDays: 0,
    participantsCount: -1,
  })
  assert.equal(config.enabled, true)
  assert.equal(config.limit, 1)
  assert.equal(config.promoRate, 50)
  assert.equal(config.durationDays, 1)
  assert.equal(config.participantsCount, 0)
})

test('detects only currently active founding promotions', () => {
  assert.equal(foundingPromotionIsActive(promotion(), now), true)
  assert.equal(foundingPromotionIsActive(promotion({ startedAt: now + 1 }), now), false)
  assert.equal(foundingPromotionIsActive(promotion({ endsAt: now }), now), false)
})

test('checkout commission scenario 1: active Pierwsza 50 uses 5 percent on 10000 grosze', () => {
  const result = resolveAndSplit({
    standardCommissionPercent: 8,
    foundingTeacherPromotion: promotion({ rate: 5 }),
  })
  assert.deepEqual(result, {
    effectiveCommissionPercent: 5,
    commissionSource: 'founding_teacher',
    platformFeeGrosze: 500,
    teacherAmountGrosze: 9500,
  })
})

test('checkout commission scenario 2: expired Pierwsza 50 falls back to standard 8 percent', () => {
  const result = resolveAndSplit({
    standardCommissionPercent: 8,
    foundingTeacherPromotion: promotion({ rate: 5, endsAt: now - 1 }),
  })
  assert.deepEqual(result, {
    effectiveCommissionPercent: 8,
    commissionSource: 'standard',
    platformFeeGrosze: 800,
    teacherAmountGrosze: 9200,
  })
})

test('checkout commission scenario 3: regular teacher uses standard 8 percent', () => {
  const result = resolveAndSplit({
    standardCommissionPercent: 8,
    foundingTeacherPromotion: undefined,
  })
  assert.deepEqual(result, {
    effectiveCommissionPercent: 8,
    commissionSource: 'standard',
    platformFeeGrosze: 800,
    teacherAmountGrosze: 9200,
  })
})

test('checkout commission scenario 4: standard change does not affect active founding snapshot, but applies after expiry', () => {
  const active = resolveAndSplit({
    standardCommissionPercent: 10,
    foundingTeacherPromotion: promotion({ rate: 5 }),
  })
  assert.deepEqual(active, {
    effectiveCommissionPercent: 5,
    commissionSource: 'founding_teacher',
    platformFeeGrosze: 500,
    teacherAmountGrosze: 9500,
  })

  const expired = resolveAndSplit({
    standardCommissionPercent: 10,
    foundingTeacherPromotion: promotion({ rate: 5, endsAt: now - 1 }),
  })
  assert.deepEqual(expired, {
    effectiveCommissionPercent: 10,
    commissionSource: 'standard',
    platformFeeGrosze: 1000,
    teacherAmountGrosze: 9000,
  })
})

test('checkout commission scenario 5: promotion is active just before endsAt and expired exactly at endsAt', () => {
  const endsAt = now + 1_000
  const justBefore = resolveAndSplit({
    standardCommissionPercent: 8,
    foundingTeacherPromotion: promotion({ rate: 5, endsAt }),
    at: endsAt - 1,
  })
  assert.deepEqual(justBefore, {
    effectiveCommissionPercent: 5,
    commissionSource: 'founding_teacher',
    platformFeeGrosze: 500,
    teacherAmountGrosze: 9500,
  })

  const exactlyAtEnd = resolveAndSplit({
    standardCommissionPercent: 8,
    foundingTeacherPromotion: promotion({ rate: 5, endsAt }),
    at: endsAt,
  })
  assert.deepEqual(exactlyAtEnd, {
    effectiveCommissionPercent: 8,
    commissionSource: 'standard',
    platformFeeGrosze: 800,
    teacherAmountGrosze: 9200,
  })
})
