import { createHash } from 'node:crypto'

type ProductEmailType =
  | 'lessons.bookingCreated'
  | 'lessons.bookingChanged'
  | 'lessons.bookingCancelled'
  | 'lessons.lessonReminder'
  | 'reports.reportReady'
  | 'reports.reportAccepted'
  | 'payments.paymentConfirmation'
  | 'payments.refund'
  | 'payments.payout'
  | 'messages.newMessage'
  | 'product.productUpdates'
  | 'account.deletionStatus'

export type ProductEmailEventStatus = 'pending' | 'expired' | 'abandoned' | 'sending' | 'sent' | 'failed' | 'skipped_preferences' | 'missing_recipient' | 'duplicate'

export type ProductEmailRecipient = {
  uid: string
  email?: string | null
  name?: string | null
  notificationPreferences?: unknown
}

export type ProductEmailInput = {
  eventId: string
  recipientUid: string
  type: ProductEmailType
  subject: string
  title: string
  body: string
  preheader?: string
  required?: boolean
  details?: { label: string; value: string }[]
  cta?: { label: string; href: string }
  secondaryText?: string
}

export function productEmailDocId(eventId: string): string {
  return createHash('sha256').update(eventId).digest('hex')
}

export function shouldSendProductEmail(recipient: ProductEmailRecipient, type: ProductEmailType, required = false): boolean {
  if (required) return true
  const [group, key] = type.split('.')
  const root = recipient.notificationPreferences
  if (!root || typeof root !== 'object' || Array.isArray(root)) return type !== 'product.productUpdates'
  const email = (root as { email?: unknown }).email
  if (!email || typeof email !== 'object' || Array.isArray(email)) return type !== 'product.productUpdates'
  const groupPrefs = (email as Record<string, unknown>)[group]
  if (!groupPrefs || typeof groupPrefs !== 'object' || Array.isArray(groupPrefs)) return type !== 'product.productUpdates'
  const value = (groupPrefs as Record<string, unknown>)[key]
  return typeof value === 'boolean' ? value : type !== 'product.productUpdates'
}

export function validateProductEmailRecipient(recipient: ProductEmailRecipient | null, input: ProductEmailInput): ProductEmailEventStatus | null {
  if (!recipient?.email) return 'missing_recipient'
  if (!shouldSendProductEmail(recipient, input.type, input.required)) return 'skipped_preferences'
  return null
}

// ── Outbox (durable retry) ────────────────────────────────────

/** Resend remembers an Idempotency-Key for 24h; retrying inside that window can never produce a second email, so nothing is retried after it. */
export const EMAIL_IDEMPOTENCY_WINDOW_MS = 24 * 60 * 60 * 1000
export const EMAIL_SENDING_STALE_MS = 5 * 60 * 1000
export const MAX_EMAIL_ATTEMPTS = 5
/** Resend's SDK accepts keys up to 256 chars; the sha256 doc id is always 64. */
export function emailIdempotencyKey(eventId: string): string {
  return `runbee-${productEmailDocId(eventId)}`
}

/** Serialisable copy of what has to be sent, stored on the emailEvents doc so any later retry can rebuild the exact same email without the original request. */
export function buildOutboxPayload(input: ProductEmailInput): Record<string, unknown> {
  return {
    subject: input.subject,
    title: input.title,
    body: input.body,
    ...(input.preheader ? { preheader: input.preheader } : {}),
    ...(input.required ? { required: true } : {}),
    ...(input.details?.length ? { details: input.details } : {}),
    ...(input.cta ? { cta: input.cta } : {}),
    ...(input.secondaryText ? { secondaryText: input.secondaryText } : {}),
  }
}

export function inputFromOutboxDoc(data: Record<string, unknown> | undefined): ProductEmailInput | null {
  if (!data || typeof data.eventId !== 'string' || typeof data.recipientUid !== 'string' || typeof data.type !== 'string') return null
  const p = data.payload
  if (!p || typeof p !== 'object' || Array.isArray(p)) return null
  const payload = p as Record<string, unknown>
  if (typeof payload.subject !== 'string' || typeof payload.title !== 'string' || typeof payload.body !== 'string') return null
  return {
    eventId: data.eventId,
    recipientUid: data.recipientUid,
    type: data.type as ProductEmailType,
    subject: payload.subject,
    title: payload.title,
    body: payload.body,
    ...(typeof payload.preheader === 'string' ? { preheader: payload.preheader } : {}),
    ...(payload.required === true ? { required: true } : {}),
    ...(Array.isArray(payload.details) ? { details: payload.details as { label: string; value: string }[] } : {}),
    ...(payload.cta && typeof payload.cta === 'object' ? { cta: payload.cta as { label: string; href: string } } : {}),
    ...(typeof payload.secondaryText === 'string' ? { secondaryText: payload.secondaryText } : {}),
  }
}

/**
 * What may happen to an existing emailEvents entry:
 *  - retry:  pending; failed with attempts left; sending abandoned by a crashed process
 *  - expire: still unsent but older than the idempotency window (no safe retry any more)
 *  - skip:   everything final (sent, skipped by preference, missing recipient, expired, exhausted)
 */
export function classifyOutboxEntry(data: Record<string, unknown>, now: number): 'retry' | 'expire' | 'skip' {
  const status = data.status
  const attempts = typeof data.attempts === 'number' ? data.attempts : 0
  const createdAt = Number(data.createdAt ?? 0)
  const lastTouch = Number(data.updatedAt ?? data.createdAt ?? 0)
  const unsent = status === 'pending' || status === 'failed' || (status === 'sending' && now - lastTouch > EMAIL_SENDING_STALE_MS)
  if (!unsent) return 'skip'
  // Optional mails (reminders, chat, receipts) are stale after Resend's idempotency window.
  // Required mails (access closure, disputes, failed payouts, deletion status) keep being
  // retried — with a rotated idempotency key once the old one has expired — for a week.
  const required = isRequiredOutboxEntry(data)
  const maxAge = required ? EMAIL_REQUIRED_RETENTION_MS : EMAIL_IDEMPOTENCY_WINDOW_MS
  if (createdAt > 0 && now - createdAt > maxAge) return 'expire'
  const maxAttempts = required ? MAX_REQUIRED_EMAIL_ATTEMPTS : MAX_EMAIL_ATTEMPTS
  if (status === 'failed' && attempts >= maxAttempts) return 'skip'
  return 'retry'
}

export function isRequiredOutboxEntry(data: Record<string, unknown> | undefined): boolean {
  const p = data?.payload
  return Boolean(p && typeof p === 'object' && !Array.isArray(p) && (p as Record<string, unknown>).required === true)
}

/** Required mails are retried for up to a week, with at most this many sends. */
export const EMAIL_REQUIRED_RETENTION_MS = 7 * 24 * 60 * 60 * 1000
export const MAX_REQUIRED_EMAIL_ATTEMPTS = 30
/** A key is only rotated once Resend has certainly forgotten it (24h window + margin). */
export const EMAIL_KEY_ROTATION_MS = 25 * 60 * 60 * 1000

/**
 * Idempotency key for the next send of an outbox entry. Stays identical
 * while Resend still remembers it (so any retry inside the window can never
 * duplicate); rotates to `-g<n>` only after EMAIL_KEY_ROTATION_MS, which only
 * ever happens for required mails that are still undelivered after a day.
 * (Residual risk: a mail that Resend delivered but we never recorded, more
 * than 25h ago, can be delivered a second time — accepted for required mails.)
 */
export function resolveEmailIdempotency(
  eventId: string,
  existing: Record<string, unknown> | undefined,
  now: number,
): { key: string; generation: number; issuedAt: number } {
  let generation = typeof existing?.keyGeneration === 'number' ? existing.keyGeneration : 0
  let issuedAt = Number(existing?.keyIssuedAt ?? existing?.createdAt ?? now)
  if (!Number.isFinite(issuedAt) || issuedAt <= 0) issuedAt = now
  if (existing && now - issuedAt >= EMAIL_KEY_ROTATION_MS) {
    generation += 1
    issuedAt = now
  }
  const base = emailIdempotencyKey(eventId)
  return { key: generation === 0 ? base : `${base}-g${generation}`, generation, issuedAt }
}
