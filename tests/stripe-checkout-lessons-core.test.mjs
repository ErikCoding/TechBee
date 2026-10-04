import assert from 'node:assert/strict'
import test from 'node:test'
import { resolveCheckoutSessionRaceDecision } from '../lib/stripe-checkout-lessons-core.ts'

test('duplicate checkout session returns the existing lesson instead of creating or refunding', () => {
  const first = resolveCheckoutSessionRaceDecision({
    currentCheckoutSessionId: 'cs_today',
    slotLocks: [],
  })
  const retry = resolveCheckoutSessionRaceDecision({
    existingLessonId: 'lesson_1',
    currentCheckoutSessionId: 'cs_today',
    slotLocks: [],
  })

  assert.deepEqual(first, { action: 'create_lesson' })
  assert.deepEqual(retry, { action: 'return_existing_lesson', lessonId: 'lesson_1' })
})

test('slot lock from the same checkout session returns the locked lesson', () => {
  assert.deepEqual(
    resolveCheckoutSessionRaceDecision({
      currentCheckoutSessionId: 'cs_today',
      slotLocks: [{ exists: true, checkoutSessionId: 'cs_today', lessonId: 'lesson_1' }],
    }),
    { action: 'return_existing_lesson', lessonId: 'lesson_1' },
  )
})

test('slot lock from another checkout session remains a conflict', () => {
  assert.deepEqual(
    resolveCheckoutSessionRaceDecision({
      currentCheckoutSessionId: 'cs_today',
      slotLocks: [{ exists: true, checkoutSessionId: 'cs_other', lessonId: 'lesson_other' }],
    }),
    { action: 'slot_conflict' },
  )
})

test('normal single lesson checkout can create a lesson when there is no existing lesson or slot lock', () => {
  assert.deepEqual(
    resolveCheckoutSessionRaceDecision({
      currentCheckoutSessionId: 'cs_today',
      slotLocks: [{ exists: false }],
    }),
    { action: 'create_lesson' },
  )
})
