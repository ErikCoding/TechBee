import { NextResponse } from 'next/server'
import { randomUUID } from 'node:crypto'
import { stripe } from '@/lib/stripe'
import { adminDb } from '@/lib/firebase-admin'
import { getVerifiedUserRole, requireStripeBackend, verifyCaller } from '@/lib/stripe-server-auth'
import { collections } from '@/lib/firebase'
import { STRIPE_CURRENCY } from '@/lib/stripe-config'
import {
  TEACHER_PAYOUT_LOCK_TTL_MS,
  TEACHER_PAYOUT_UNRESOLVED_ERROR,
  beginTeacherPayoutAttempt,
  createTeacherStripePayout,
  validateTeacherPayoutAmount,
} from '@/lib/teacher-payout-core'
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
  let payoutLockRef: FirebaseFirestore.DocumentReference | null = null
  let payoutAttemptId: string | null = null
  let payoutLockStarted = false
  let stripeCreateStarted = false
  let stripePayoutId: string | null = null

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
  const amountValidation = validateTeacherPayoutAmount(amountGrosze)
  if (!amountValidation.ok) return NextResponse.json({ error: amountValidation.error }, { status: amountValidation.status })

  const teacherSnap = await adminDb!.collection(collections.teachers).doc(uid).get()
  const accountId = teacherSnap.data()?.stripe?.accountId as string | undefined
  const payoutsEnabled = Boolean(teacherSnap.data()?.stripe?.payoutsEnabled)
  if (!accountId || !payoutsEnabled) {
    return NextResponse.json({ error: 'Wypłaty nie są jeszcze skonfigurowane — dokończ konfigurację Stripe.' }, { status: 400 })
  }

  try {
    const lockRef = adminDb!.collection(collections.teacherPayoutLocks).doc(uid)
    payoutLockRef = lockRef
    const payoutAttempt = await adminDb!.runTransaction(async (tx) => {
      const now = Date.now()
      const lockSnap = await tx.get(lockRef)
      const decision = beginTeacherPayoutAttempt({
        existingLock: lockSnap.exists ? lockSnap.data() : null,
        teacherId: uid,
        amountGrosze,
        now,
        createAttemptId: randomUUID,
      })
      if (!decision.ok) return decision
      tx.set(lockRef, decision.lock)
      return decision
    })
    if (!payoutAttempt.ok) {
      return NextResponse.json({ error: payoutAttempt.error }, { status: payoutAttempt.status })
    }
    payoutAttemptId = payoutAttempt.attemptId
    payoutLockStarted = true

    const balance = await stripe!.balance.retrieve({}, { stripeAccount: accountId })
    const availableGrosze = balance.available.find((b) => b.currency === STRIPE_CURRENCY)?.amount ?? 0
    const balanceValidation = validateTeacherPayoutAmount(amountGrosze, availableGrosze)
    if (!balanceValidation.ok) {
      if (!payoutAttempt.reused) {
        await lockRef.set({
          teacherId: uid,
          attemptId: payoutAttempt.attemptId,
          amountGrosze,
          status: 'failed',
          finishedAt: Date.now(),
        }, { merge: true })
      }
      if (payoutAttempt.reused) {
        return NextResponse.json({ error: TEACHER_PAYOUT_UNRESOLVED_ERROR }, { status: 409 })
      }
      return NextResponse.json({ error: balanceValidation.error }, { status: balanceValidation.status })
    }

    stripeCreateStarted = true
    const payout = await createTeacherStripePayout(stripe!.payouts, {
      amountGrosze,
      currency: STRIPE_CURRENCY,
      stripeAccount: accountId,
      attemptId: payoutAttempt.attemptId,
    })
    stripePayoutId = payout.id

    const record: Omit<PayoutRecord, 'id'> = {
      teacherId: uid,
      amountGrosze,
      status: payout.status as PayoutRecord['status'],
      stripePayoutId: payout.id,
      createdAt: Date.now(),
      payoutAttemptId: payoutAttempt.attemptId,
    }
    const ref = adminDb!.collection(collections.payouts).doc()
    await adminDb!.runTransaction(async (tx) => {
      tx.set(ref, record)
      tx.set(lockRef, {
        teacherId: uid,
        attemptId: payoutAttempt.attemptId,
        amountGrosze,
        status: 'succeeded',
        stripePayoutId: payout.id,
        finishedAt: Date.now(),
      })
    })
    return NextResponse.json({ payout: { id: ref.id, ...record } })
  } catch (err) {
    console.error('[stripe/payout] Failed:', err)
    if (payoutLockStarted && payoutLockRef && payoutAttemptId) {
      const keepProcessing = stripeCreateStarted || Boolean(stripePayoutId)
      const now = Date.now()
      await payoutLockRef.set({
        teacherId: uid,
        attemptId: payoutAttemptId,
        amountGrosze,
        status: keepProcessing ? 'processing' : 'failed',
        ...(stripePayoutId ? { stripePayoutId } : {}),
        ...(keepProcessing ? { expiresAt: now + TEACHER_PAYOUT_LOCK_TTL_MS } : { finishedAt: now }),
      }, { merge: true }).catch((lockErr) => {
        console.error('[stripe/payout] Failed to release payout lock:', lockErr)
      })
    }
    return NextResponse.json({ error: 'Nie udało się zlecić wypłaty. Spróbuj ponownie.' }, { status: 500 })
  }
}
