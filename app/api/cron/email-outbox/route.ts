import { NextResponse } from 'next/server'
import { isAdminConfigured } from '@/lib/firebase-admin'
import { authorizeCronRequest } from '@/lib/lesson-report-auto-confirm'
import { retryPendingProductEmails } from '@/lib/email/product-notifications.server'

export const dynamic = 'force-dynamic'

/**
 * Re-sends product emails that are still "pending", "failed" (attempts left)
 * or stuck in "sending". Same auth scheme as the other cron endpoints:
 * `Authorization: Bearer <CRON_SECRET>`. Bounded batch; safe to call as
 * often as every few minutes — Resend idempotency keys + the outbox claim
 * transaction make overlapping runs harmless.
 */
export async function GET(request: Request) {
  if (!isAdminConfigured) return NextResponse.json({ error: 'Zaufane zapisy Firestore nie są skonfigurowane.' }, { status: 503 })
  const auth = authorizeCronRequest(request.headers.get('authorization'), process.env.CRON_SECRET)
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })
  const summary = await retryPendingProductEmails({ limit: 25 })
  return NextResponse.json(summary)
}
