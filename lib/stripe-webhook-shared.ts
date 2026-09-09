import 'server-only'
import type Stripe from 'stripe'
import { adminDb } from '@/lib/firebase-admin'
import { collections } from '@/lib/firebase'
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
}
