import { NextResponse } from 'next/server'
import { stripe } from '@/lib/stripe'
import { adminDb } from '@/lib/firebase-admin'
import { getVerifiedUserRole, requireStripeBackend, verifyCaller } from '@/lib/stripe-server-auth'
import { collections } from '@/lib/firebase'
import { STRIPE_CURRENCY } from '@/lib/stripe-config'
import type { PayoutRecord } from '@/lib/types'

// ─────────────────────────────────────────────────────────────
// "Wypłać środki" — a real Stripe Payout from the teacher's own
// Connect balance to their bank. Server-only trigger; the connected
// account id is looked up from Firestore by the caller's own verified
// uid (never trusted from the client, see the explicit prohibition in
// the original spec) and the amount is validated against Stripe's own
// live balance right before creating the payout — never against a
// Firestore-cached number, and never allowed to exceed it.
//
// Accounts are created with a manual payout schedule (see
// app/api/stripe/connect/onboard) specifically so this button is what
// actually moves money, not Stripe's own automatic daily schedule.
// ─────────────────────────────────────────────────────────────

export async function POST(request: Request) {
  const backendError = requireStripeBackend()
  if (backendError) return backendError

  let body: { idToken?: string; amountGrosze?: number }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Nieprawidłowe żądanie.' }, { status: 400 })
  }

  const uid = await verifyCaller(body.idToken)
  if (!uid) return NextResponse.json({ error: 'Musisz być zalogowany.' }, { status: 401 })

  const role = await getVerifiedUserRole(uid)
  if (role !== 'teacher') return NextResponse.json({ error: 'Tylko konto nauczyciela może zlecić wypłatę.' }, { status: 403 })

  const amountGrosze = Math.round(Number(body.amountGrosze))
  if (!Number.isFinite(amountGrosze) || amountGrosze <= 0) {
    return NextResponse.json({ error: 'Nieprawidłowa kwota.' }, { status: 400 })
  }

  const teacherSnap = await adminDb!.collection(collections.teachers).doc(uid).get()
  const accountId = teacherSnap.data()?.stripe?.accountId as string | undefined
  const payoutsEnabled = Boolean(teacherSnap.data()?.stripe?.payoutsEnabled)
  if (!accountId || !payoutsEnabled) {
    return NextResponse.json({ error: 'Wypłaty nie są jeszcze skonfigurowane — dokończ konfigurację Stripe.' }, { status: 400 })
  }

  try {
    const balance = await stripe!.balance.retrieve({}, { stripeAccount: accountId })
    const availableGrosze = balance.available.find((b) => b.currency === STRIPE_CURRENCY)?.amount ?? 0
    if (amountGrosze > availableGrosze) {
      return NextResponse.json({ error: 'Kwota przekracza dostępne saldo.' }, { status: 400 })
    }

    const payout = await stripe!.payouts.create({ amount: amountGrosze, currency: STRIPE_CURRENCY }, { stripeAccount: accountId })

    const record: Omit<PayoutRecord, 'id'> = {
      teacherId: uid,
      amountGrosze,
      status: payout.status as PayoutRecord['status'],
      stripePayoutId: payout.id,
      createdAt: Date.now(),
    }
    const ref = await adminDb!.collection(collections.payouts).add(record)
    return NextResponse.json({ payout: { id: ref.id, ...record } })
  } catch (err) {
    console.error('[stripe/payout] Failed:', err)
    return NextResponse.json({ error: 'Nie udało się zlecić wypłaty. Spróbuj ponownie.' }, { status: 500 })
  }
}
