import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { canAccessCheckoutSubject } from '../lib/checkout-session-access-core.ts'

const subject = { studentId: 'student-1', payerId: 'parent-1' }
const routeSource = readFileSync(new URL('../app/api/stripe/checkout/status/route.ts', import.meta.url), 'utf8')
const serviceSource = readFileSync(new URL('../services/stripe.service.ts', import.meta.url), 'utf8')

test('checkout status is visible to the student and payer only by default', () => {
  assert.equal(canAccessCheckoutSubject(subject, { uid: 'student-1', role: 'student' }), true)
  assert.equal(canAccessCheckoutSubject(subject, { uid: 'parent-1', role: 'parent' }), true)
  assert.equal(canAccessCheckoutSubject(subject, { uid: 'other-user', role: 'student' }), false)
})

test('checkout status allows linked parent and admin access', () => {
  assert.equal(canAccessCheckoutSubject(subject, { uid: 'linked-parent', role: 'parent', linkedParentIds: ['linked-parent'] }), true)
  assert.equal(canAccessCheckoutSubject(subject, { uid: 'admin-1', role: 'admin' }), true)
})

test('checkout status denies malformed payment subjects', () => {
  assert.equal(canAccessCheckoutSubject({ payerId: 'parent-1' }, { uid: 'parent-1', role: 'parent' }), false)
})

test('checkout status route verifies Firebase auth and service sends the ID token', () => {
  assert.equal(routeSource.includes('verifyCaller'), true)
  assert.equal(routeSource.includes('canAccessPayment'), true)
  assert.equal(routeSource.includes("status: 403"), true)
  assert.equal(serviceSource.includes('Authorization: `Bearer ${idToken}`'), true)
})
