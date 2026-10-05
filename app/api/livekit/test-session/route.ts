import { NextResponse } from 'next/server'
import { requireAdminRequest } from '@/lib/admin-api-auth'
import { adminDb } from '@/lib/firebase-admin'
import { collections } from '@/lib/firebase'
import { createLiveKitTestInvite, hashLiveKitTestInvite } from '@/lib/livekit-test-invite'

interface TestSessionRequestBody {
  idToken?: string
}

function liveKitTestInviteSecret(): string | undefined {
  return process.env.LIVEKIT_TEST_INVITE_SECRET || process.env.LIVEKIT_API_SECRET
}

export async function POST(request: Request) {
  const apiKey = process.env.LIVEKIT_API_KEY
  const apiSecret = process.env.LIVEKIT_API_SECRET
  const livekitUrl = process.env.NEXT_PUBLIC_LIVEKIT_URL
  const secret = liveKitTestInviteSecret()
  if (!apiKey || !apiSecret || !livekitUrl || !secret) {
    return NextResponse.json({ error: 'Test LiveKit nie jest skonfigurowany.' }, { status: 503 })
  }

  let body: TestSessionRequestBody
  try {
    body = (await request.json()) as TestSessionRequestBody
  } catch {
    return NextResponse.json({ error: 'Nieprawidłowe żądanie.' }, { status: 400 })
  }

  const admin = await requireAdminRequest(body.idToken, 'testem LiveKit')
  if (admin instanceof NextResponse) return admin
  if (!adminDb) {
    return NextResponse.json({ error: 'Zaufane zapisy Firestore nie są skonfigurowane.' }, { status: 503 })
  }

  const invite = createLiveKitTestInvite(secret)
  const inviteHash = hashLiveKitTestInvite(invite.invite, secret)
  await adminDb.collection(collections.liveKitTestSessions).doc(inviteHash).set({
    roomId: invite.roomId,
    expiresAt: invite.expiresAt,
    createdAt: Date.now(),
    createdByAdminUid: admin.uid,
    invitedUid: null,
  })

  const inviteUrl = new URL('/livekit-test/join', request.url)
  inviteUrl.searchParams.set('invite', invite.invite)

  return NextResponse.json({
    invite: invite.invite,
    inviteUrl: inviteUrl.toString(),
    roomId: invite.roomId,
    expiresAt: invite.expiresAt,
  })
}
