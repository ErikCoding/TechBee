import 'server-only'
import type Stripe from 'stripe'
import { adminDb } from '@/lib/firebase-admin'
import { collections } from '@/lib/firebase'
import { runbeeAppUrl, sendProductNotificationEmail } from '@/lib/email/product-notifications.server'
import type { PayoutRecord } from '@/lib/types'

// ─────────────────────────────────────────────────────────────
// Shared between app/api/stripe/webhook (the platform-account
// destination — checkout.session.completed, charge.refunded) and
// app/api/stripe/webhook/connect (the Connected-accounts destination —
// payout.* events). Stripe requires two separate event destinations
// for these because they have different "event destination scopes"
// (Your account vs Connected accounts — see Dashboard → Webhooks →
// Add destination), which means two different signing secrets, which
// means two separate Route Handlers verifying against two different
// STRIPE_*_WEBHOOK_SECRET env vars. Everything else (idempotency
// dedupe, the actual handler logic) is identical, so it lives here
// once instead of copy-pasted.
// ─────────────────────────────────────────────────────────────

export async function alreadyProcessed(eventId: string): Promise<boolean> {
  const snap = await adminDb!.collection(collections.stripeEvents).doc(eventId).get()
  return snap.exists
}

/** Written only AFTER a handler completes successfully — if a handler throws partway through, Stripe's retry (we return 500) hits this same event id again, and since every handler is itself idempotent (checks for an existing lesson/payout doc first), reprocessing is safe. Marking "processed" before running would make a failed-then-retried event silently skip forever instead. */
export async function markProcessed(eventId: string): Promise<void> {
  await adminDb!.collection(collections.stripeEvents).doc(eventId).set({ processedAt: Date.now() })
}

/** payout.created / payout.updated / payout.paid / payout.failed — keeps the matching payouts/{id} doc's status in sync with what actually happened to the teacher's bank transfer (a payout can take 1–3 business days to land or fail after the "Wypłać" button already created it — see app/api/stripe/payout/route.ts). These events are Connected-account-scoped (the Payout object lives on the teacher's connected account, created with `{ stripeAccount: accountId }`), so they arrive via the separate app/api/stripe/webhook/connect destination. */
export async function handlePayoutStatusChange(payout: Stripe.Payout) {
  const snap = await adminDb!.collection(collections.payouts).where('stripePayoutId', '==', payout.id).limit(1).get()
  if (snap.empty) return
  const status = payout.status as PayoutRecord['status']
  await snap.docs[0].ref.update({ status, ...(payout.failure_message ? { failureMessage: payout.failure_message } : {}) })

  // Outcome of the bank transfer → teacher. Only terminal states; the
  // outbox entry is keyed by payout+status, so Stripe's event retries
  // never produce a second email. A failure to mail never fails the webhook.
  const record = snap.docs[0].data() as Partial<PayoutRecord>
  if (!record.teacherId || (status !== 'paid' && status !== 'failed' && status !== 'canceled')) return
  const amount = typeof record.amountGrosze === 'number'
    ? `${(record.amountGrosze / 100).toLocaleString('pl-PL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} zł`
    : '—'
  const failed = status !== 'paid'
  await sendProductNotificationEmail({
    eventId: `payout:${snap.docs[0].id}:status:${status}`,
    recipientUid: record.teacherId,
    type: 'payments.payout',
    required: failed,
    subject: failed ? 'Wypłata Runbee nie została zrealizowana' : 'Wypłata Runbee została zrealizowana',
    title: failed ? 'Wypłata nie powiodła się' : 'Wypłata dotarła na Twój rachunek',
    preheader: failed ? 'Stripe nie zrealizował wypłaty.' : 'Stripe potwierdził wypłatę na rachunek bankowy.',
    body: failed
      ? 'Wypłata na rachunek bankowy nie została zrealizowana. Środki pozostają na Twoim koncie Stripe Connect — sprawdź dane rachunku i spróbuj ponownie.'
      : 'Stripe potwierdził wypłatę środków na Twój rachunek bankowy.',
    details: [
      { label: 'Kwota', value: amount },
      ...(failed && payout.failure_message ? [{ label: 'Powód', value: payout.failure_message }] : []),
    ],
    cta: { label: 'Otwórz portfel', href: runbeeAppUrl('/dashboard') },
  })
}
