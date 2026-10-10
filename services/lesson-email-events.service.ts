import { auth, isFirebaseConfigured } from '@/lib/firebase'
import type { LessonEmailEvent } from '@/lib/email/lesson-event-emails-core'

/**
 * Asks the server to email the other parties about a lesson transition the
 * caller has just saved. Best-effort by design: the transition is already
 * persisted, and the server-side outbox retries failed mail, so an error
 * here is swallowed and never surfaces to the user.
 */
export async function notifyLessonEvent(lessonId: string, event: LessonEmailEvent): Promise<void> {
  if (!isFirebaseConfigured) return
  try {
    const idToken = await auth?.currentUser?.getIdToken()
    if (!idToken) return
    await fetch('/api/notifications/lesson-event', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idToken, lessonId, event }),
    })
  } catch {
    // best-effort
  }
}
