import { NextResponse } from 'next/server'
import type Stripe from 'stripe'
import { stripe, isStripeConfigured } from '@/lib/stripe'
import { isAdminConfigured } from '@/lib/firebase-admin'
import { alreadyProcessed, markProcessed, handlePayoutStatusChange } from '@/lib/stripe-webhook-shared'

// ─────────────────────────────────────────────────────────────
// The "Connected accounts" event destination — separate from
// app/api/stripe/webhook (the "Your account" destination) because
// Stripe scopes event destinations by where the underlying object
// lives, not by which platform feature it's for. A teacher's payout
// (app/api/stripe/payout/route.ts calls `stripe.payouts.create(...,
// { stripeAccount: accountId })`) is a Payout object that lives on
// *their* connected account, not Runbee's own — so its lifecycle
// events (payout.created/updated/paid/failed) are delivered to a
// "Connected accounts" destination with its own signing secret,
// never to the "Your account" one used for Checkout/refund events.
// See Stripe Dashboard → Developers → Webhooks → Add destination →
// "Event destination scope" for the two options, and
// docs.stripe.com/connect/webhooks for the general explanation.
//
// Keeping this on its own route (rather than trying to verify two
// different secrets in one handler) is what lets each destination's
// signature check stay simple and correct — `stripe.webhooks.
// constructEvent` only ever accepts a single secret.
//
// Only used to keep the payouts/{id} Firestore doc's displayed status
// in sync with reality (pending → paid/failed) for the teacher wallet
// UI. Not required for money to move correctly — the payout is
// already created via the API call itself; this just keeps the
// in-app history from silently going stale or hiding a failure.
// ─────────────────────────────────────────────────────────────

export const runtime = 'nodejs'

export async function POST(request: Request) {
  if (!isStripeConfigured || !isAdminConfigured) {
    return NextResponse.json({ error: 'Webhook nie jest jeszcze skonfigurowany.' }, { status: 503 })
  }

  const webhookSecret = process.env.STRIPE_CONNECT_WEBHOOK_SECRET
  if (!webhookSecret) {
    return NextResponse.json({ error: 'Brak STRIPE_CONNECT_WEBHOOK_SECRET.' }, { status: 503 })
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
    console.error('[stripe/webhook/connect] Signature verification failed:', err)
    return NextResponse.json({ error: 'Nieprawidłowy podpis.' }, { status: 400 })
  }

  if (await alreadyProcessed(event.id)) {
    return NextResponse.json({ received: true, deduped: true })
  }

  try {
    switch (event.type) {
      case 'payout.created':
      case 'payout.updated':
      case 'payout.paid':
      case 'payout.failed':
        await handlePayoutStatusChange(event.data.object as Stripe.Payout)
        break
      default:
        // This destination is only subscribed to payout.* events in the
        // Stripe Dashboard, but handle anything unexpected gracefully.
        break
    }
  } catch (err) {
    console.error(`[stripe/webhook/connect] Handler failed for ${event.type} (${event.id}):`, err)
    return NextResponse.json({ error: 'Przetwarzanie nie powiodło się.' }, { status: 500 })
  }

  await markProcessed(event.id)
  return NextResponse.json({ received: true })
}
