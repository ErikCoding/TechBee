import { auth } from '@/lib/firebase'

// ─────────────────────────────────────────────────────────────
// Client-side helper for joining a lesson's LiveKit room. Talks to
// app/api/livekit/token, which is the only place the LiveKit API
// key/secret exist — this file never sees them.
// ─────────────────────────────────────────────────────────────

export interface LiveKitTokenResult {
  token: string
  url: string
}

interface RequestTokenInput {
  lessonId: string
  identity: string
  name: string
}

/**
 * Requests a room-join token for a lesson. Attaches the signed-in
 * user's real Firebase ID token when a Firebase session exists, so
 * the server can verify it's genuinely that lesson's teacher/student
 * (see app/api/livekit/token/route.ts) — falls back to the plain
 * identity/name otherwise, same dual-mode posture as every other
 * service in this app before Firebase is fully wired up.
 */
export async function requestLiveKitToken(input: RequestTokenInput): Promise<LiveKitTokenResult> {
  const idToken = await auth?.currentUser?.getIdToken().catch(() => undefined)

  const res = await fetch('/api/livekit/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...input, idToken }),
  })

  const data = await res.json().catch(() => ({}) as Record<string, unknown>)
  if (!res.ok) {
    throw new Error(typeof data.error === 'string' ? data.error : 'Nie udało się dołączyć do lekcji.')
  }
  return data as LiveKitTokenResult
}
