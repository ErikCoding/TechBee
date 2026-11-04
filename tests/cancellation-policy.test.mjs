import assert from 'node:assert/strict'
import test from 'node:test'
import { cancellationMode, canRequestReschedule } from '../lib/cancellation-policy-core.ts'

const H = 60 * 60 * 1000
const now = 1_000_000_000_000

test('student cancels instantly only 48 h or more before the lesson', () => {
  assert.equal(cancellationMode({ requestedBy: 'student', startAtMs: now + 48 * H, now }), 'immediate')
  assert.equal(cancellationMode({ requestedBy: 'student', startAtMs: now + 48 * H - 1, now }), 'needs_approval')
  assert.equal(cancellationMode({ requestedBy: 'student', startAtMs: null, now }), 'needs_approval')
})

test('teacher cancellation is always instant (full refund to the payer)', () => {
  assert.equal(cancellationMode({ requestedBy: 'teacher', startAtMs: now + H, now }), 'immediate')
  assert.equal(cancellationMode({ requestedBy: 'teacher', startAtMs: null, now }), 'immediate')
})

test('reschedule is possible until 2 h before the lesson', () => {
  assert.equal(canRequestReschedule(now + 2 * H, now), true)
  assert.equal(canRequestReschedule(now + 2 * H - 1, now), false)
  assert.equal(canRequestReschedule(null, now), false)
})
