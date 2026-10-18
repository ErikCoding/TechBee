import { NextResponse } from 'next/server'
import { adminDb } from '@/lib/firebase-admin'
import { verifyCaller } from '@/lib/stripe-server-auth'
import { rescheduleLesson, ScheduleError } from '@/lib/lesson-reschedule.server'
import { planLessonEventEmails } from '@/lib/email/lesson-event-emails-core'
import { runbeeAppUrl, sendProductNotificationEmail } from '@/lib/email/product-notifications.server'

export async function POST(request: Request, { params }: { params: Promise<{ lessonId: string }> }) {
  if (!adminDb) return NextResponse.json({ error: 'Zapis jest chwilowo niedostępny.' }, { status: 503 })
  const body = await request.json().catch(() => null)
  const uid = await verifyCaller(typeof body?.idToken === 'string' ? body.idToken : undefined)
  if (!uid) return NextResponse.json({ error: 'Zaloguj się ponownie.' }, { status: 401 })
  try {
    const { lessonId } = await params
    const result = await rescheduleLesson(adminDb, uid, { ...body, lessonId })
    if (result.event) {
      const plan = planLessonEventEmails({ event: result.event, lesson: result.lesson, actorUid: result.emailActorUid, actorIsAdmin: false, now: Date.now(), appUrl: runbeeAppUrl })
      if (plan.ok) await Promise.all(plan.emails.map((email) => sendProductNotificationEmail(email))).catch(() => console.error('[reschedule] Notification delivery failed'))
    }
    return NextResponse.json({ ok: true })
  } catch (error) {
    return NextResponse.json({ error: error instanceof ScheduleError ? error.message : 'Nie udało się zmienić terminu. Spróbuj ponownie.' }, { status: error instanceof ScheduleError ? error.status : 503 })
  }
}
