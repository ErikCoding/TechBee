import { NextResponse } from 'next/server'
import { adminDb, isAdminConfigured } from '@/lib/firebase-admin'
import { collections } from '@/lib/firebase'

// ─────────────────────────────────────────────────────────────
// Polled by app/payment/success while the webhook is still catching
// up — purely a read of whether the Lesson doc exists yet for this
// Checkout Session. Never itself confirms anything; the webhook (see
// app/api/stripe/webhook/route.ts) is the only writer.
// ─────────────────────────────────────────────────────────────

export async function GET(request: Request) {
  if (!isAdminConfigured) return NextResponse.json({ error: 'Nieskonfigurowane.' }, { status: 503 })

  const sessionId = new URL(request.url).searchParams.get('session_id')
  if (!sessionId) return NextResponse.json({ error: 'Brak session_id.' }, { status: 400 })

  const snap = await adminDb!.collection(collections.lessons).where('stripeCheckoutSessionId', '==', sessionId).limit(1).get()
  if (snap.empty) return NextResponse.json({ lessonId: null })
  return NextResponse.json({ lessonId: snap.docs[0].id })
}
