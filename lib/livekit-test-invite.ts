import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto'

export const LIVEKIT_TEST_INVITE_TTL_MS = 60 * 60 * 1000
export const LIVEKIT_TEST_ROOM_PREFIX = 'admin-livekit-test'

interface LiveKitTestInvitePayload {
  v: 1
  roomId: string
  exp: number
  nonce: string
}

export type LiveKitTestInviteVerification =
  | { ok: true; roomId: string; expiresAt: number }
  | { ok: false; reason: 'invalid' | 'expired' | 'missing-secret' }

function base64UrlEncode(value: string | Buffer): string {
  return Buffer.from(value).toString('base64url')
}

function base64UrlDecode(value: string): string {
  return Buffer.from(value, 'base64url').toString('utf8')
}

function signPayload(encodedPayload: string, secret: string): string {
  return createHmac('sha256', secret).update(encodedPayload).digest('base64url')
}

function validRoomId(roomId: unknown): roomId is string {
  return typeof roomId === 'string' && new RegExp(`^${LIVEKIT_TEST_ROOM_PREFIX}-[a-f0-9]{24}$`).test(roomId)
}

function validNonce(nonce: unknown): nonce is string {
  return typeof nonce === 'string' && /^[a-f0-9]{32}$/.test(nonce)
}

export function createLiveKitTestInvite(secret: string | undefined, now = Date.now()): { invite: string; roomId: string; expiresAt: number } {
  if (!secret) throw new Error('Missing LiveKit test invite signing secret.')

  const roomId = `${LIVEKIT_TEST_ROOM_PREFIX}-${randomBytes(12).toString('hex')}`
  const expiresAt = now + LIVEKIT_TEST_INVITE_TTL_MS
  const payload: LiveKitTestInvitePayload = {
    v: 1,
    roomId,
    exp: expiresAt,
    nonce: randomBytes(16).toString('hex'),
  }
  const encodedPayload = base64UrlEncode(JSON.stringify(payload))
  const signature = signPayload(encodedPayload, secret)

  return {
    invite: `v1.${encodedPayload}.${signature}`,
    roomId,
    expiresAt,
  }
}

export function hashLiveKitTestInvite(invite: string, secret: string): string {
  return createHmac('sha256', secret).update(invite).digest('base64url')
}

export function verifyLiveKitTestInvite(invite: unknown, secret: string | undefined, now = Date.now()): LiveKitTestInviteVerification {
  if (!secret) return { ok: false, reason: 'missing-secret' }
  if (typeof invite !== 'string') return { ok: false, reason: 'invalid' }

  const parts = invite.split('.')
  if (parts.length !== 3 || parts[0] !== 'v1') return { ok: false, reason: 'invalid' }

  const [, encodedPayload, signature] = parts
  const expectedSignature = signPayload(encodedPayload, secret)
  const signatureBuffer = Buffer.from(signature, 'base64url')
  const expectedBuffer = Buffer.from(expectedSignature, 'base64url')
  if (signatureBuffer.length !== expectedBuffer.length || !timingSafeEqual(signatureBuffer, expectedBuffer)) {
    return { ok: false, reason: 'invalid' }
  }

  let payload: Partial<LiveKitTestInvitePayload>
  try {
    payload = JSON.parse(base64UrlDecode(encodedPayload)) as Partial<LiveKitTestInvitePayload>
  } catch {
    return { ok: false, reason: 'invalid' }
  }

  if (payload.v !== 1 || !validRoomId(payload.roomId) || typeof payload.exp !== 'number' || !validNonce(payload.nonce)) {
    return { ok: false, reason: 'invalid' }
  }
  if (payload.exp <= now) return { ok: false, reason: 'expired' }

  return {
    ok: true,
    roomId: payload.roomId,
    expiresAt: payload.exp,
  }
}
