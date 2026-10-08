import { NextResponse } from 'next/server'
import { adminDb, isAdminConfigured } from '@/lib/firebase-admin'
import { collections } from '@/lib/firebase'
import { stripe, isStripeConfigured } from '@/lib/stripe'
import { STRIPE_CURRENCY } from '@/lib/stripe-config'
import { getPlatformPaymentSettings, updatePlatformCommissionPercent } from '@/lib/platform-payment-settings'
import { getVerifiedUserRole, verifyCaller } from '@/lib/stripe-server-auth'
import { computePlatformFinance } from '@/lib/stripe-financial-metrics'
import { classifyLessonFinanceEntry, classifyPackageFinanceEntry } from '@/lib/admin-finance-classification'
import { readPlatformStripeCostFinancialEvents } from '@/lib/stripe-financial-events'
import { syncMissingStripeFeesForReporting } from '@/lib/stripe-fee-sync.server'
import { syncPackageRefundLocksForReporting } from '@/lib/stripe-package-refund-sync.server'
import type { Lesson, LessonPackage, PlatformWalletEntry, PlatformWalletSummary, StripeFinancialEvent } from '@/lib/types'

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

function lessonIsReadyForTransfer(lesson: Lesson): boolean {
  if (lesson.paymentStatus !== 'paid' || lesson.stripeTransferId) return false
  if (lesson.dispute?.status === 'open') return false
  if (lesson.dispute?.status === 'resolved_teacher') return true
  if (!lesson.reportSubmittedAt || !lesson.report) return false
  return Date.now() - lesson.reportSubmittedAt >= 24 * 60 * 60 * 1000
}

function lessonHasReleaseStateMismatch(lesson: Lesson): boolean {
  return lesson.paymentStatus === 'paid' && !lesson.stripeTransferId && Boolean(lesson.reportConfirmedAt || lesson.paymentReleased)
}

function settlementStatus(lesson: Lesson): PlatformWalletEntry['settlementStatus'] {
  if (lesson.paymentStatus === 'refunded') return 'refunded'
  if (lesson.stripeTransferId) return 'transferred'
  if (lessonHasReleaseStateMismatch(lesson)) return 'release_inconsistent'
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
  const [lessonsSnap, packagesSnap, financialEventsSnap] = await Promise.all([
    adminDb!.collection(collections.lessons).get(),
    adminDb!.collection(collections.lessonPackages).get(),
    adminDb!.collection(collections.stripeFinancialEvents).get(),
  ])
  const allLessons = lessonsSnap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Lesson, 'id'>) }))
  const allPackages = packagesSnap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<LessonPackage, 'id'>) }))
  const allFinancialEvents = financialEventsSnap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<StripeFinancialEvent, 'id'>) }))
  // Lessons created before this field existed have no `livemode` at all —
  // treated as test-mode, since anything from before the real Stripe
  // switch can only have been a sandbox booking.
  const lessons = allLessons.filter((lesson) => Boolean(lesson.livemode) === CURRENT_ENV_IS_LIVE)
  const packages = allPackages.filter((pkg) => Boolean(pkg.livemode) === CURRENT_ENV_IS_LIVE)
  const financialEvents = allFinancialEvents.filter((event) => Boolean(event.livemode) === CURRENT_ENV_IS_LIVE)
  if (isStripeConfigured) {
    try {
      await syncMissingStripeFeesForReporting({ database: adminDb!, lessons, packages, limit: 20 })
    } catch (err) {
      console.error('[admin/platform-wallet] Failed to sync missing Stripe fee snapshots:', err)
    }
    try {
      await syncPackageRefundLocksForReporting({ database: adminDb!, packages, limit: 20 })
    } catch (err) {
      console.error('[admin/platform-wallet] Failed to sync package refund locks:', err)
    }
  }
  const liveStripeCostEvents = isStripeConfigured
    ? await readPlatformStripeCostFinancialEvents(new Set(financialEvents.map((event) => event.stripeBalanceTransactionId)))
    : []
  const paid = lessons.filter((lesson) => lesson.paymentStatus === 'paid')

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

  const financeEvents = [...financialEvents, ...liveStripeCostEvents]
  const finance = computePlatformFinance({ lessons, packages, events: financeEvents })
  const readyForTransfer = paid.filter(lessonIsReadyForTransfer)

  const summary: PlatformWalletSummary = {
    commissionPercent: settings.commissionPercent,
    paidVolumeGrosze: finance.paidVolumeGrosze,
    studentServiceFeeGrosze: finance.grossPlatformServiceFeeGrosze,
    packagePurchaseVolumeGrosze: finance.packagePurchaseVolumeGrosze,
    packageDeferredGrossGrosze: finance.packageDeferredGrossGrosze,
    packageReservedGrossGrosze: finance.packageReservedGrossGrosze,
    packageUsedGrossGrosze: finance.packageUsedGrossGrosze,
    refundsGrosze: finance.refundAmountGrosze,
    refundAmountGrosze: finance.refundAmountGrosze,
    refundCostGrosze: finance.refundCostGrosze,
    refundCount: finance.refundCount,
    grossPlatformCommissionGrosze: finance.grossPlatformCommissionGrosze,
    grossPlatformServiceFeeGrosze: finance.grossPlatformServiceFeeGrosze,
    knownPlatformCommissionGrosze: finance.knownPlatformCommissionGrosze,
    knownPlatformServiceFeeGrosze: finance.knownPlatformServiceFeeGrosze,
    stripeProcessingFeesGrosze: finance.stripeProcessingFeesGrosze,
    stripeFeesGrosze: finance.stripeProcessingFeesGrosze,
    stripeFeesComplete: finance.stripeFeesComplete,
    stripeFeesMissingCount: finance.stripeFeesMissingCount,
    stripeAdjustmentsGrosze: finance.stripeAdjustmentsGrosze,
    connectPayoutFeesGrosze: finance.connectPayoutFeesGrosze,
    otherStripeCostsGrosze: finance.otherStripeCostsGrosze,
    otherStripeCreditsGrosze: finance.otherStripeCreditsGrosze,
    netPlatformRevenueGrosze: finance.netPlatformRevenueGrosze,
    netPlatformRevenuePartial: finance.netPlatformRevenuePartial,
    teacherAmountGrosze: finance.teacherAmountGrosze,
    teacherPendingReleaseGrosze: paid
      .filter((lesson) => !lesson.stripeTransferId && !lessonIsReadyForTransfer(lesson))
      .reduce((sum, lesson) => sum + (lesson.teacherAmountGrosze ?? 0), 0),
    teacherReadyForTransferGrosze: readyForTransfer.reduce((sum, lesson) => sum + (lesson.teacherAmountGrosze ?? 0), 0),
    teacherTransferredGrosze: finance.teacherTransferredGrosze,
    stripeAvailableGrosze,
    stripePendingGrosze,
  }

  const lessonEntries: PlatformWalletEntry[] = lessons
    .filter((lesson) => lesson.paymentStatus === 'paid' || lesson.paymentStatus === 'refunded')
    .map((lesson) => {
      const subtotalGrosze = lesson.subtotalGrosze ?? lesson.priceGrosze ?? 0
      const studentServiceFeeGrosze = lesson.studentServiceFeeGrosze ?? 0
      const studentTotalGrosze = lesson.studentTotalGrosze ?? subtotalGrosze + studentServiceFeeGrosze
      const entryNetRevenue = (lesson.platformFeeGrosze ?? 0) + studentServiceFeeGrosze - (lesson.stripeFeeGrosze ?? 0)
      return {
        id: `lesson:${lesson.id}`,
        transactionType: classifyLessonFinanceEntry(lesson),
        lessonId: lesson.id,
        countsAsPaidVolume: lesson.paymentSource !== 'package',
        teacherName: lesson.teacherName,
        studentName: lesson.studentName,
        topic: lesson.topic,
        date: lesson.date && lesson.time ? `${lesson.date}, ${lesson.time}` : lesson.date || lesson.time || '—',
        grossGrosze: lesson.paymentSource === 'package' ? subtotalGrosze : studentTotalGrosze,
        subtotalGrosze,
        studentServiceFeeGrosze,
        studentTotalGrosze,
        platformFeeGrosze: lesson.platformFeeGrosze ?? 0,
        ...(typeof (lesson.effectiveCommissionPercent ?? lesson.commissionPercent) === 'number'
          ? { effectiveCommissionPercent: lesson.effectiveCommissionPercent ?? lesson.commissionPercent }
          : {}),
        ...(lesson.commissionSource ? { commissionSource: lesson.commissionSource } : {}),
        ...(typeof lesson.stripeFeeGrosze === 'number' ? { stripeFeeGrosze: lesson.stripeFeeGrosze } : {}),
        ...(lesson.paymentStatus === 'paid' && lesson.paymentSource !== 'package' && typeof lesson.stripeFeeGrosze === 'number'
          ? { netPlatformRevenueGrosze: entryNetRevenue }
          : {}),
        teacherAmountGrosze: lesson.teacherAmountGrosze ?? 0,
        status: lesson.paymentStatus ?? 'paid',
        settlementStatus: settlementStatus(lesson),
        transferStatus: transferStatus(lesson),
        createdAt: lesson.createdAt ?? 0,
      }
    })

  const packageEntries: PlatformWalletEntry[] = packages
    .filter((pkg) => pkg.status !== 'refunded')
    .map((pkg) => {
      const usedCredits = pkg.usedCredits ?? 0
      const reservedCredits = pkg.reservedCredits ?? 0
      const remainingCredits = pkg.remainingCredits ?? 0
      const perLessonGrossGrosze = pkg.perLessonGrossGrosze ?? 0
      const subtotalGrosze = pkg.subtotalGrosze ?? pkg.totalPriceGrosze ?? 0
      const studentServiceFeeGrosze = pkg.studentServiceFeeGrosze ?? 0
      const studentTotalGrosze = pkg.studentTotalGrosze ?? subtotalGrosze + studentServiceFeeGrosze
      const recognizedPlatformFeeGrosze = usedCredits * (pkg.platformFeePerLessonGrosze ?? 0)
      const recognizedTeacherAmountGrosze = usedCredits * (pkg.teacherAmountPerLessonGrosze ?? 0)
      const packageSizeLabel = pkg.packageSize ? `Pakiet ${pkg.packageSize} lekcji` : 'Pakiet lekcji'
      const packageTopic = [
        packageSizeLabel,
        pkg.specialty,
        typeof pkg.duration === 'number' ? `${pkg.duration} min` : undefined,
      ].filter(Boolean).join(' · ')
      return {
        id: `package:${pkg.id}`,
        transactionType: classifyPackageFinanceEntry(pkg),
        packageId: pkg.id,
        packageSize: pkg.packageSize,
        usedCredits,
        reservedCredits,
        remainingCredits,
        deferredGrossGrosze: (remainingCredits + reservedCredits) * perLessonGrossGrosze,
        countsAsPaidVolume: true,
        teacherName: pkg.teacherName,
        studentName: pkg.studentName,
        topic: packageTopic,
        date: 'Zakup pakietu',
        grossGrosze: studentTotalGrosze,
        subtotalGrosze,
        studentServiceFeeGrosze,
        studentTotalGrosze,
        platformFeeGrosze: recognizedPlatformFeeGrosze,
        effectiveCommissionPercent: pkg.effectiveCommissionPercent,
        commissionSource: pkg.commissionSource,
        teacherAmountGrosze: recognizedTeacherAmountGrosze,
        ...(typeof pkg.stripeFeeGrosze === 'number' ? { stripeFeeGrosze: pkg.stripeFeeGrosze } : {}),
        ...(typeof pkg.stripeFeeGrosze === 'number'
          ? { netPlatformRevenueGrosze: recognizedPlatformFeeGrosze + studentServiceFeeGrosze - pkg.stripeFeeGrosze }
          : {}),
        status: pkg.status,
        settlementStatus: 'waiting_lesson' as const,
        transferStatus: 'pending' as const,
        createdAt: pkg.createdAt ?? 0,
      }
    })

  const refundEntries: PlatformWalletEntry[] = financialEvents
    .filter((event) => event.type === 'refund')
    .map((event) => ({
      id: `refund:${event.id}`,
      transactionType: 'refund',
      lessonId: event.lessonId,
      stripeRefundId: event.stripeRefundId,
      countsAsPaidVolume: false,
      topic: 'Zwrot Stripe',
      date: event.status ?? 'refund',
      grossGrosze: Math.abs(event.refundAmountGrosze ?? event.amountGrosze),
      platformFeeGrosze: 0,
      stripeFeeGrosze: event.feeGrosze,
      netPlatformRevenueGrosze: event.netGrosze,
      teacherAmountGrosze: 0,
      status: 'refunded' as const,
      settlementStatus: 'refunded' as const,
      transferStatus: 'refunded' as const,
      createdAt: event.createdAt ?? 0,
    }))

  const entries = [...lessonEntries, ...packageEntries, ...refundEntries]
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
