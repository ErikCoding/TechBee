import { auth } from '@/lib/firebase'
import type { TeacherStripeAccount, TeacherWalletSummary, WalletHistoryEntry, PayoutRecord } from '@/lib/types'

// ─────────────────────────────────────────────────────────────
// Client-side helpers for every app/api/stripe/* route. Same posture
// as services/livekit.service.ts: attach the signed-in user's real
// Firebase ID token (never trust a client-claimed uid/role/amount —
// the server re-verifies everything, see lib/stripe-server-auth.ts),
// and surface a clear error message if Stripe/the trusted backend
// isn't configured yet (503, see lib/stripe-server-auth.ts:
// requireStripeBackend) instead of throwing something opaque.
//
// There is deliberately no mock/localStorage mode here, unlike every
// other services/*.service.ts file — real money can only ever move
// through a real, verified Stripe call, so these functions simply
// don't work until Firebase + Stripe + FIREBASE_SERVICE_ACCOUNT_KEY
// are all configured. The UI is expected to show that plainly (see
// components/dashboard/teacher-stripe-connect-card.tsx) rather than
// fake a working payment flow.
// ─────────────────────────────────────────────────────────────

async function getIdToken(): Promise<string | undefined> {
  return auth?.currentUser?.getIdToken().catch(() => undefined)
}

async function postJson<T>(path: string, body: Record<string, unknown>): Promise<T> {
  const idToken = await getIdToken()
  const res = await fetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...body, idToken }),
  })
  const data = await res.json().catch(() => ({}) as Record<string, unknown>)
  if (!res.ok) {
    throw new Error(typeof data.error === 'string' ? data.error : 'Coś poszło nie tak. Spróbuj ponownie.')
  }
  return data as T
}

/** Starts (or resumes) Stripe Connect Express onboarding for the signed-in teacher — returns a Stripe-hosted URL to redirect the browser to. */
export async function startTeacherStripeOnboarding(): Promise<string> {
  const { url } = await postJson<{ url: string }>('/api/stripe/connect/onboard', {})
  return url
}

/** Re-checks the signed-in teacher's real Stripe Connect account status and syncs it onto their teacher doc. */
export async function refreshTeacherStripeStatus(): Promise<TeacherStripeAccount> {
  const { stripe } = await postJson<{ stripe: TeacherStripeAccount }>('/api/stripe/connect/status', {})
  return stripe
}

/**
 * Starts payment for a specific lesson slot — server computes the
 * authoritative price and creates a Stripe Checkout Session; the
 * lesson itself doesn't exist as a Firestore doc yet at this point
 * (see app/api/stripe/checkout/create-session/route.ts) — it's only
 * created by the webhook once payment genuinely succeeds. Returns the
 * Checkout URL to redirect the browser to.
 */
export async function startLessonCheckout(input: {
  teacherId: string
  date: string
  time: string
  duration: number
  topic: string
  studentId: string
  studentName: string
  payer?: { id: string; role: 'student' | 'parent' }
}): Promise<string> {
  const { url } = await postJson<{ url: string }>('/api/stripe/checkout/create-session', input)
  return url
}

/** Polls whether a Checkout Session's lesson has been created yet — used by /payment/success to bridge the brief gap before the webhook lands. */
export async function getCheckoutSessionLessonId(sessionId: string): Promise<string | null> {
  const res = await fetch(`/api/stripe/checkout/status?session_id=${encodeURIComponent(sessionId)}`)
  const data = await res.json().catch(() => ({}) as Record<string, unknown>)
  if (!res.ok) return null
  return typeof data.lessonId === 'string' ? data.lessonId : null
}

/** Moves a lesson's teacher share from Runbee's Stripe balance to the teacher's connected account (a real Transfer) — see app/api/stripe/lessons/[lessonId]/transfer/route.ts. Best-effort by design (same posture as the old releaseLessonPayment): the caller should still let the underlying confirm/auto-confirm/dispute-resolve action succeed even if this throws, and can surface the error separately. */
export async function transferLessonPayment(lessonId: string): Promise<void> {
  await postJson(`/api/stripe/lessons/${lessonId}/transfer`, {})
}

/** Reverses a lesson's payment via a real Stripe Refund — see app/api/stripe/lessons/[lessonId]/refund/route.ts. */
export async function refundLessonPayment(lessonId: string): Promise<void> {
  await postJson(`/api/stripe/lessons/${lessonId}/refund`, {})
}

/** The teacher wallet card's numbers, read live from Stripe (see app/api/stripe/wallet/route.ts) — Stripe stays the source of truth for available/pending balance. */
export async function getTeacherWallet(): Promise<{ summary: TeacherWalletSummary; history: WalletHistoryEntry[]; payouts: PayoutRecord[] }> {
  return postJson('/api/stripe/wallet', {})
}

/** Requests a real Stripe payout of the teacher's available balance — amount in grosze, validated server-side against Stripe's own balance (never trust a client-supplied amount past that check). */
export async function requestTeacherPayout(amountGrosze: number): Promise<PayoutRecord> {
  const { payout } = await postJson<{ payout: PayoutRecord }>('/api/stripe/payout', { amountGrosze })
  return payout
}
