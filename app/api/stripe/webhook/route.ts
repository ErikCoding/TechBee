import { NextResponse } from 'next/server'
import type Stripe from 'stripe'
import { stripe, isStripeConfigured } from '@/lib/stripe'
import { adminDb, isAdminConfigured } from '@/lib/firebase-admin'
import { collections } from '@/lib/firebase'
import { ensureLessonForCheckoutSession } from '@/lib/stripe-checkout-lessons'
import type { PayoutRecord } from '@/lib/types'

// ─────────────────────────────────────────────────────────────
// The one place a booking actually becomes "paid" — everything else
// (the /payment/success redirect, the client) is just display. Stripe
// signature-verified, idempotent (see the stripeEvents dedupe check
// below), and the only writer of payment-integrity Lesson fields (see
// firestore.rules: lessons/{id} blocks clients from touching those
// fields directly).
//
// Events handled (checked against the current Stripe API — nothing
// assumed from the original prompt's wording):
//   checkout.session.completed  → creates the Lesson doc (payment succeeded)
//   checkout.session.expired    → nothing to do (no Lesson was ever created)
//   payment_intent.payment_failed → logged only (no Lesson exists to mark failed;
//                                    the client's Checkout page shows Stripe's own error)
//   charge.refunded             → marks a Lesson refunded (covers refunds issued
//                                    directly in the Stripe Dashboard too, not just
//                                    the ones this app triggers itself)
//   transfer.created            → logged only (informational; the transfer/refund
//                                    routes already write stripeTransferId themselves)
//   payout.created / payout.updated / payout.paid / payout.failed
//                                    → updates the matching payouts/{id} doc
//   account.updated             → logged only, see handleAccountUpdated for why
// ─────────────────────────────────────────────────────────────

export const runtime = 'nodejs'

async function alreadyProcessed(eventId: string): Promise<boolean> {
  const snap = await adminDb!.collection(collections.stripeEvents).doc(eventId).get()
  return snap.exists
}

/** Written only AFTER a handler completes successfully — if a handler throws partway through, Stripe's retry (we return 500) hits this same event id again, and since every handler below is itself idempotent (checks for an existing lesson/payout doc first), reprocessing is safe. Marking "processed" before running would make a failed-then-retried event silently skip forever instead. */
async function markProcessed(eventId: string): Promise<void> {
  await adminDb!.collection(collections.stripeEvents).doc(eventId).set({ processedAt: Date.now() })
}

async function handleCheckoutCompleted(session: Stripe.Checkout.Session) {
  await ensureLessonForCheckoutSession(session)
}

async function handleChargeRefunded(charge: Stripe.Charge) {
  const paymentIntentId = typeof charge.payment_intent === 'string' ? charge.payment_intent : charge.payment_intent?.id
  if (!paymentIntentId) return
  const snap = await adminDb!.collection(collections.lessons).where('stripePaymentIntentId', '==', paymentIntentId).limit(1).get()
  if (snap.empty) return
  const doc = snap.docs[0]
  if (doc.data().paymentStatus === 'refunded') return // already handled by our own refund route
  await doc.ref.update({ paymentStatus: 'refunded', status: 'cancelled' })
}

async function handlePayoutStatusChange(payout: Stripe.Payout) {
  const snap = await adminDb!.collection(collections.payouts).where('stripePayoutId', '==', payout.id).limit(1).get()
  if (snap.empty) return
  const status = payout.status as PayoutRecord['status']
  await snap.docs[0].ref.update({ status, ...(payout.failure_message ? { failureMessage: payout.failure_message } : {}) })
}

async function handleAccountUpdated(account: Stripe.Account) {
  // Connect accounts are now created through Accounts v2 (`recipient`
  // configuration — see app/api/stripe/connect/onboard), not v1
  // Express accounts. This *v1* `account.updated` event may not even
  // fire for a v2 account, and if it does, the v1-shaped
  // `capabilities`/`details_submitted`/`charges_enabled` fields on the
  // payload aren't guaranteed to reflect a `recipient` account's real
  // capability status the way they used to for v1 Express accounts.
  // Rather than risk silently overwriting a correctly-onboarded
  // teacher's cached status with a wrong read, this handler is
  // intentionally a no-op: the real source of truth is the on-demand
  // check in app/api/stripe/connect/status, called every time the
  // teacher dashboard loads and again right after the Stripe-hosted
  // onboarding return redirect (?stripeOnboarding=done). Kept only to
  // log what Stripe sends, in case it's useful for debugging.
  console.log('[stripe/webhook] account.updated received for', account.id, '(status is refreshed on-demand, not from this event)')
}

export async function POST(request: Request) {
  if (!isStripeConfigured || !isAdminConfigured) {
    return NextResponse.json({ error: 'Webhook nie jest jeszcze skonfigurowany.' }, { status: 503 })
  }

  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET
  if (!webhookSecret) {
    return NextResponse.json({ error: 'Brak STRIPE_WEBHOOK_SECRET.' }, { status: 503 })
  }

  const signature = request.headers.get('stripe-signature')
  if (!signature) {
    return NextResponse.json({ error: 'Brak podpisu Stripe.' }, { status: 400 })
  }

  const rawBody = await request.text()
  let event: Stripe.Event
  try {
    event = stripe!.webhooks.constructEvent(rawBody, signature, webhookSecret)
  } catch (err) {
    console.error('[stripe/webhook] Signature verification failed:', err)
    return NextResponse.json({ error: 'Nieprawidłowy podpis.' }, { status: 400 })
  }

  if (await alreadyProcessed(event.id)) {
    return NextResponse.json({ received: true, deduped: true })
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed':
        await handleCheckoutCompleted(event.data.object as Stripe.Checkout.Session)
        break
      case 'charge.refunded':
        await handleChargeRefunded(event.data.object as Stripe.Charge)
        break
      case 'payout.paid':
      case 'payout.failed':
      case 'payout.created':
      case 'payout.updated':
        await handlePayoutStatusChange(event.data.object as Stripe.Payout)
        break
      case 'account.updated':
        await handleAccountUpdated(event.data.object as Stripe.Account)
        break
      case 'checkout.session.expired':
      case 'payment_intent.payment_failed':
      case 'transfer.created':
        // Nothing to do — see the top-of-file comment for why.
        break
      default:
        break
    }
  } catch (err) {
    console.error(`[stripe/webhook] Handler failed for ${event.type} (${event.id}):`, err)
    // Return 500 so Stripe retries — the stripeEvents doc was already
    // not written yet, so re-processing an event whose handler threw
    // partway through is still safer than silently dropping it. Every
    // handler above is itself idempotent, so a retry is safe.
    return NextResponse.json({ error: 'Przetwarzanie nie powiodło się.' }, { status: 500 })
  }

  await markProcessed(event.id)
  return NextResponse.json({ received: true })
}
