import { NextResponse } from 'next/server'
import { stripe } from '@/lib/stripe'
import { adminDb } from '@/lib/firebase-admin'
import { getVerifiedUserRole, requireStripeBackend, verifyCaller } from '@/lib/stripe-server-auth'
import { getOrigin } from '@/lib/request-origin'
import { collections } from '@/lib/firebase'

// ─────────────────────────────────────────────────────────────
// "Skonfiguruj wypłaty" — creates (or reuses) the signed-in teacher's
// Stripe Connect account and returns a fresh, single-use Stripe-hosted
// onboarding link (Account Link). Runbee never builds its own KYC
// form — Stripe's hosted flow is the current recommended approach and
// is legally/technically required for identity verification, so it's
// the one place a teacher briefly leaves Runbee's own UI.
//
// Uses the Accounts v2 API (`recipient` configuration), not v1
// Express accounts. Stripe now blocks v1 account *creation* by
// default for new Connect platforms — see the error this used to
// throw: "Stripe no longer recommends Accounts v1 for new Connect
// integrations. Create connected accounts with POST /v2/core/accounts
// instead." (docs.stripe.com/connect/accounts-v2/account-creation).
// v1's `type: 'express'` + `capabilities.transfers` maps to v2's
// `dashboard: 'express'` + `configuration.recipient.capabilities`,
// because Runbee only ever needs to *transfer* the teacher's share
// of a lesson payment to them (the "Separate Charges and Transfers"
// pattern — see services/lessons.service.ts
// finalizeReportConfirmation) and let them withdraw it — the account
// never accepts charges directly, so it's a `recipient`, not a
// `merchant`. Only the `stripe_balance.stripe_transfers` capability is
// requested (v2's equivalent of v1's `transfers` capability) — it's
// what lets the account receive a Transfer from the platform into its
// own Stripe balance; the ability to then pay that balance out to a
// bank account (`stripe_balance.payouts`, needed for the "Wypłać"
// button — see app/api/stripe/payout) isn't a separate opt-in, Stripe
// activates it once the account is verified, and its live status is
// read back in app/api/stripe/connect/status. `dashboard: 'express'` requires
// `defaults.responsibilities` to explicitly assign fee/loss
// responsibility to the platform (`application`), otherwise account
// creation is rejected with
// `account_controller_express_dash_without_application_losses_or_fees`.
//
// The Account Link (Stripe-hosted onboarding) is created through the
// matching v2 endpoint too (`stripe.v2.core.accountLinks`), because
// it needs to know to collect requirements for the `recipient`
// configuration specifically — the v1 Account Links endpoint doesn't
// know about v2 configurations.
//
// Payout schedule is set to manual (in the connected account's
// `settings.payouts`, updated once after onboarding — see below) so
// the "Wypłać" button is what actually triggers money movement,
// rather than Stripe's own automatic daily payout schedule silently
// doing it first.
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

  const role = await getVerifiedUserRole(uid)
  if (role !== 'teacher') return NextResponse.json({ error: 'Tylko konto nauczyciela może skonfigurować wypłaty.' }, { status: 403 })

  const teacherRef = adminDb!.collection(collections.teachers).doc(uid)
  const [teacherSnap, userSnap] = await Promise.all([teacherRef.get(), adminDb!.collection(collections.users).doc(uid).get()])
  const email = (userSnap.data()?.email as string | undefined) ?? undefined
  let accountId = teacherSnap.data()?.stripe?.accountId as string | undefined

  try {
    if (!accountId) {
      const account = await stripe!.v2.core.accounts.create({
        contact_email: email,
        dashboard: 'express',
        identity: { country: 'PL', entity_type: 'individual' },
        configuration: {
          recipient: {
            // Only `stripe_transfers` is a requestable capability at
            // creation time — it's what lets this account receive
            // Transfers into its own Stripe balance. The ability to
            // pay that balance out to a bank account (`payouts`) isn't
            // a separate opt-in; Stripe grants/activates it once the
            // account is verified, and its live status is read back
            // in app/api/stripe/connect/status.
            capabilities: { stripe_balance: { stripe_transfers: { requested: true } } },
          },
        },
        defaults: {
          currency: 'pln',
          responsibilities: { fees_collector: 'application', losses_collector: 'application' },
        },
      })
      accountId = account.id

      // Manual payout schedule so the "Wypłać" button is what actually
      // moves money — this setting isn't exposed on the v2 create call,
      // but the v1 Accounts endpoint can still update it on a v2 account
      // (Stripe's v1/v2 interoperability layer — same account, different
      // API shape). Best-effort: a v2 account still works fine with
      // Stripe's default automatic payout schedule if this fails.
      await stripe!.accounts.update(accountId, { settings: { payouts: { schedule: { interval: 'manual' } } } }).catch((err) => {
        console.error('[stripe/connect/onboard] Failed to set manual payout schedule:', err)
      })

      await teacherRef.set({ stripe: { accountId, onboardingComplete: false, detailsSubmitted: false, chargesEnabled: false, payoutsEnabled: false } }, { merge: true })
    }

    const origin = getOrigin(request)
    const accountLink = await stripe!.v2.core.accountLinks.create({
      account: accountId,
      use_case: {
        type: 'account_onboarding',
        account_onboarding: {
          configurations: ['recipient'],
          refresh_url: `${origin}/dashboard/teacher?stripeOnboarding=refresh`,
          return_url: `${origin}/dashboard/teacher?stripeOnboarding=done`,
          // Without this, the hosted flow only collects what's
          // *currently* due for `stripe_transfers`. The bank account
          // needed for `stripe_balance.payouts` (so the "Wypłać" button
          // has something to pay out to) is classified as an
          // "eventually due" requirement that follows once transfers
          // are active — left at the default, the teacher would finish
          // onboarding, see "Weryfikacja w toku" forever, and never get
          // a second prompt to add a bank account. Requesting
          // eventually_due + future_requirements here collects both in
          // the same single session.
          collection_options: { fields: 'eventually_due', future_requirements: 'include' },
        },
      },
    })

    return NextResponse.json({ url: accountLink.url })
  } catch (err) {
    console.error('[stripe/connect/onboard] Failed:', err)
    return NextResponse.json({ error: 'Nie udało się rozpocząć konfiguracji wypłat. Spróbuj ponownie.' }, { status: 500 })
  }
}
