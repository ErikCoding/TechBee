import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

test('chat messages are written through a server endpoint with idempotent email notification', () => {
  const route = readFileSync(new URL('../app/api/chat/messages/route.ts', import.meta.url), 'utf8')
  const service = readFileSync(new URL('../services/chat.service.ts', import.meta.url), 'utf8')

  assert.equal(route.includes('verifyCaller'), true)
  assert.equal(route.includes('sendProductNotificationEmail'), true)
  assert.equal(route.includes("type: 'messages.newMessage'"), true)
  assert.equal(route.includes('clientMessageId'), true)
  assert.equal(route.includes('messageSnap.exists'), true)
  assert.equal(route.includes('participantIds.includes(uid)'), true)
  assert.equal(service.includes("fetch('/api/chat/messages'"), true)
  assert.equal(service.includes('clientMessageId'), true)
})

import { sanitizeChatAttachment } from '../lib/chat-attachment-core.ts'
import { canPostReportCard, sanitizeChatReportCard } from '../lib/chat-report-card-core.ts'

const BUCKET = 'runbee.firebasestorage.app'
const goodPath = 'chat-attachments/u1/a__b/1-x.pdf'
const goodUrl = `https://firebasestorage.googleapis.com/v0/b/${BUCKET}/o/${encodeURIComponent(goodPath)}?alt=media&token=t`

test('chat attachment url must point at the own-folder object in this bucket', () => {
  const ctx = { uid: 'u1', conversationId: 'a__b', bucket: BUCKET }
  const ok = sanitizeChatAttachment({ name: 'x.pdf', size: '1 MB', kind: 'pdf', url: goodUrl, storagePath: goodPath, contentType: 'application/pdf' }, ctx)
  assert.equal(ok?.storagePath, goodPath)
  assert.equal(ok?.url, goodUrl)
  // other user's folder, other conversation, traversal
  assert.equal(sanitizeChatAttachment({ name: 'x', size: '1', kind: 'pdf', storagePath: 'chat-attachments/u2/a__b/f' }, ctx)?.storagePath, undefined)
  assert.equal(sanitizeChatAttachment({ name: 'x', size: '1', kind: 'pdf', storagePath: 'chat-attachments/u1/other__conv/f' }, ctx)?.storagePath, undefined)
  assert.equal(sanitizeChatAttachment({ name: 'x', size: '1', kind: 'pdf', storagePath: 'chat-attachments/u1/a__b/../u2/f' }, ctx)?.storagePath, undefined)
  // url that does not match the path, other bucket, javascript:, url without a valid path
  assert.equal(sanitizeChatAttachment({ name: 'x', size: '1', kind: 'pdf', storagePath: goodPath, url: `https://firebasestorage.googleapis.com/v0/b/${BUCKET}/o/${encodeURIComponent('chat-attachments/u1/a__b/other.pdf')}` }, ctx)?.url, undefined)
  assert.equal(sanitizeChatAttachment({ name: 'x', size: '1', kind: 'pdf', storagePath: goodPath, url: goodUrl.replace(BUCKET, 'evil-bucket') }, ctx)?.url, undefined)
  assert.equal(sanitizeChatAttachment({ name: 'x', size: '1', kind: 'pdf', storagePath: goodPath, url: 'javascript:alert(1)' }, ctx)?.url, undefined)
  assert.equal(sanitizeChatAttachment({ name: 'x', size: '1', kind: 'pdf', url: goodUrl }, ctx)?.url, undefined)
  assert.equal(sanitizeChatAttachment({ name: 'x', size: '1', kind: 'exe' }, ctx), undefined)
})

test('report cards: sanitized, status forced to pending, only the lesson teacher may post', () => {
  const card = sanitizeChatReportCard({ lessonId: 'l1', topic: ' PLC ', progressRating: 9, engagementRating: 'x', confirmingPartyId: 'p1', status: 'confirmed', managerIds: ['p1', 7, 'p1'] })
  assert.equal(card, undefined) // non-numeric rating → invalid
  const ok = sanitizeChatReportCard({ lessonId: 'l1', topic: ' PLC ', progressRating: 9, engagementRating: 4, confirmingPartyId: 'p1', status: 'confirmed', managerIds: ['p1', 7, 'p1'] })
  assert.equal(ok?.status, 'pending')
  assert.equal(ok?.progressRating, 5)
  assert.equal(ok?.topic, 'PLC')
  assert.deepEqual(ok?.managerIds, ['p1'])
  assert.equal(sanitizeChatReportCard('x'), undefined)

  const lesson = { teacherId: 't1', studentId: 's1', status: 'completed' }
  assert.equal(canPostReportCard({ uid: 't1', lesson, conversationParticipantIds: ['t1', 's1'], confirmingPartyId: 'p1' }), true)
  assert.equal(canPostReportCard({ uid: 't1', lesson, conversationParticipantIds: ['t1', 'p1'], confirmingPartyId: 'p1' }), true)
  assert.equal(canPostReportCard({ uid: 's1', lesson, conversationParticipantIds: ['t1', 's1'], confirmingPartyId: 'p1' }), false)
  assert.equal(canPostReportCard({ uid: 't1', lesson: { ...lesson, status: 'upcoming' }, conversationParticipantIds: ['t1', 's1'], confirmingPartyId: 'p1' }), false)
  assert.equal(canPostReportCard({ uid: 't1', lesson, conversationParticipantIds: ['t1', 'x'], confirmingPartyId: 'p1' }), false)
})

test('no client path still creates Firestore messages; rules forbid it; outbox + retry are wired', () => {
  const rules = readFileSync(new URL('../firestore.rules', import.meta.url), 'utf8')
  const service = readFileSync(new URL('../services/chat.service.ts', import.meta.url), 'utf8')
  const route = readFileSync(new URL('../app/api/chat/messages/route.ts', import.meta.url), 'utf8')
  const mail = readFileSync(new URL('../lib/email/product-notifications.server.ts', import.meta.url), 'utf8')

  assert.equal(/addDoc\(/.test(service), false)
  assert.equal(service.includes("fetch('/api/chat/messages'"), true)
  assert.equal((service.match(/fetch\('\/api\/chat\/messages'/g) ?? []).length, 2)
  const items = rules.slice(rules.indexOf('match /items/{messageId}'))
  assert.match(items, /allow create: if false;/)
  assert.match(rules, /affectedKeys\(\)\.hasOnly\(\['unread', 'participants'\]\)/)
  // outbox entry committed in the same transaction as the message, retried on duplicate
  assert.equal(route.includes("status: 'pending'"), true)
  assert.equal(route.includes("outcome === 'conflict'"), true)
  assert.equal(mail.includes('classifyOutboxEntry'), true)
  assert.equal(mail.includes('resolveEmailIdempotency'), true)
})
