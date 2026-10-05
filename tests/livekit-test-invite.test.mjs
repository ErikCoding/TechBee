import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import {
  createLiveKitTestInvite,
  hashLiveKitTestInvite,
  LIVEKIT_TEST_INVITE_TTL_MS,
  LIVEKIT_TEST_ROOM_PREFIX,
  verifyLiveKitTestInvite,
} from '../lib/livekit-test-invite.ts'

test('LiveKit test invite is random, room-scoped, signed, and expires after 60 minutes', () => {
  const now = Date.parse('2026-10-05T12:00:00Z')
  const first = createLiveKitTestInvite('secret', now)
  const second = createLiveKitTestInvite('secret', now)

  assert.notEqual(first.invite, second.invite)
  assert.notEqual(first.roomId, second.roomId)
  assert.equal(first.expiresAt, now + LIVEKIT_TEST_INVITE_TTL_MS)
  assert.match(first.roomId, new RegExp(`^${LIVEKIT_TEST_ROOM_PREFIX}-[a-f0-9]{24}$`))

  const verified = verifyLiveKitTestInvite(first.invite, 'secret', now)
  assert.deepEqual(verified, { ok: true, roomId: first.roomId, expiresAt: first.expiresAt })
})

test('LiveKit test invite rejects tampering, wrong secret, and expired tokens', () => {
  const now = Date.parse('2026-10-05T12:00:00Z')
  const invite = createLiveKitTestInvite('secret', now)

  assert.deepEqual(verifyLiveKitTestInvite(`${invite.invite}x`, 'secret', now), { ok: false, reason: 'invalid' })
  assert.deepEqual(verifyLiveKitTestInvite(invite.invite, 'other-secret', now), { ok: false, reason: 'invalid' })
  assert.deepEqual(verifyLiveKitTestInvite(invite.invite, 'secret', invite.expiresAt), { ok: false, reason: 'expired' })
  assert.deepEqual(verifyLiveKitTestInvite(invite.invite, undefined, now), { ok: false, reason: 'missing-secret' })
})

test('LiveKit test invite hash is stable and does not reveal the plaintext invite', () => {
  const invite = createLiveKitTestInvite('secret', Date.parse('2026-10-05T12:00:00Z'))
  const hash = hashLiveKitTestInvite(invite.invite, 'secret')

  assert.equal(hash, hashLiveKitTestInvite(invite.invite, 'secret'))
  assert.notEqual(hash, invite.invite)
  assert.equal(hash.includes(invite.invite), false)
})

test('LiveKit test endpoints enforce admin/user auth and stay isolated from lesson/payment side effects', () => {
  const sessionRoute = readFileSync(new URL('../app/api/livekit/test-session/route.ts', import.meta.url), 'utf8')
  const tokenRoute = readFileSync(new URL('../app/api/livekit/test-token/route.ts', import.meta.url), 'utf8')
  const adminClient = readFileSync(new URL('../components/admin/admin-livekit-test-client.tsx', import.meta.url), 'utf8')
  const joinClient = readFileSync(new URL('../components/lesson/livekit-test-join-client.tsx', import.meta.url), 'utf8')
  const roomView = readFileSync(new URL('../components/lesson/livekit-test-room-view.tsx', import.meta.url), 'utf8')
  const combined = [sessionRoute, tokenRoute, adminClient, joinClient, roomView].join('\n')

  assert.equal(sessionRoute.includes('requireAdminRequest'), true)
  assert.equal(sessionRoute.includes('hashLiveKitTestInvite'), true)
  assert.equal(tokenRoute.includes('hashLiveKitTestInvite'), true)
  assert.equal(tokenRoute.includes('verifyCaller'), true)
  assert.equal(combined.includes('completeLesson'), false)
  assert.equal(combined.includes('endLessonPermanently'), false)
  assert.equal(combined.includes('releaseLessonTeacherPayment'), false)
  assert.equal(combined.includes('stripe.transfers'), false)
  assert.equal(combined.includes('stripe.payouts'), false)
  assert.equal(combined.includes('trialLessonGuards'), false)
  assert.equal(combined.includes('lessonPackageBookingRequests'), false)
})
