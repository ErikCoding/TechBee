import { auth, isFirebaseConfigured } from '@/lib/firebase'

// ─────────────────────────────────────────────────────────────
// Admin-only "wipe activity data" button (see components/admin/
// admin-reset-panel.tsx) — clears everything that accumulates from
// people actually using the platform (messages, bookings, wallets,
// notifications, parent-link codes, BeePoints, Stripe payout/webhook
// history) so the app can be reset to a clean slate right before
// launch, without touching real accounts (`users`) or content that
// isn't per-user activity (teacher profiles/applications, the
// categories/testimonials/FAQ catalog).
//
// Deliberately does NOT touch a teacher's Stripe Connect link
// (`teachers/{id}.stripe` — account id + onboarding status) so
// re-running this doesn't force every teacher back through Stripe's
// hosted onboarding. It also can't touch anything that only exists in
// Stripe itself (Connected Accounts, Checkout Sessions, Payment
// Intents, Transfers, Payouts, Refunds) — Firestore only ever stores
// IDs/status/history metadata for those (see services/stripe.service.ts),
// never the money itself. To reset Stripe's own Test Mode data, use
// Stripe's own "Reset test data" option (Dashboard → Test Mode →
// Developers) instead.
//
// The actual deletes run server-side via the trusted admin SDK (see
// app/api/admin/reset-activity/route.ts), not the client Firestore
// SDK: several of the collections cleared here (wallets,
// walletTransactions, payouts, stripeEvents) are deny-all in
// firestore.rules for every client, including an admin's own browser
// — money-integrity data only the trusted server may touch — so a
// pure client-side reset would silently fail partway through.
// ─────────────────────────────────────────────────────────────

export interface ResetResult {
  collection: string
  count: number
}

export async function resetActivityData(): Promise<ResetResult[]> {
  if (!isFirebaseConfigured) {
    throw new Error('Firebase nie jest skonfigurowane.')
  }

  const idToken = await auth?.currentUser?.getIdToken().catch(() => undefined)
  const res = await fetch('/api/admin/reset-activity', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ idToken }),
  })
  const data = await res.json().catch(() => ({}) as Record<string, unknown>)
  if (!res.ok) {
    throw new Error(typeof data.error === 'string' ? data.error : 'Nie udało się zresetować danych.')
  }
  return data.results as ResetResult[]
}
