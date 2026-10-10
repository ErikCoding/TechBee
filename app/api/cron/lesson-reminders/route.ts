import { NextResponse } from 'next/server'
import { adminDb, isAdminConfigured } from '@/lib/firebase-admin'
import { collections } from '@/lib/firebase'
import { authorizeCronRequest } from '@/lib/lesson-report-auto-confirm'
import { runbeeAppUrl, sendProductNotificationEmail } from '@/lib/email/product-notifications.server'
import { isReminderDue, planLessonReminderEmails, REMINDER_WINDOW_MS, type LessonReminderLesson } from '@/lib/email/lesson-event-emails-core'

export const dynamic = 'force-dynamic'

const BATCH_LIMIT = 100

/**
 * 24h-before reminders. Run it at least hourly from an external
 * scheduler (`Authorization: Bearer <CRON_SECRET>`); each run mails every
 * confirmed lesson starting within the next 24h whose reminder was not
 * sent yet — the idempotency key contains the lesson start time, so more
 * frequent runs are harmless and a rescheduled lesson is reminded again.
 */
export async function GET(request: Request) {
  if (!isAdminConfigured || !adminDb) return NextResponse.json({ error: 'Zaufane zapisy Firestore nie są skonfigurowane.' }, { status: 503 })
  const auth = authorizeCronRequest(request.headers.get('authorization'), process.env.CRON_SECRET)
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const now = Date.now()
  // Range on a single field only → no composite index needed; status is filtered in code.
  const snap = await adminDb.collection(collections.lessons)
    .where('scheduledStartAt', '>', now)
    .where('scheduledStartAt', '<=', now + REMINDER_WINDOW_MS)
    .orderBy('scheduledStartAt', 'asc')
    .limit(BATCH_LIMIT)
    .get()

  let due = 0
  let emails = 0
  for (const doc of snap.docs) {
    const lesson = { id: doc.id, ...doc.data() } as LessonReminderLesson
    if (!isReminderDue(lesson, now)) continue
    due += 1
    for (const email of planLessonReminderEmails(lesson, runbeeAppUrl)) {
      const result = await sendProductNotificationEmail(email)
      if (result.status === 'sent') emails += 1
    }
  }
  return NextResponse.json({ scanned: snap.size, due, sent: emails })
}
