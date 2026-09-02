import { NextResponse } from 'next/server'
import { stripe } from '@/lib/stripe'
import { adminDb } from '@/lib/firebase-admin'
import { requireStripeBackend, verifyCaller } from '@/lib/stripe-server-auth'
import { collections } from '@/lib/firebase'
import { STRIPE_CURRENCY } from '@/lib/stripe-config'
import { canManageLessonReport } from '@/lib/report-permissions'
import type { Lesson } from '@/lib/types'

// ─────────────────────────────────────────────────────────────
// Moves a lesson's teacher share from Runbee's Stripe balance to the
// teacher's Connected Account — a real Stripe Transfer (the
// "Separate Charges and Transfers" pattern: the original Checkout
// charge landed on the platform's own balance; this is the second
// half). Triggered by the same events as before (see
// services/lessons.service.ts finalizeReportConfirmation): the
// confirming party approving a report, the 24h auto-confirm, or an
// admin resolving a dispute for the teacher — all now re-verified
// SERVER-SIDE against the real lesson doc instead of trusted from
// whichever browser happened to trigger it.
//
// Idempotent: if `stripeTransferId` is already set, does nothing and
// returns the existing transfer — a retried/duplicate call (e.g. two
// tabs racing an auto-confirm) can never double-pay a teacher.
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

  // roleSnap (needed for the isAdmin check below) and teacherSnap
  // (needed later for the Connect account id) both only depend on data
  // already known from lessonSnap — neither depends on the other, so
  // fetch them concurrently instead of one after another.
  const [roleSnap, teacherSnap] = await Promise.all([
    adminDb!.collection(collections.users).doc(uid).get(),
    adminDb!.collection(collections.teachers).doc(lesson.teacherId).get(),
  ])
  const isAdmin = roleSnap.data()?.role === 'admin'

  // Only someone genuinely party to this lesson (payer, student,
  // teacher, or — importantly — whoever is allowed to manage this
  // lesson's report per lib/report-permissions.ts, which isn't always
  // just the payer: a linked parent gets confirmation authority over a
  // student's report regardless of who originally paid for the lesson,
  // and the student themselves too when the parent has enabled
  // "studentCanManageReport") or an admin can trigger the release —
  // never an arbitrary signed-in account.
  const payerId = lesson.payerId ?? lesson.studentId
  if (uid !== payerId && uid !== lesson.studentId && uid !== lesson.teacherId && !canManageLessonReport(lesson, uid) && !isAdmin) {
    return NextResponse.json({ error: 'Brak dostępu do tej lekcji.' }, { status: 403 })
  }

  if (lesson.stripeTransferId) {
    return NextResponse.json({ transferId: lesson.stripeTransferId, alreadyTransferred: true })
  }
  if (lesson.paymentStatus !== 'paid') {
    return NextResponse.json({ error: 'Ta lekcja nie ma potwierdzonej płatności.' }, { status: 400 })
  }
  if (!lesson.report) {
    return NextResponse.json({ error: 'Nauczyciel nie przesłał jeszcze raportu z tej lekcji.' }, { status: 400 })
  }
  if (lesson.dispute && lesson.dispute.status === 'open') {
    return NextResponse.json({ error: 'Ta lekcja ma otwarty spór.' }, { status: 400 })
  }
  // Business rule re-verified server-side (never trust a client's claim
  // that "24h has passed" or that the confirming party approved it) —
  // either whoever's allowed to manage the report is the one calling
  // this, or the 24h auto-confirm window has genuinely elapsed, or it's
  // an admin resolving a dispute in the teacher's favor.
  const confirmingPartyApproved = canManageLessonReport(lesson, uid)
  const autoConfirmWindowElapsed = Boolean(lesson.reportSubmittedAt) && Date.now() - lesson.reportSubmittedAt! >= 24 * 60 * 60 * 1000
  const disputeResolvedForTeacher = lesson.dispute?.status === 'resolved_teacher'
  if (!confirmingPartyApproved && !autoConfirmWindowElapsed && !disputeResolvedForTeacher && !isAdmin) {
    return NextResponse.json({ error: 'Zwolnienie płatności nie jest jeszcze możliwe.' }, { status: 403 })
  }

  const teacherAccountId = teacherSnap.data()?.stripe?.accountId as string | undefined
  if (!teacherAccountId) {
    return NextResponse.json({ error: 'Nauczyciel nie ma jeszcze skonfigurowanego konta Stripe.' }, { status: 400 })
  }

  const amount = lesson.teacherAmountGrosze ?? 0
  if (amount <= 0) {
    return NextResponse.json({ error: 'Nieprawidłowa kwota do wypłaty.' }, { status: 400 })
  }

  try {
    const transfer = await stripe!.transfers.create({
      amount,
      currency: STRIPE_CURRENCY,
      destination: teacherAccountId,
      transfer_group: `lesson_${lessonId}`,
      metadata: { lessonId, teacherId: lesson.teacherId },
    })
    await lessonRef.update({ stripeTransferId: transfer.id, reportConfirmedAt: Date.now(), paymentReleased: true })
    return NextResponse.json({ transferId: transfer.id })
  } catch (err) {
    console.error('[stripe/lessons/transfer] Failed:', err)
    return NextResponse.json({ error: 'Nie udało się zwolnić płatności. Spróbuj ponownie.' }, { status: 500 })
  }
}
