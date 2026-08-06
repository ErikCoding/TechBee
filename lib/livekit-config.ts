// ─────────────────────────────────────────────────────────────
// Shared LiveKit config — safe to import from client OR server code.
// Only ever reads the NEXT_PUBLIC_* URL; the API key/secret are
// server-only secrets that live exclusively in
// app/api/livekit/token/route.ts and never reach this file.
// ─────────────────────────────────────────────────────────────

export const LIVEKIT_URL = process.env.NEXT_PUBLIC_LIVEKIT_URL ?? ''

/**
 * True once a LiveKit deployment URL is configured. While false, the
 * lesson room shows a clear "not configured yet" state instead of
 * silently failing to connect — same posture as `isFirebaseConfigured`
 * in lib/firebase.ts.
 */
export const isLiveKitConfigured = Boolean(LIVEKIT_URL)

/**
 * Deterministic LiveKit room name derived from the lesson id — this
 * alone is what guarantees the teacher and student both land in the
 * *same* room: they both navigate to `/lesson/{id}/room`, and both
 * requests for a token resolve to `lesson-{id}`.
 */
export function lessonRoomName(lessonId: string): string {
  return `lesson-${lessonId}`
}
