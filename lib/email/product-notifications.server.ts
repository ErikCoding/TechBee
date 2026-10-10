import 'server-only'

import { adminDb } from '@/lib/firebase-admin'
import { collections } from '@/lib/firebase'
import { sendTransactionalEmail, textToEmailParagraphs } from '@/lib/email/transactional-email.server'
import {
  buildOutboxPayload,
  classifyOutboxEntry,
  inputFromOutboxDoc,
  isRequiredOutboxEntry,
  productEmailDocId,
  resolveEmailIdempotency,
  validateProductEmailRecipient,
  type ProductEmailInput,
  type ProductEmailRecipient,
} from '@/lib/email/product-notifications-core'

type ProductEmailResult =
  | { status: 'not_configured' }
  | { status: 'duplicate' | 'missing_recipient' | 'skipped_preferences' | 'sending' | 'failed' | 'expired' }
  | { status: 'sent'; id: string | null }

const FALLBACK_SITE_URL = 'https://runbee.pl'

function siteUrl(): string {
  return process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, '') || FALLBACK_SITE_URL
}

function safeDetails(details: ProductEmailInput['details']) {
  return details?.filter((detail) => detail.label.trim() && detail.value.trim())
}

/**
 * Sends one product email at most once per `eventId`, and never throws —
 * a mail problem must not undo a payment, booking or any other operation.
 *
 * Delivery guarantees:
 *  - The emailEvents doc (id = sha256(eventId)) is the outbox entry. The
 *    full payload is stored on it so a failed/abandoned entry can be
 *    rebuilt and retried later (see retryPendingProductEmails + the
 *    /api/cron/email-outbox endpoint).
 *  - Resend gets a stable Idempotency-Key, so a retry after an ambiguous
 *    outcome (timeout, crash after Resend accepted) inside Resend's 24h
 *    window cannot create a second email. Entries older than that window
 *    are marked "expired" instead of being retried.
 *  - Skipped (preferences / no address) and sent entries are final.
 */
export async function sendProductNotificationEmail(input: ProductEmailInput): Promise<ProductEmailResult> {
  if (!adminDb) return { status: 'not_configured' }
  const eventRef = adminDb.collection(collections.emailEvents).doc(productEmailDocId(input.eventId))
  const recipientRef = adminDb.collection(collections.users).doc(input.recipientUid)

  try {
    const reservation = await adminDb.runTransaction(async (tx) => {
      const existing = await tx.get(eventRef)
      let attempts = 0
      let createdAt = Date.now()
      if (existing.exists) {
        const data = (existing.data() ?? {}) as Record<string, unknown>
        const verdict = classifyOutboxEntry(data, Date.now())
        if (verdict === 'expire') {
          tx.set(eventRef, { status: 'expired', updatedAt: Date.now() }, { merge: true })
          return { status: 'expired' as const }
        }
        if (verdict === 'skip') return { status: 'duplicate' as const }
        attempts = typeof data.attempts === 'number' ? data.attempts : 0
        createdAt = typeof data.createdAt === 'number' ? data.createdAt : createdAt
      }

      const recipientSnap = await tx.get(recipientRef)
      const recipient = recipientSnap.exists
        ? ({ uid: recipientSnap.id, ...recipientSnap.data() } as ProductEmailRecipient)
        : null
      const skipStatus = validateProductEmailRecipient(recipient, input)
      const base = {
        eventId: input.eventId,
        recipientUid: input.recipientUid,
        type: input.type,
        attempts,
        createdAt,
        updatedAt: Date.now(),
      }
      if (skipStatus) {
        tx.set(eventRef, { ...base, status: skipStatus }, { merge: true })
        return { status: skipStatus, recipient: null }
      }

      const idem = resolveEmailIdempotency(input.eventId, existing.exists ? (existing.data() as Record<string, unknown>) : undefined, Date.now())
      tx.set(eventRef, {
        ...base,
        status: 'sending',
        attempts: attempts + 1,
        payload: buildOutboxPayload(input),
        keyGeneration: idem.generation,
        keyIssuedAt: idem.issuedAt,
      }, { merge: true })
      return { status: 'sending' as const, recipient, idempotencyKey: idem.key }
    })

    if (reservation.status !== 'sending' || !('recipient' in reservation) || !reservation.recipient?.email || !('idempotencyKey' in reservation)) {
      if (reservation.status === 'duplicate') return { status: 'duplicate' }
      if (reservation.status === 'expired') return { status: 'expired' }
      if (reservation.status === 'missing_recipient') return { status: 'missing_recipient' }
      if (reservation.status === 'skipped_preferences') return { status: 'skipped_preferences' }
      return { status: 'failed' }
    }

    const sent = await sendTransactionalEmail({
      to: reservation.recipient.email,
      subject: input.subject,
      title: input.title,
      preheader: input.preheader,
      contentHtml: textToEmailParagraphs(input.body),
      text: input.body,
      details: safeDetails(input.details),
      cta: input.cta,
      secondaryText: input.secondaryText,
      idempotencyKey: reservation.idempotencyKey,
    })
    await eventRef.set({
      status: 'sent',
      resendId: sent.id,
      sentAt: Date.now(),
      updatedAt: Date.now(),
    }, { merge: true })
    return { status: 'sent', id: sent.id }
  } catch (error) {
    console.error('[email/product] Failed to send product notification', {
      eventId: input.eventId,
      type: input.type,
      recipientUid: input.recipientUid,
      message: error instanceof Error ? error.message : 'Unknown error',
    })
    await eventRef.set({
      status: 'failed',
      failedAt: Date.now(),
      updatedAt: Date.now(),
      errorCode: 'send_failed',
    }, { merge: true }).catch(() => {})
    return { status: 'failed' }
  }
}

export type OutboxSweepSummary = { scanned: number; retried: number; sent: number; failed: number; expired: number; skipped: number }

/**
 * Re-drives unsent emailEvents (pending / failed with attempts left /
 * abandoned "sending"). Bounded by `limit`; each entry goes through the
 * same claim-and-send path as a first attempt, so the transaction + the
 * Resend idempotency key keep this safe against concurrent sweeps.
 */
export async function retryPendingProductEmails(options: { limit?: number; now?: number } = {}): Promise<OutboxSweepSummary> {
  const summary: OutboxSweepSummary = { scanned: 0, retried: 0, sent: 0, failed: 0, expired: 0, skipped: 0 }
  if (!adminDb) return summary
  const limit = Math.min(Math.max(options.limit ?? 25, 1), 50)
  const now = options.now ?? Date.now()
  // Single-field `in` query (no composite index); staleness/attempts are decided in code.
  const snap = await adminDb.collection(collections.emailEvents).where('status', 'in', ['pending', 'failed', 'sending']).limit(limit * 4).get()
  summary.scanned = snap.size
  for (const doc of snap.docs) {
    if (summary.retried >= limit) break
    const data = doc.data() as Record<string, unknown>
    const verdict = classifyOutboxEntry(data, now)
    if (verdict === 'skip') {
      // Failed with no attempts left: park it, so it stops occupying the sweep window.
      if (data.status === 'failed') await doc.ref.set({ status: 'abandoned', updatedAt: now }, { merge: true })
      summary.skipped += 1
      continue
    }
    if (verdict === 'expire') {
      await doc.ref.set({ status: 'expired', updatedAt: now }, { merge: true })
      if (isRequiredOutboxEntry(data)) {
        console.error('[email/product] Required email expired undelivered', { eventId: data.eventId, type: data.type, recipientUid: data.recipientUid })
      }
      summary.expired += 1
      continue
    }
    const input = inputFromOutboxDoc(data)
    if (!input) {
      // Nothing to rebuild the email from (e.g. entry written before payloads were stored).
      await doc.ref.set({ status: 'expired', updatedAt: now, errorCode: 'missing_payload' }, { merge: true })
      summary.expired += 1
      continue
    }
    summary.retried += 1
    const result = await sendProductNotificationEmail(input)
    if (result.status === 'sent') summary.sent += 1
    else if (result.status === 'failed') summary.failed += 1
    else summary.skipped += 1
  }
  return summary
}

export function runbeeAppUrl(path = '/'): string {
  const base = siteUrl()
  return `${base}${path.startsWith('/') ? path : `/${path}`}`
}
