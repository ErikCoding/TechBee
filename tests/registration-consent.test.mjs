import assert from 'node:assert/strict'
import test from 'node:test'
import { buildRegistrationConsent, validateRegistrationConsent } from '../lib/registration-consent-core.ts'

test('registration requires accepted terms and an age declaration', () => {
  assert.match(validateRegistrationConsent({ role: 'student', ageBand: 'adult' }), /Regulamin/)
  assert.match(validateRegistrationConsent({ role: 'student', acceptTerms: true }), /wiek/)
  assert.match(validateRegistrationConsent({ role: 'student', acceptTerms: true, ageBand: 'nope' }), /wiek/)
  assert.equal(validateRegistrationConsent({ role: 'student', acceptTerms: true, ageBand: 'child_under_16' }), null)
  assert.equal(validateRegistrationConsent({ role: 'student', acceptTerms: true, ageBand: 'teen_16_17' }), null)
})

test('teacher and parent accounts must be adult', () => {
  for (const role of ['teacher', 'parent']) {
    assert.match(validateRegistrationConsent({ role, acceptTerms: true, ageBand: 'teen_16_17' }), /pełnoletnie/)
    assert.equal(validateRegistrationConsent({ role, acceptTerms: true, ageBand: 'adult' }), null)
  }
})

test('consent record stores version, time and age band', () => {
  const record = buildRegistrationConsent('adult', 123)
  assert.deepEqual(record, { termsAcceptedAt: 123, termsVersion: 'v1-2026-11', ageBand: 'adult' })
})
