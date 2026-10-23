import assert from 'node:assert/strict'
import test from 'node:test'
import {
  CHAT_MESSAGE_EDIT_WINDOW_MS,
  canEditChatMessage,
  sanitizeEditedChatText,
} from '../lib/chat-message-edit-core.ts'

const now = 1_000_000_000_000
const base = { senderId: 'u1', text: 'Cześć', createdAt: now - 60_000 }

test('author can edit a plain text message inside the 5 minute window', () => {
  assert.equal(CHAT_MESSAGE_EDIT_WINDOW_MS, 5 * 60 * 1000)
  assert.equal(canEditChatMessage(base, 'u1', now), true)
  assert.equal(canEditChatMessage({ ...base, createdAt: now - CHAT_MESSAGE_EDIT_WINDOW_MS }, 'u1', now), true)
})

test('editing is refused after the window, for other users and for non-text messages', () => {
  assert.equal(canEditChatMessage({ ...base, createdAt: now - CHAT_MESSAGE_EDIT_WINDOW_MS - 1 }, 'u1', now), false)
  assert.equal(canEditChatMessage(base, 'u2', now), false)
  assert.equal(canEditChatMessage({ ...base, attachment: { name: 'a.pdf' } }, 'u1', now), false)
  assert.equal(canEditChatMessage({ ...base, reportCard: { lessonId: 'l1' } }, 'u1', now), false)
  assert.equal(canEditChatMessage({ ...base, text: '   ' }, 'u1', now), false)
  assert.equal(canEditChatMessage({ ...base, createdAt: now + 60_000 }, 'u1', now), false)
  assert.equal(canEditChatMessage({ ...base, createdAt: undefined }, 'u1', now), false)
})

test('edited text is trimmed and capped', () => {
  assert.equal(sanitizeEditedChatText('  hej  '), 'hej')
  assert.equal(sanitizeEditedChatText(42), '')
  assert.equal(sanitizeEditedChatText('x'.repeat(5000)).length, 4000)
})
