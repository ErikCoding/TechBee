import { NextResponse } from 'next/server'
import { adminDb } from '@/lib/firebase-admin'
import { collections } from '@/lib/firebase'
import { requireStripeBackend } from '@/lib/stripe-server-auth'
import { authorizeCronRequest, AUTO_CONFIRM_BATCH_SIZE, isReportAutoConfirmEligible, REPORT_AUTO_CONFIRM_MS, selectAutoConfirmCronBatch } from '@/lib/lesson-report-auto-confirm'
import { releaseLessonTeacherPayment } from '@/lib/lesson-release.server'
import { runbeeAppUrl, sendProductNotificationEmail } from '@/lib/email/product-notifications.server'
import type { Lesson } from '@/lib/types'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const backendError = requireStripeBackend()
  if (backendError) return backendError

  const auth = authorizeCronRequest(request.headers.get('authorization'), process.env.CRON_SECRET)
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const now = Date.now()
  const cutoff = now - REPORT_AUTO_CONFIRM_MS
  const snap = await adminDb!
    .collection(collections.lessons)
    .where('paymentStatus', '==', 'paid')
    .where('paymentReleased', '==', false)
    .where('reportConfirmedAt', '==', null)
    .where('reportSubmittedAt', '<=', cutoff)
    .orderBy('reportSubmittedAt', 'asc')
    .limit(AUTO_CONFIRM_BATCH_SIZE)
    .get()

  const queriedLessons = snap.docs.map((doc) => ({ id: doc.id, ...(doc.data() as Omit<Lesson, 'id'>) }))
  const candidates = selectAutoConfirmCronBatch(queriedLessons, now, AUTO_CONFIRM_BATCH_SIZE)
    .filter((lesson) => isReportAutoConfirmEligible(lesson, now))

  const summary = {
    scanned: snap.size,
    candidates: candidates.length,
    processed: 0,
    released: 0,
    alreadyTransferred: 0,
    skipped: snap.size - candidates.length,
    failed: 0,
    failureCodes: {} as Record<string, number>,
  }

  for (const lesson of candidates) {
    summary.processed += 1
    try {
      const release = await releaseLessonTeacherPayment(lesson.id, now)
      if (release.ok) {
        if (release.alreadyTransferred) {
          summary.alreadyTransferred += 1
        } else {
          summary.released += 1
          // Whoever was supposed to confirm (and the payer) learns the 24h window ended.
          const recipients = [...new Set([lesson.confirmingPartyId, lesson.payerId, lesson.studentId].filter((id): id is string => typeof id === 'string' && id.length > 0))]
          for (const uid of recipients) {
            await sendProductNotificationEmail({
              eventId: `lesson:${lesson.id}:report-auto-confirmed:${uid}`,
              recipientUid: uid,
              type: 'reports.reportAccepted',
              subject: 'Raport z lekcji został potwierdzony automatycznie',
              title: 'Raport potwierdzony automatycznie',
              preheader: 'Minęło 24 godziny na potwierdzenie raportu.',
              body: `Nie zgłoszono decyzji w ciągu 24 godzin, więc raport z lekcji „${lesson.topic ?? 'Lekcja'}” został potwierdzony automatycznie, a płatność zwolniona nauczycielowi.`,
              cta: { label: 'Otwórz raporty', href: runbeeAppUrl('/reports') },
            })
          }
        }
      } else {
        summary.failed += 1
        summary.failureCodes[release.code] = (summary.failureCodes[release.code] ?? 0) + 1
      }
    } catch {
      summary.failed += 1
      summary.failureCodes.unexpected_error = (summary.failureCodes.unexpected_error ?? 0) + 1
    }
  }

  return NextResponse.json(summary)
}
