import { auth } from '@/lib/firebase'
import type { LiveKitTokenResult } from '@/services/livekit.service'

export interface LiveKitTestSession {
  invite: string
  inviteUrl: string
  roomId: string
  expiresAt: number
}

export interface LiveKitTestTokenResult extends LiveKitTokenResult {
  roomId: string
  expiresAt: number
}

async function currentIdToken(): Promise<string | undefined> {
  return auth?.currentUser?.getIdToken().catch(() => undefined)
}

export async function createLiveKitTestSession(): Promise<LiveKitTestSession> {
  const idToken = await currentIdToken()
  const res = await fetch('/api/livekit/test-session', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ idToken }),
  })
  const data = await res.json().catch(() => ({}) as Record<string, unknown>)
  if (!res.ok) {
    throw new Error(typeof data.error === 'string' ? data.error : 'Nie udało się utworzyć testu LiveKit.')
  }
  return data as LiveKitTestSession
}

export async function requestLiveKitTestToken(invite: string): Promise<LiveKitTestTokenResult> {
  const idToken = await currentIdToken()
  const res = await fetch('/api/livekit/test-token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ idToken, invite }),
  })
  const data = await res.json().catch(() => ({}) as Record<string, unknown>)
  if (!res.ok) {
    throw new Error(typeof data.error === 'string' ? data.error : 'Nie udało się dołączyć do testu LiveKit.')
  }
  return data as LiveKitTestTokenResult
}
