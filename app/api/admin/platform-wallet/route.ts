import { NextResponse } from 'next/server'
import { adminDb, isAdminConfigured } from '@/lib/firebase-admin'
import { collections } from '@/lib/firebase'
import { stripe, isStripeConfigured } from '@/lib/stripe'
import { STRIPE_CURRENCY } from '@/lib/stripe-config'
import { getPlatformPaymentSettings, updatePlatformCommissionPercent } from '@/lib/platform-payment-settings'
import { getVerifiedUserRole, verifyCaller } from '@/lib/stripe-server-auth'
import type { Lesson, PlatformWalletEntry, PlatformWalletSummary } from '@/lib/types'

async function requireAdmin(idToken?: string): Promise<{ uid: string } | NextResponse> {
  if (!isAdminConfigured) return NextResponse.json({ error: 'Zaufane zapisy Firestore nie są skonfigurowane.' }, { status: 503 })
  const uid = await verifyCaller(idToken)
  if (!uid) return NextResponse.json({ error: 'Musisz być zalogowany.' }, { status: 401 })
  const role = await getVerifiedUserRole(uid)
  if (role !== 'admin') return NextResponse.json({ error: 'Tylko administrator może zarządzać portfelem platformy.' }, { status: 403 })
  return { uid }
}

// Whichever Stripe key this server is currently running with decides
// what "real" means here — `sk_test_...` on localhost (sandbox testing),
// `sk_live_...` on the deployed site. Comparing against a Lesson's own
// `livemode` (see the doc comment on that field in lib/types.ts) keeps
// the two dashboards showing only their own activity from the one
// shared Firestore project, without needing a second Firebase project
// just to separate test bookings from real ones.
const CURRENT_ENV_IS_LIVE = Boolean(process.env.STRIPE_SECRET_KEY?.startsWith('sk_live_'))

function hasKnownStripeFee(lesson: Lesson): lesson is Lesson & { stripeFeeGrosze: number } {
  return Number.isFinite(lesson.stripeFeeGrosze)
}

function lessonIsReadyForTransfer(lesson: Lesson): boolean {
  if (lesson.paymentStatus !== 'paid' || lesson.stripeTransferId) return false
  if (lesson.dispute?.status === 'open') return false
  if (lesson.dispute?.status === 'resolved_teacher') return true
  if (lesson.reportConfirmedAt || lesson.paymentReleased) return true
  if (!lesson.reportSubmittedAt || !lesson.report) return false
  return Date.now() - lesson.reportSubmittedAt >= 24 * 60 * 60 * 1000
}

function settlementStatus(lesson: Lesson): PlatformWalletEntry['settlementStatus'] {
  if (lesson.paymentStatus === 'refunded') return 'refunded'
  if (lesson.stripeTransferId) return 'transferred'
  if (lessonIsReadyForTransfer(lesson)) return 'ready_for_transfer'
  if (lesson.dispute?.status === 'open') return 'waiting_confirmation'
  if (lesson.report) return 'waiting_confirmation'
  if (lesson.status === 'pending') return 'waiting_teacher_acceptance'
  if (lesson.status === 'upcoming') return 'waiting_lesson'
  return 'waiting_report'
}

function transferStatus(lesson: Lesson): PlatformWalletEntry['transferStatus'] {
  if (lesson.paymentStatus === 'refunded') return 'refunded'
  if (lesson.stripeTransferId) return 'sent'
  return lessonIsReadyForTransfer(lesson) ? 'ready' : 'pending'
}

async function buildPlatformWallet(): Promise<{ summary: PlatformWalletSummary; entries: PlatformWalletEntry[] }> {
  const settings = await getPlatformPaymentSettings()
  const lessonsSnap = await adminDb!.collection(collections.lessons).get()
  const allLessons = lessonsSnap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Lesson, 'id'>) }))
  // Lessons created before this field existed have no `livemode` at all —
  // treated as test-mode, since anything from before the real Stripe
  // switch can only have been a sandbox booking.
  const lessons = allLessons.filter((lesson) => Boolean(lesson.livemode) === CURRENT_ENV_IS_LIVE)
  const paid = lessons.filter((lesson) => lesson.paymentStatus === 'paid')
  const refunded = lessons.filter((lesson) => lesson.paymentStatus === 'refunded')
  const knownFeePaid = paid.filter(hasKnownStripeFee)
  const missingFeeCount = paid.length - knownFeePaid.length

  let stripeAvailableGrosze: number | null = null
  let stripePendingGrosze: number | null = null
  if (isStripeConfigured) {
    try {
      const balance = await stripe!.balance.retrieve()
      stripeAvailableGrosze = balance.available.find((b) => b.currency === STRIPE_CURRENCY)?.amount ?? 0
      stripePendingGrosze = balance.pending.find((b) => b.currency === STRIPE_CURRENCY)?.amount ?? 0
    } catch (err) {
      console.error('[admin/platform-wallet] Failed to fetch Stripe balance:', err)
    }
  }

  const grossPlatformCommissionGrosze = paid.reduce((sum, lesson) => sum + (lesson.platformFeeGrosze ?? 0), 0)
  const stripeFeesGrosze = knownFeePaid.reduce((sum, lesson) => sum + lesson.stripeFeeGrosze, 0)
  const stripeFeesComplete = missingFeeCount === 0
  const readyForTransfer = paid.filter(lessonIsReadyForTransfer)

  const summary: PlatformWalletSummary = {
    commissionPercent: settings.commissionPercent,
    paidVolumeGrosze: paid.reduce((sum, lesson) => sum + (lesson.priceGrosze ?? 0), 0),
    refundsGrosze: refunded.reduce((sum, lesson) => sum + (lesson.priceGrosze ?? 0), 0),
    grossPlatformCommissionGrosze,
    stripeFeesGrosze,
    stripeFeesComplete,
    stripeFeesMissingCount: missingFeeCount,
    netPlatformRevenueGrosze: stripeFeesComplete ? grossPlatformCommissionGrosze - stripeFeesGrosze : null,
    teacherAmountGrosze: paid.reduce((sum, lesson) => sum + (lesson.teacherAmountGrosze ?? 0), 0),
    teacherPendingReleaseGrosze: paid
      .filter((lesson) => !lesson.stripeTransferId && !lessonIsReadyForTransfer(lesson))
      .reduce((sum, lesson) => sum + (lesson.teacherAmountGrosze ?? 0), 0),
    teacherReadyForTransferGrosze: readyForTransfer.reduce((sum, lesson) => sum + (lesson.teacherAmountGrosze ?? 0), 0),
    teacherTransferredGrosze: paid.filter((lesson) => lesson.stripeTransferId).reduce((sum, lesson) => sum + (lesson.teacherAmountGrosze ?? 0), 0),
    stripeAvailableGrosze,
    stripePendingGrosze,
  }

  const entries: PlatformWalletEntry[] = lessons
    .filter((lesson) => lesson.paymentStatus === 'paid' || lesson.paymentStatus === 'refunded')
    .map((lesson) => ({
      lessonId: lesson.id,
      teacherName: lesson.teacherName,
      studentName: lesson.studentName,
      topic: lesson.topic,
      date: lesson.date && lesson.time ? `${lesson.date}, ${lesson.time}` : lesson.date || lesson.time || '—',
      grossGrosze: lesson.priceGrosze ?? 0,
      platformFeeGrosze: lesson.platformFeeGrosze ?? 0,
      ...(typeof (lesson.effectiveCommissionPercent ?? lesson.commissionPercent) === 'number'
        ? { effectiveCommissionPercent: lesson.effectiveCommissionPercent ?? lesson.commissionPercent }
        : {}),
      ...(lesson.commissionSource ? { commissionSource: lesson.commissionSource } : {}),
      ...(typeof lesson.stripeFeeGrosze === 'number' ? { stripeFeeGrosze: lesson.stripeFeeGrosze } : {}),
      ...(lesson.paymentStatus === 'paid' && typeof lesson.stripeFeeGrosze === 'number'
        ? { netPlatformRevenueGrosze: (lesson.platformFeeGrosze ?? 0) - lesson.stripeFeeGrosze }
        : {}),
      teacherAmountGrosze: lesson.teacherAmountGrosze ?? 0,
      status: lesson.paymentStatus ?? 'paid',
      settlementStatus: settlementStatus(lesson),
      transferStatus: transferStatus(lesson),
      createdAt: lesson.createdAt ?? 0,
    }))
    .sort((a, b) => b.createdAt - a.createdAt)

  return { summary, entries: entries.slice(0, 12) }
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}) as { idToken?: string })
  const admin = await requireAdmin(body.idToken)
  if (admin instanceof NextResponse) return admin
  const wallet = await buildPlatformWallet()
  return NextResponse.json(wallet)
}

export async function PATCH(request: Request) {
  const body = await request.json().catch(() => ({}) as { idToken?: string; commissionPercent?: number })
  const admin = await requireAdmin(body.idToken)
  if (admin instanceof NextResponse) return admin
  await updatePlatformCommissionPercent(Number(body.commissionPercent), admin.uid)
  const wallet = await buildPlatformWallet()
  return NextResponse.json(wallet)
}
