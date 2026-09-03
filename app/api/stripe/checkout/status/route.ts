import { NextResponse } from 'next/server'
import { adminDb, isAdminConfigured } from '@/lib/firebase-admin'
import { collections } from '@/lib/firebase'
import { stripe, isStripeConfigured } from '@/lib/stripe'
import { ensureLessonForCheckoutSession } from '@/lib/stripe-checkout-lessons'

// ─────────────────────────────────────────────────────────────
// Polled by app/payment/success while the webhook is still catching
// up. In production the webhook usually creates the Lesson first. In
// local development, though, Stripe can accept the payment while no
// webhook tunnel is running; in that case this endpoint verifies the
// Checkout Session directly with Stripe and creates the same Lesson
// idempotently.
// ─────────────────────────────────────────────────────────────

export async function GET(request: Request) {
  if (!isAdminConfigured) return NextResponse.json({ error: 'Nieskonfigurowane.' }, { status: 503 })

  const sessionId = new URL(request.url).searchParams.get('session_id')
  if (!sessionId) return NextResponse.json({ error: 'Brak session_id.' }, { status: 400 })

  const snap = await adminDb!.collection(collections.lessons).where('stripeCheckoutSessionId', '==', sessionId).limit(1).get()
  if (!snap.empty) return NextResponse.json({ lessonId: snap.docs[0].id })

  if (!isStripeConfigured) return NextResponse.json({ lessonId: null })

  try {
    const session = await stripe!.checkout.sessions.retrieve(sessionId)
    const lessonId = await ensureLessonForCheckoutSession(session)
    return NextResponse.json({ lessonId })
  } catch (err) {
    console.error('[stripe/checkout/status] Failed to reconcile session:', err)
    return NextResponse.json({ lessonId: null })
  }
}
