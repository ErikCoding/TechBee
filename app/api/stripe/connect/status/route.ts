import { NextResponse } from 'next/server'
import { stripe } from '@/lib/stripe'
import { adminDb } from '@/lib/firebase-admin'
import { requireStripeBackend, verifyCaller } from '@/lib/stripe-server-auth'
import { collections } from '@/lib/firebase'
import type { TeacherStripeAccount } from '@/lib/types'

// ─────────────────────────────────────────────────────────────
// Re-checks the signed-in teacher's real Stripe Connect account status
// (requirements submitted / transfers capability / payouts capability)
// and syncs it onto their teacher doc — called when the teacher
// dashboard loads and again right after they return from
// Stripe-hosted onboarding (see the ?stripeOnboarding=done redirect
// from app/api/stripe/connect/onboard).
//
// Reads through the v2 Accounts endpoint (`stripe.v2.core.accounts`),
// matching the v2 `recipient` account created in
// app/api/stripe/connect/onboard — v2's `recipient` configuration
// doesn't have v1's `details_submitted`/`charges_enabled` fields, it
// exposes per-capability status (`active`/`pending`/...) and a
// `requirements.entries` list instead. This route is the source of
// truth for the teacher doc's cached `stripe.*` status; the
// account.updated *v1* webhook event isn't guaranteed to fire for v2
// accounts, so it's left in app/api/stripe/webhook only as a
// best-effort background nudge — this on-demand check (called on every
// dashboard load) is what actually keeps things correct.
// ─────────────────────────────────────────────────────────────

export async function POST(request: Request) {
  const backendError = requireStripeBackend()
  if (backendError) return backendError

  let body: { idToken?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Nieprawidłowe żądanie.' }, { status: 400 })
  }

  const uid = await verifyCaller(body.idToken)
  if (!uid) return NextResponse.json({ error: 'Musisz być zalogowany.' }, { status: 401 })

  const teacherRef = adminDb!.collection(collections.teachers).doc(uid)
  const teacherSnap = await teacherRef.get()
  const accountId = teacherSnap.data()?.stripe?.accountId as string | undefined
  if (!accountId) {
    return NextResponse.json<{ stripe: TeacherStripeAccount }>({ stripe: {} })
  }

  try {
    const account = await stripe!.v2.core.accounts.retrieve(accountId, { include: ['configuration.recipient', 'requirements'] })
    const capabilities = account.configuration?.recipient?.capabilities?.stripe_balance
    const transfersActive = capabilities?.stripe_transfers?.status === 'active'
    const payoutsActive = capabilities?.payouts?.status === 'active'
    const noOutstandingRequirements = (account.requirements?.entries?.length ?? 0) === 0
    const status: TeacherStripeAccount = {
      accountId,
      detailsSubmitted: noOutstandingRequirements,
      chargesEnabled: transfersActive,
      payoutsEnabled: payoutsActive,
      onboardingComplete: transfersActive && payoutsActive && noOutstandingRequirements,
    }
    // Diagnostic: capability activation can lag a few seconds behind the
    // onboarding return redirect even in Test Mode, so a single check
    // right after return can legitimately see "pending" — logging the
    // raw statuses here makes that visible instead of a silent stuck
    // button. Safe to remove once this class of report stops coming up.
    console.log('[stripe/connect/status]', accountId, {
      stripe_transfers: capabilities?.stripe_transfers?.status,
      payouts: capabilities?.payouts?.status,
      requirementsCount: account.requirements?.entries?.length ?? 0,
      requirementCodes: account.requirements?.entries?.map((e) => e.description) ?? [],
    })
    await teacherRef.set({ stripe: status }, { merge: true })
    return NextResponse.json({ stripe: status })
  } catch (err) {
    console.error('[stripe/connect/status] Failed:', err)
    return NextResponse.json({ error: 'Nie udało się sprawdzić statusu konta Stripe.' }, { status: 500 })
  }
}
