import { NextResponse } from 'next/server'
import { stripe } from '@/lib/stripe'
import { adminDb } from '@/lib/firebase-admin'
import { requireStripeBackend, verifyCaller } from '@/lib/stripe-server-auth'
import { collections } from '@/lib/firebase'
import { STRIPE_CURRENCY } from '@/lib/stripe-config'
import type { Lesson, PayoutRecord, TeacherWalletSummary, WalletHistoryEntry } from '@/lib/types'

// ─────────────────────────────────────────────────────────────
// The teacher wallet card's numbers. `availableGrosze`/`pendingGrosze`
// come straight from Stripe's own balance for the teacher's connected
// account — Stripe stays the source of truth for real money; nothing
// here is a Firestore-computed balance. `monthlyEarningsGrosze`/
// `platformFeesGrosze` and the transaction history are computed from
// the teacher's own lesson docs (same pattern as the existing
// computeTeacherEarnings in services/lessons.service.ts, just in
// grosze), which is legitimate — those are history/display metadata,
// not a balance.
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

  const teacherSnap = await adminDb!.collection(collections.teachers).doc(uid).get()
  const accountId = teacherSnap.data()?.stripe?.accountId as string | undefined

  const lessonsSnap = await adminDb!.collection(collections.lessons).where('teacherId', '==', uid).get()
  const lessons = lessonsSnap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Lesson, 'id'>) }))

  const now = new Date()
  const isSameMonth = (ts: number) => {
    const d = new Date(ts)
    return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth()
  }
  const released = lessons.filter((l) => l.stripeTransferId && l.completedAt)
  const monthlyEarningsGrosze = released.filter((l) => isSameMonth(l.completedAt!)).reduce((sum, l) => sum + (l.teacherAmountGrosze ?? 0), 0)
  const platformFeesGrosze = released.filter((l) => isSameMonth(l.completedAt!)).reduce((sum, l) => sum + (l.platformFeeGrosze ?? 0), 0)

  const payoutsSnap = await adminDb!.collection(collections.payouts).where('teacherId', '==', uid).get()
  const payoutDocs = payoutsSnap.docs
  let payouts = payoutDocs.map((d) => ({ id: d.id, ...(d.data() as Omit<PayoutRecord, 'id'>) }))

  if (accountId) {
    await Promise.all(payoutDocs.map(async (payoutDoc) => {
      const payout = payoutDoc.data() as Omit<PayoutRecord, 'id'>
      if (payout.status === 'paid' || payout.status === 'failed' || payout.status === 'canceled') return
      try {
        const fresh = await stripe!.payouts.retrieve(payout.stripePayoutId, {}, { stripeAccount: accountId })
        const nextStatus = fresh.status as PayoutRecord['status']
        if (nextStatus !== payout.status || fresh.failure_message) {
          await payoutDoc.ref.update({ status: nextStatus, ...(fresh.failure_message ? { failureMessage: fresh.failure_message } : {}) })
        }
      } catch (err) {
        console.error('[stripe/wallet] Failed to refresh payout status:', err)
      }
    }))
    const refreshed = await adminDb!.collection(collections.payouts).where('teacherId', '==', uid).get()
    payouts = refreshed.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<PayoutRecord, 'id'>) }))
  }

  payouts = payouts.sort((a, b) => b.createdAt - a.createdAt)

  const history: WalletHistoryEntry[] = [
    ...released.map((l) => ({
      kind: 'lesson' as const,
      lessonId: l.id,
      studentName: l.studentName,
      topic: l.topic,
      grossGrosze: l.priceGrosze ?? 0,
      platformFeeGrosze: l.platformFeeGrosze ?? 0,
      teacherAmountGrosze: l.teacherAmountGrosze ?? 0,
      createdAt: l.completedAt!,
    })),
    ...payouts.map((p) => ({ kind: 'payout' as const, amountGrosze: p.amountGrosze, status: p.status, createdAt: p.createdAt })),
  ].sort((a, b) => b.createdAt - a.createdAt)

  let availableGrosze = 0
  let pendingGrosze = 0
  if (accountId) {
    try {
      const balance = await stripe!.balance.retrieve({}, { stripeAccount: accountId })
      availableGrosze = balance.available.find((b) => b.currency === STRIPE_CURRENCY)?.amount ?? 0
      pendingGrosze = balance.pending.find((b) => b.currency === STRIPE_CURRENCY)?.amount ?? 0
    } catch (err) {
      console.error('[stripe/wallet] Failed to fetch Stripe balance:', err)
    }
  }

  const summary: TeacherWalletSummary = { availableGrosze, pendingGrosze, monthlyEarningsGrosze, platformFeesGrosze }
  return NextResponse.json({ summary, history: history.slice(0, 30), payouts: payouts.slice(0, 10) })
}
