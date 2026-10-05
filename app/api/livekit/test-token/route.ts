import { NextResponse } from 'next/server'
import { AccessToken } from 'livekit-server-sdk'
import { hashLiveKitTestInvite, verifyLiveKitTestInvite } from '@/lib/livekit-test-invite'
import { adminDb } from '@/lib/firebase-admin'
import { verifyCaller } from '@/lib/stripe-server-auth'
import { collections } from '@/lib/firebase'

interface TestTokenRequestBody {
  idToken?: string
  invite?: string
}

function liveKitTestInviteSecret(): string | undefined {
  return process.env.LIVEKIT_TEST_INVITE_SECRET || process.env.LIVEKIT_API_SECRET
}

async function displayNameForUid(uid: string): Promise<string> {
  if (!adminDb) return 'Uczestnik testu'
  const snap = await adminDb.collection(collections.users).doc(uid).get()
  const data = snap.data()
  const name = data?.name ?? data?.displayName ?? data?.email
  return typeof name === 'string' && name.trim() ? name.trim() : 'Uczestnik testu'
}

async function authorizeLiveKitTestInviteUse(inviteHash: string, uid: string, roomId: string, expiresAt: number): Promise<'ok' | 'missing' | 'expired' | 'claimed' | 'invalid'> {
  if (!adminDb) return 'missing'
  const now = Date.now()
  const ref = adminDb.collection(collections.liveKitTestSessions).doc(inviteHash)

  return adminDb.runTransaction(async (tx) => {
    const snap = await tx.get(ref)
    if (!snap.exists) return 'missing'

    const data = snap.data() ?? {}
    if (data.roomId !== roomId || data.expiresAt !== expiresAt) return 'invalid'
    if (typeof data.expiresAt !== 'number' || data.expiresAt <= now) return 'expired'

    if (data.createdByAdminUid === uid) return 'ok'

    const invitedUid = typeof data.invitedUid === 'string' ? data.invitedUid : null
    if (!invitedUid) {
      tx.update(ref, { invitedUid: uid, invitedAt: now })
      return 'ok'
    }

    return invitedUid === uid ? 'ok' : 'claimed'
  })
}

export async function POST(request: Request) {
  const apiKey = process.env.LIVEKIT_API_KEY
  const apiSecret = process.env.LIVEKIT_API_SECRET
  const livekitUrl = process.env.NEXT_PUBLIC_LIVEKIT_URL
  const inviteSecret = liveKitTestInviteSecret()

  if (!apiKey || !apiSecret || !livekitUrl || !inviteSecret) {
    return NextResponse.json({ error: 'Test LiveKit nie jest skonfigurowany.' }, { status: 503 })
  }

  let body: TestTokenRequestBody
  try {
    body = (await request.json()) as TestTokenRequestBody
  } catch {
    return NextResponse.json({ error: 'Nieprawidłowe żądanie.' }, { status: 400 })
  }

  const uid = await verifyCaller(body.idToken)
  if (!uid) {
    return NextResponse.json({ error: 'Musisz być zalogowany, aby dołączyć do testu LiveKit.' }, { status: 401 })
  }

  const invite = verifyLiveKitTestInvite(body.invite, inviteSecret)
  if (!invite.ok) {
    const message = invite.reason === 'expired'
      ? 'Link testowy wygasł. Poproś administratora o nowy link.'
      : 'Link testowy jest nieprawidłowy.'
    return NextResponse.json({ error: message }, { status: 403 })
  }
  if (!adminDb) {
    return NextResponse.json({ error: 'Zaufane zapisy Firestore nie są skonfigurowane.' }, { status: 503 })
  }

  const inviteHash = hashLiveKitTestInvite(body.invite!, inviteSecret)
  const authorization = await authorizeLiveKitTestInviteUse(inviteHash, uid, invite.roomId, invite.expiresAt)
  if (authorization !== 'ok') {
    const message = authorization === 'claimed'
      ? 'Ten link testowy został już przypisany do innego użytkownika.'
      : authorization === 'expired'
        ? 'Link testowy wygasł. Poproś administratora o nowy link.'
        : 'Link testowy jest nieprawidłowy.'
    return NextResponse.json({ error: message }, { status: 403 })
  }

  try {
    const token = new AccessToken(apiKey, apiSecret, {
      identity: uid,
      name: await displayNameForUid(uid),
      ttl: '3h',
    })
    token.addGrant({
      room: invite.roomId,
      roomJoin: true,
      canPublish: true,
      canSubscribe: true,
      canPublishData: true,
    })

    return NextResponse.json({
      token: await token.toJwt(),
      url: livekitUrl,
      roomId: invite.roomId,
      expiresAt: invite.expiresAt,
    })
  } catch (err) {
    console.error('[livekit/test-token] Failed to mint LiveKit test token:', err)
    return NextResponse.json({ error: 'Nie udało się utworzyć tokenu do testu LiveKit.' }, { status: 500 })
  }
}
