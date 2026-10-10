import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import {
  EMAIL_IDEMPOTENCY_WINDOW_MS,
  EMAIL_REQUIRED_RETENTION_MS,
  EMAIL_SENDING_STALE_MS,
  MAX_EMAIL_ATTEMPTS,
  MAX_REQUIRED_EMAIL_ATTEMPTS,
  buildOutboxPayload,
  classifyOutboxEntry,
  emailIdempotencyKey,
  inputFromOutboxDoc,
  isRequiredOutboxEntry,
  resolveEmailIdempotency,
  shouldSendProductEmail,
  validateProductEmailRecipient,
} from '../lib/email/product-notifications-core.ts'
import {
  isReminderDue,
  planLessonEventEmails,
  planLessonReminderEmails,
} from '../lib/email/lesson-event-emails-core.ts'

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')
const appUrl = (path) => `https://runbee.test${path}`
const NOW = 1_800_000_000_000

// ── Outbox state machine ──────────────────────────────────────

test('outbox: pending/failed/abandoned-sending are retried, final states never', () => {
  const fresh = { createdAt: NOW - 1000, updatedAt: NOW - 1000 }
  assert.equal(classifyOutboxEntry({ ...fresh, status: 'pending', attempts: 0 }, NOW), 'retry')
  assert.equal(classifyOutboxEntry({ ...fresh, status: 'failed', attempts: 2 }, NOW), 'retry')
  assert.equal(classifyOutboxEntry({ ...fresh, status: 'failed', attempts: MAX_EMAIL_ATTEMPTS }, NOW), 'skip')
  // a "sending" entry is only reclaimed once the owner is presumed dead
  assert.equal(classifyOutboxEntry({ ...fresh, status: 'sending', attempts: 1 }, NOW), 'skip')
  assert.equal(classifyOutboxEntry({ createdAt: NOW - 10 * 60_000, updatedAt: NOW - EMAIL_SENDING_STALE_MS - 1, status: 'sending', attempts: 1 }, NOW), 'retry')
  for (const status of ['sent', 'skipped_preferences', 'missing_recipient', 'expired']) {
    assert.equal(classifyOutboxEntry({ ...fresh, status, attempts: 1 }, NOW), 'skip', status)
  }
})

test('outbox: nothing is retried after the Resend idempotency window (no duplicate risk)', () => {
  const old = { createdAt: NOW - EMAIL_IDEMPOTENCY_WINDOW_MS - 1, updatedAt: NOW - EMAIL_IDEMPOTENCY_WINDOW_MS - 1 }
  assert.equal(classifyOutboxEntry({ ...old, status: 'pending', attempts: 0 }, NOW), 'expire')
  assert.equal(classifyOutboxEntry({ ...old, status: 'failed', attempts: 1 }, NOW), 'expire')
  assert.equal(classifyOutboxEntry({ ...old, status: 'sent', attempts: 1 }, NOW), 'skip')
})

test('outbox: REQUIRED emails survive the 24h window and keep retrying for a week', () => {
  const DAY = 24 * 60 * 60 * 1000
  const required = { payload: { subject: 's', title: 't', body: 'b', required: true } }
  const at = (ageMs, extra) => ({ ...required, createdAt: NOW - ageMs, updatedAt: NOW - ageMs, ...extra })
  assert.equal(classifyOutboxEntry(at(DAY + 1, { status: 'failed', attempts: 3 }), NOW), 'retry')
  assert.equal(classifyOutboxEntry(at(3 * DAY, { status: 'pending', attempts: 0 }), NOW), 'retry')
  assert.equal(classifyOutboxEntry(at(6 * DAY, { status: 'sending', attempts: 1 }), NOW), 'retry')
  // more attempts than optional mails get, but still bounded
  assert.equal(classifyOutboxEntry(at(1000, { status: 'failed', attempts: MAX_EMAIL_ATTEMPTS }), NOW), 'retry')
  assert.equal(classifyOutboxEntry(at(1000, { status: 'failed', attempts: MAX_REQUIRED_EMAIL_ATTEMPTS }), NOW), 'skip')
  assert.equal(classifyOutboxEntry(at(EMAIL_REQUIRED_RETENTION_MS + 1, { status: 'failed', attempts: 1 }), NOW), 'expire')
  // optional mails (no required flag) are still dropped after the window
  assert.equal(classifyOutboxEntry({ payload: { subject: 's', title: 't', body: 'b' }, createdAt: NOW - DAY - 1, updatedAt: NOW - DAY - 1, status: 'failed', attempts: 1 }, NOW), 'expire')
  assert.equal(isRequiredOutboxEntry(required), true)
  assert.equal(isRequiredOutboxEntry({ payload: {} }), false)
  assert.equal(isRequiredOutboxEntry(undefined), false)
})

test('idempotency key: stable inside Resend window, rotated only after it', () => {
  const HOUR = 60 * 60 * 1000
  const first = resolveEmailIdempotency('evt', undefined, NOW)
  assert.deepEqual(first, { key: emailIdempotencyKey('evt'), generation: 0, issuedAt: NOW })
  const stored = { createdAt: NOW, keyGeneration: first.generation, keyIssuedAt: first.issuedAt }
  // every retry inside the window reuses the SAME key (no duplicate possible)
  for (const h of [0.1, 1, 12, 23.9, 24.9]) {
    assert.equal(resolveEmailIdempotency('evt', stored, NOW + h * HOUR).key, first.key, `${h}h`)
  }
  // after the margin the old key is forgotten by Resend → a new one, and then stays stable again
  const g1 = resolveEmailIdempotency('evt', stored, NOW + 25 * HOUR)
  assert.equal(g1.generation, 1)
  assert.equal(g1.key, `${first.key}-g1`)
  const stored1 = { ...stored, keyGeneration: 1, keyIssuedAt: g1.issuedAt }
  assert.equal(resolveEmailIdempotency('evt', stored1, NOW + 40 * HOUR).key, g1.key)
  assert.equal(resolveEmailIdempotency('evt', stored1, NOW + 25 * HOUR + 25 * HOUR).key, `${first.key}-g2`)
  assert.ok(g1.key.length <= 256)
  // legacy entry without key fields falls back to createdAt, generation 0
  assert.equal(resolveEmailIdempotency('evt', { createdAt: NOW }, NOW + HOUR).key, first.key)
})

test('outbox wiring: claim stores key generation, sweep parks exhausted entries', () => {
  const server = read('lib/email/product-notifications.server.ts')
  assert.match(server, /resolveEmailIdempotency\(/)
  assert.match(server, /keyGeneration: idem\.generation/)
  assert.match(server, /idempotencyKey: reservation\.idempotencyKey/)
  assert.match(server, /status: 'abandoned'/)
  assert.match(server, /Required email expired undelivered/)
})

test('outbox payload round-trips and idempotency key is stable and short', () => {
  const input = {
    eventId: 'lesson:1:cancelled:u2', recipientUid: 'u2', type: 'lessons.bookingCancelled',
    subject: 'S', title: 'T', body: 'B', preheader: 'P', details: [{ label: 'a', value: 'b' }], cta: { label: 'x', href: 'https://runbee.pl' },
  }
  const doc = { eventId: input.eventId, recipientUid: input.recipientUid, type: input.type, payload: buildOutboxPayload(input) }
  assert.deepEqual(inputFromOutboxDoc(doc), input)
  assert.equal(inputFromOutboxDoc({ eventId: 'x', recipientUid: 'u', type: 'messages.newMessage' }), null) // legacy entry without payload
  assert.equal(emailIdempotencyKey('a'), emailIdempotencyKey('a'))
  assert.notEqual(emailIdempotencyKey('a'), emailIdempotencyKey('b'))
  assert.ok(emailIdempotencyKey('a'.repeat(5000)).length <= 256)
})

// ── Preferences ──────────────────────────────────────────────

test('preferences: opt-out is honoured per type, required mails ignore it', () => {
  const recipient = { uid: 'u', email: 'u@example.com', notificationPreferences: { email: { messages: { newMessage: false }, lessons: { lessonReminder: false, bookingCancelled: true } } } }
  assert.equal(shouldSendProductEmail(recipient, 'messages.newMessage'), false)
  assert.equal(shouldSendProductEmail(recipient, 'lessons.lessonReminder'), false)
  assert.equal(shouldSendProductEmail(recipient, 'lessons.bookingCancelled'), true)
  assert.equal(shouldSendProductEmail(recipient, 'payments.payout'), true) // unset → default on
  assert.equal(shouldSendProductEmail(recipient, 'product.productUpdates'), false) // marketing is opt-in
  assert.equal(shouldSendProductEmail(recipient, 'messages.newMessage', true), true)
  assert.equal(validateProductEmailRecipient({ ...recipient, email: null }, { type: 'account.deletionStatus', required: true }), 'missing_recipient')
  assert.equal(validateProductEmailRecipient(recipient, { type: 'account.deletionStatus', required: true }), null)
})

// ── Lesson events: recipients, state checks, authorization, idempotency ──

const lesson = {
  id: 'L1', studentId: 'stu', payerId: 'par', teacherId: 'tea', studentName: 'Ala', teacherName: 'Jan', topic: 'PLC', date: 'pon, 12 paź', time: '10:00',
  status: 'upcoming', confirmingPartyId: 'par', studentCanManageReport: true,
}
const plan = (event, overrides = {}, actorUid = 'tea', extra = {}) => planLessonEventEmails({
  event, lesson: { ...lesson, ...overrides }, actorUid, actorIsAdmin: false, now: NOW, appUrl, ...extra,
})
const recipients = (p) => p.emails.map((e) => e.recipientUid).sort()

test('booking_accepted: only the teacher triggers it; student side is mailed, teacher is not', () => {
  const ok = plan('booking_accepted')
  assert.equal(ok.ok, true)
  assert.deepEqual(recipients(ok), ['par', 'stu'])
  assert.equal(plan('booking_accepted', {}, 'stu').ok, false)
  assert.equal(plan('booking_accepted', {}, 'stranger').ok, false)
  assert.equal(plan('booking_accepted', { status: 'pending' }).ok, false)
})

test('cancelled / rescheduled go to everyone except the actor, never to outsiders', () => {
  const cancelled = plan('cancelled', { status: 'cancelled' }, 'stu')
  assert.deepEqual(recipients(cancelled), ['par', 'tea'])
  assert.ok(cancelled.emails.every((e) => e.type === 'lessons.bookingCancelled'))
  assert.equal(plan('cancelled', { status: 'upcoming' }, 'stu').ok, false)
  assert.equal(plan('cancelled', { status: 'cancelled' }, 'stranger').ok, false)

  const moved = plan('rescheduled', { rescheduledAt: NOW - 1000 }, 'tea')
  assert.deepEqual(recipients(moved), ['par', 'stu'])
  assert.equal(plan('rescheduled', { rescheduledAt: NOW - 2 * 60 * 60_000 }, 'tea').ok, false)
  assert.equal(plan('rescheduled', {}, 'tea').ok, false)
  // a second reschedule is a new event, the same one is idempotent
  const again = plan('rescheduled', { rescheduledAt: NOW - 500 }, 'tea')
  assert.notEqual(moved.emails[0].eventId, again.emails[0].eventId)
  assert.equal(moved.emails[0].eventId, plan('rescheduled', { rescheduledAt: NOW - 1000 }, 'tea').emails[0].eventId)
})

test('change_requested: the responder (and for teacher requests the payer side) is told', () => {
  const byStudent = plan('change_requested', { pendingChange: { type: 'cancel', requestedBy: 'student', requestedAt: NOW - 10, note: 'choroba' } }, 'stu')
  assert.deepEqual(recipients(byStudent), ['tea'])
  const byTeacher = plan('change_requested', { pendingChange: { type: 'reschedule', requestedBy: 'teacher', requestedAt: NOW - 10, newDate: 'wt', newTime: '12:00' } }, 'tea')
  assert.deepEqual(recipients(byTeacher), ['par', 'stu'])
  // student can't pose as the teacher, and a stale/absent request is rejected
  assert.equal(plan('change_requested', { pendingChange: { type: 'cancel', requestedBy: 'teacher', requestedAt: NOW - 10 } }, 'stu').ok, false)
  assert.equal(plan('change_requested', {}, 'stu').ok, false)
  assert.equal(plan('change_requested', { pendingChange: { type: 'cancel', requestedBy: 'student', requestedAt: NOW - 3 * 60 * 60_000 } }, 'stu').ok, false)
})

test('report_ready: confirming party (+ student when allowed), teacher only, requires a real unconfirmed report', () => {
  const ok = plan('report_ready', { report: { topic: 'x' }, reportSubmittedAt: NOW - 5 })
  assert.deepEqual(recipients(ok), ['par', 'stu'])
  assert.ok(ok.emails.every((e) => e.type === 'reports.reportReady'))
  assert.deepEqual(recipients(plan('report_ready', { report: {}, reportSubmittedAt: NOW, studentCanManageReport: false })), ['par'])
  assert.equal(plan('report_ready', {}).ok, false)
  assert.equal(plan('report_ready', { report: {}, reportSubmittedAt: NOW, reportConfirmedAt: NOW }).ok, false)
  assert.equal(plan('report_ready', { report: {}, reportSubmittedAt: NOW }, 'stu').ok, false)
})

test('disputes: opened → teacher (required mail); resolved → admin only, teacher + payer', () => {
  const open = plan('dispute_opened', { dispute: { status: 'open', raisedByUserId: 'par', raisedAt: 5 } }, 'par')
  assert.deepEqual(recipients(open), ['tea'])
  assert.equal(open.emails[0].required, true)
  assert.equal(plan('dispute_opened', { dispute: { status: 'open', raisedByUserId: 'par', raisedAt: 5 } }, 'stu').ok, false)
  const resolved = planLessonEventEmails({ event: 'dispute_resolved', lesson: { ...lesson, dispute: { status: 'resolved_payer', resolvedAt: 9 } }, actorUid: 'adm', actorIsAdmin: true, now: NOW, appUrl })
  assert.deepEqual(recipients(resolved), ['par', 'tea'])
  assert.ok(resolved.emails.every((e) => e.required === true))
  assert.equal(plan('dispute_resolved', { dispute: { status: 'resolved_payer', resolvedAt: 9 } }, 'par').ok, false)
  assert.equal(planLessonEventEmails({ event: 'dispute_resolved', lesson: { ...lesson, dispute: { status: 'open' } }, actorUid: 'adm', actorIsAdmin: true, now: NOW, appUrl }).ok, false)
})

test('every planned email has a unique idempotency key and never mails an outsider', () => {
  const cases = [
    plan('booking_accepted'),
    plan('cancelled', { status: 'cancelled' }, 'stu'),
    plan('rescheduled', { rescheduledAt: NOW - 1 }, 'tea'),
    plan('report_ready', { report: {}, reportSubmittedAt: NOW - 1 }),
  ]
  const participants = new Set(['stu', 'par', 'tea'])
  const ids = new Set()
  for (const p of cases) for (const e of p.emails) {
    assert.ok(participants.has(e.recipientUid))
    assert.ok(!ids.has(e.eventId), e.eventId)
    ids.add(e.eventId)
  }
})

// ── Reminders ─────────────────────────────────────────────────

test('reminders: only confirmed lessons starting within 24h; start time is part of the key', () => {
  const soon = { ...lesson, scheduledStartAt: NOW + 3 * 60 * 60_000 }
  assert.equal(isReminderDue(soon, NOW), true)
  assert.equal(isReminderDue({ ...soon, status: 'pending' }, NOW), false)
  assert.equal(isReminderDue({ ...soon, status: 'cancelled' }, NOW), false)
  assert.equal(isReminderDue({ ...soon, scheduledStartAt: NOW - 1 }, NOW), false)
  assert.equal(isReminderDue({ ...soon, scheduledStartAt: NOW + 25 * 60 * 60_000 }, NOW), false)
  assert.equal(isReminderDue({ ...lesson }, NOW), false)
  const mails = planLessonReminderEmails(soon, appUrl)
  assert.deepEqual(mails.map((m) => m.recipientUid).sort(), ['par', 'stu', 'tea'])
  assert.ok(mails.every((m) => m.type === 'lessons.lessonReminder'))
  const moved = planLessonReminderEmails({ ...soon, scheduledStartAt: soon.scheduledStartAt + 60_000 }, appUrl)
  assert.notEqual(mails[0].eventId, moved[0].eventId)
  assert.equal(mails[0].eventId, planLessonReminderEmails(soon, appUrl)[0].eventId)
})

// ── Wiring (static): triggers, auth, idempotency, failure isolation ──

test('Resend send passes the idempotency key; product mail uses it and never throws into callers', () => {
  const transactional = read('lib/email/transactional-email.server.ts')
  const product = read('lib/email/product-notifications.server.ts')
  assert.match(transactional, /idempotencyKey: input\.idempotencyKey/)
  assert.match(product, /idempotencyKey: reservation\.idempotencyKey/)
  assert.match(product, /payload: buildOutboxPayload\(input\)/)
  // the whole send path sits in try/catch and returns a status instead of throwing
  assert.match(product, /catch \(error\) \{[\s\S]*return \{ status: 'failed' \}/)
})

test('cron endpoints require CRON_SECRET; lesson-event endpoint authenticates and ignores client recipients', () => {
  for (const path of ['app/api/cron/email-outbox/route.ts', 'app/api/cron/lesson-reminders/route.ts']) {
    const src = read(path)
    assert.match(src, /authorizeCronRequest\(request\.headers\.get\('authorization'\), process\.env\.CRON_SECRET\)/, path)
  }
  const route = read('app/api/notifications/lesson-event/route.ts')
  assert.match(route, /verifyCaller/)
  assert.doesNotMatch(route, /body\??\.(to|recipient|recipients|email)\b/)
  assert.match(route, /planLessonEventEmails/)
  const sweep = read('lib/email/product-notifications.server.ts')
  assert.match(sweep, /Math\.min\(Math\.max\(options\.limit \?\? 25, 1\), 50\)/)
})

test('all lesson transitions notify through the server and every financial trigger is isolated from mail failures', () => {
  const lessons = read('services/lessons.service.ts')
  for (const event of ['booking_accepted', 'change_requested', 'cancelled', 'rescheduled', 'report_ready', 'dispute_opened', 'dispute_resolved']) {
    assert.ok(lessons.includes(`'${event}'`), event)
  }
  assert.match(read('lib/lesson-release.server.ts'), /transfer-released:teacher/)
  assert.match(read('app/api/cron/auto-confirm-reports/route.ts'), /report-auto-confirmed/)
  assert.match(read('lib/stripe-webhook-shared.ts'), /payout:\$\{snap\.docs\[0\]\.id\}:status:\$\{status\}/)
  assert.match(read('lib/lesson-package-booking.server.ts'), /:payer`/)
  assert.match(read('lib/stripe-lesson-packages.server.ts'), /recipientUid: payerId/)
  // the transfer is persisted BEFORE the email is attempted
  const release = read('lib/lesson-release.server.ts')
  assert.ok(release.indexOf('stripeTransferId: transfer.id') < release.indexOf('transfer-released:teacher'))
})

test('account deletion mails are required, go through the outbox and read the address from the profile', () => {
  const status = read('lib/email/account-deletion-status-email.server.ts')
  assert.match(status, /required: true/)
  assert.match(status, /type: 'account\.deletionStatus'/)
  const ack = read('app/api/account/deletion-request/route.ts')
  assert.match(ack, /type: 'account\.deletionStatus'/)
  assert.match(ack, /required: true/)
})
