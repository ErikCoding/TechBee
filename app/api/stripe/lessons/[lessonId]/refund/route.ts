import { NextResponse } from 'next/server'
import { stripe } from '@/lib/stripe'
import { adminDb } from '@/lib/firebase-admin'
import { requireStripeBackend, verifyCaller } from '@/lib/stripe-server-auth'
import { collections } from '@/lib/firebase'
import { canManageLessonReport } from '@/lib/report-permissions'
import type { Lesson } from '@/lib/types'

// ─────────────────────────────────────────────────────────────
// Reverses a lesson's payment via a real Stripe Refund — used when
// the teacher rejects a paid booking request, either side cancels a
// confirmed one, or a dispute resolves in the payer's favor (see
// services/lessons.service.ts). Because money was only ever taken to
// Runbee's own platform balance (never transferred out — a transfer
// only happens later, on report confirmation, see the transfer
// route), a refund here is always a plain refund of the original
// charge, never something that has to be clawed back from a teacher's
// connected account.
//
// Idempotent: if `stripeRefundId` is already set, does nothing.
// ─────────────────────────────────────────────────────────────

export async function POST(request: Request, { params }: { params: Promise<{ lessonId: string }> }) {
  const backendError = requireStripeBackend()
  if (backendError) return backendError

  const { lessonId } = await params
  let body: { idToken?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Nieprawidłowe żądanie.' }, { status: 400 })
  }

  const uid = await verifyCaller(body.idToken)
  if (!uid) return NextResponse.json({ error: 'Musisz być zalogowany.' }, { status: 401 })

  const lessonRef = adminDb!.collection(collections.lessons).doc(lessonId)
  const lessonSnap = await lessonRef.get()
  if (!lessonSnap.exists) return NextResponse.json({ error: 'Nie znaleziono lekcji.' }, { status: 404 })
  const lesson = lessonSnap.data() as Lesson

  const payerId = lesson.payerId ?? lesson.studentId
  const roleSnap = await adminDb!.collection(collections.users).doc(uid).get()
  const isAdmin = roleSnap.data()?.role === 'admin'
  // A refund can only be triggered by the lesson's own teacher
  // (rejecting/cancelling), the payer (cancelling), whoever is allowed
  // to manage the lesson's report (see lib/report-permissions.ts — same
  // reasoning as transfer/route.ts: a linked parent isn't always the
  // payer, and the student too when the parent's enabled
  // studentCanManageReport), or an admin (resolving a dispute for the
  // payer) — never an arbitrary account.
  if (uid !== lesson.teacherId && uid !== payerId && uid !== lesson.studentId && !canManageLessonReport(lesson, uid) && !isAdmin) {
    return NextResponse.json({ error: 'Brak dostępu do tej lekcji.' }, { status: 403 })
  }

  if (lesson.stripeRefundId || lesson.paymentStatus === 'refunded') {
    return NextResponse.json({ refundId: lesson.stripeRefundId, alreadyRefunded: true })
  }
  if (lesson.paymentStatus !== 'paid') {
    return NextResponse.json({ error: 'Ta lekcja nie ma płatności do zwrotu.' }, { status: 400 })
  }
  if (lesson.stripeTransferId) {
    return NextResponse.json({ error: 'Płatność za tę lekcję została już przekazana nauczycielowi — skontaktuj się z supportem.' }, { status: 400 })
  }
  if (!lesson.stripePaymentIntentId) {
    return NextResponse.json({ error: 'Brak powiązanej płatności Stripe.' }, { status: 400 })
  }

  try {
    const refund = await stripe!.refunds.create({
      payment_intent: lesson.stripePaymentIntentId,
      metadata: { lessonId },
    })
    await lessonRef.update({ stripeRefundId: refund.id, paymentStatus: 'refunded', status: 'cancelled' })
    return NextResponse.json({ refundId: refund.id })
  } catch (err) {
    console.error('[stripe/lessons/refund] Failed:', err)
    return NextResponse.json({ error: 'Nie udało się dokonać zwrotu. Spróbuj ponownie.' }, { status: 500 })
  }
}
