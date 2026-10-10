import { NextResponse } from 'next/server'
import { adminDb, isAdminConfigured } from '@/lib/firebase-admin'
import { collections } from '@/lib/firebase'
import { getVerifiedUserRole, verifyCaller } from '@/lib/stripe-server-auth'
import { runbeeAppUrl, sendProductNotificationEmail } from '@/lib/email/product-notifications.server'
import { isLessonEmailEvent, planLessonEventEmails, type LessonEmailLesson } from '@/lib/email/lesson-event-emails-core'

/**
 * Called by the browser right after a lesson transition it just made
 * (cancel / reschedule / report / dispute ...) so the other parties get an
 * email. The client says only WHICH event; who is mailed, and whether the
 * event is even true, is decided from the lesson document the server
 * loads. Emails are idempotent per state, so calling twice never mails
 * twice. A mail failure never fails the caller (the transition is
 * already saved) — the outbox retries it later.
 */
export async function POST(request: Request) {
  if (!isAdminConfigured || !adminDb) return NextResponse.json({ error: 'Powiadomienia nie są skonfigurowane po stronie serwera.' }, { status: 503 })
  const body = await request.json().catch(() => null) as { idToken?: unknown; lessonId?: unknown; event?: unknown } | null
  const uid = await verifyCaller(typeof body?.idToken === 'string' ? body.idToken : undefined)
  if (!uid) return NextResponse.json({ error: 'Musisz być zalogowany.' }, { status: 401 })
  const lessonId = typeof body?.lessonId === 'string' ? body.lessonId.trim() : ''
  if (!lessonId || lessonId.length > 200 || !isLessonEmailEvent(body?.event)) {
    return NextResponse.json({ error: 'Nieprawidłowe zdarzenie.' }, { status: 400 })
  }

  const snap = await adminDb.collection(collections.lessons).doc(lessonId).get()
  if (!snap.exists) return NextResponse.json({ error: 'Nie znaleziono lekcji.' }, { status: 404 })
  const lesson = { id: snap.id, ...snap.data() } as LessonEmailLesson
  const role = await getVerifiedUserRole(uid)

  const plan = planLessonEventEmails({
    event: body.event,
    lesson,
    actorUid: uid,
    actorIsAdmin: role === 'admin',
    now: Date.now(),
    appUrl: runbeeAppUrl,
  })
  if (!plan.ok) return NextResponse.json({ error: plan.error }, { status: plan.status })

  const results = await Promise.all(plan.emails.map((email) => sendProductNotificationEmail(email)))
  return NextResponse.json({ ok: true, results: results.map((r) => r.status) })
}
