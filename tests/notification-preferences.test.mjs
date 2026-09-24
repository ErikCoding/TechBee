import assert from 'node:assert/strict'
import test from 'node:test'
import {
  canUpdateOwnNotificationPreferences,
  emailNotificationFieldPath,
  isEmailNotificationType,
  normalizeNotificationPreferences,
  setEmailNotificationPreference,
  shouldSendEmailNotification,
} from '../lib/notification-preferences.ts'
import { needsEmailVerificationGate } from '../lib/auth-guards.ts'

test('existing user without notification preferences gets safe defaults', () => {
  const prefs = normalizeNotificationPreferences(undefined)

  assert.equal(prefs.email.lessons.bookingCreated, true)
  assert.equal(prefs.email.lessons.lessonReminder, true)
  assert.equal(prefs.email.reports.reportReady, true)
  assert.equal(prefs.email.payments.paymentConfirmation, true)
  assert.equal(prefs.email.messages.newMessage, true)
  assert.equal(prefs.email.product.productUpdates, false)
})

test('shouldSendEmailNotification reads stored preferences with defaults', () => {
  const prefs = normalizeNotificationPreferences({
    email: {
      lessons: { bookingCancelled: false },
    },
  })

  assert.equal(shouldSendEmailNotification(prefs, 'lessons.bookingCancelled'), false)
  assert.equal(shouldSendEmailNotification(prefs, 'lessons.bookingChanged'), true)
  assert.equal(shouldSendEmailNotification(prefs, 'product.productUpdates'), false)
})

test('notification preference updates are typed and scoped to email keys', () => {
  const prefs = setEmailNotificationPreference(
    normalizeNotificationPreferences(null),
    'payments.refund',
    false,
  )

  assert.equal(isEmailNotificationType('payments.refund'), true)
  assert.equal(isEmailNotificationType('security.passwordReset'), false)
  assert.equal(emailNotificationFieldPath('payments.refund'), 'notificationPreferences.email.payments.refund')
  assert.equal(prefs.email.payments.refund, false)
})

test('user can update own notification preferences but not another uid', () => {
  assert.equal(canUpdateOwnNotificationPreferences('user-1', 'user-1'), true)
  assert.equal(canUpdateOwnNotificationPreferences('user-1', 'user-2'), false)
  assert.equal(canUpdateOwnNotificationPreferences(null, 'user-1'), false)
})

test('verification gate blocks only authenticated unverified users when flag is enabled', () => {
  const unverified = { id: 'u1', emailVerified: false }
  const verified = { id: 'u1', emailVerified: true }

  assert.equal(needsEmailVerificationGate(true, 'authenticated', unverified), true)
  assert.equal(needsEmailVerificationGate(false, 'authenticated', unverified), false)
  assert.equal(needsEmailVerificationGate(true, 'authenticated', verified), false)
  assert.equal(needsEmailVerificationGate(true, 'unauthenticated', unverified), false)
  assert.equal(needsEmailVerificationGate(true, 'loading', null), false)
})
