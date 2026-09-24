import { NextResponse } from 'next/server'
import { adminDb } from '@/lib/firebase-admin'
import { collections } from '@/lib/firebase'
import { requireStripeBackend } from '@/lib/stripe-server-auth'
import { authorizeCronRequest, AUTO_CONFIRM_BATCH_SIZE, isReportAutoConfirmEligible, REPORT_AUTO_CONFIRM_MS, selectAutoConfirmCronBatch } from '@/lib/lesson-report-auto-confirm'
import { releaseLessonTeacherPayment } from '@/lib/lesson-release.server'
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
