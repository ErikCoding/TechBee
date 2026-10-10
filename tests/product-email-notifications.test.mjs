import assert from 'node:assert/strict'
import test from 'node:test'
import {
  productEmailDocId,
  shouldSendProductEmail,
  validateProductEmailRecipient,
} from '../lib/email/product-notifications-core.ts'

test('product email document id is deterministic and Firestore-safe', () => {
  const one = productEmailDocId('lesson/abc:booking-created')
  const two = productEmailDocId('lesson/abc:booking-created')

  assert.equal(one, two)
  assert.match(one, /^[a-f0-9]{64}$/)
})

test('product emails respect notification preferences unless required', () => {
  const recipient = {
    uid: 'u1',
    email: 'u1@runbee.pl',
    notificationPreferences: {
      email: {
        payments: { payout: false },
      },
    },
  }

  assert.equal(shouldSendProductEmail(recipient, 'payments.payout'), false)
  assert.equal(shouldSendProductEmail(recipient, 'payments.payout', true), true)
})

test('product email recipient validation distinguishes missing recipient and preferences', () => {
  const input = {
    eventId: 'event-1',
    recipientUid: 'u1',
    type: 'messages.newMessage',
    subject: 'Subject',
    title: 'Title',
    body: 'Body',
  }

  assert.equal(validateProductEmailRecipient(null, input), 'missing_recipient')
  assert.equal(validateProductEmailRecipient({ uid: 'u1' }, input), 'missing_recipient')
  assert.equal(validateProductEmailRecipient({
    uid: 'u1',
    email: 'u1@runbee.pl',
    notificationPreferences: { email: { messages: { newMessage: false } } },
  }, input), 'skipped_preferences')
  assert.equal(validateProductEmailRecipient({ uid: 'u1', email: 'u1@runbee.pl' }, input), null)
})
