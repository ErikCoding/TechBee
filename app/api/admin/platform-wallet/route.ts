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

async function buildPlatformWallet(): Promise<{ summary: PlatformWalletSummary; entries: PlatformWalletEntry[] }> {
  const settings = await getPlatformPaymentSettings()
  const lessonsSnap = await adminDb!.collection(collections.lessons).get()
  const lessons = lessonsSnap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Lesson, 'id'>) }))
  const paid = lessons.filter((lesson) => lesson.paymentStatus === 'paid')
  const refunded = lessons.filter((lesson) => lesson.paymentStatus === 'refunded')

  let availableGrosze: number | null = null
  let pendingGrosze: number | null = null
  if (isStripeConfigured) {
    try {
      const balance = await stripe!.balance.retrieve()
      availableGrosze = balance.available.find((b) => b.currency === STRIPE_CURRENCY)?.amount ?? 0
      pendingGrosze = balance.pending.find((b) => b.currency === STRIPE_CURRENCY)?.amount ?? 0
    } catch (err) {
      console.error('[admin/platform-wallet] Failed to fetch Stripe balance:', err)
    }
  }

  const summary: PlatformWalletSummary = {
    commissionPercent: settings.commissionPercent,
    availableGrosze,
    pendingGrosze,
    grossPaidGrosze: paid.reduce((sum, lesson) => sum + (lesson.priceGrosze ?? 0), 0),
    platformFeesGrosze: paid.reduce((sum, lesson) => sum + (lesson.platformFeeGrosze ?? 0), 0),
    teacherTransfersGrosze: paid.filter((lesson) => lesson.stripeTransferId).reduce((sum, lesson) => sum + (lesson.teacherAmountGrosze ?? 0), 0),
    pendingTeacherTransfersGrosze: paid.filter((lesson) => !lesson.stripeTransferId).reduce((sum, lesson) => sum + (lesson.teacherAmountGrosze ?? 0), 0),
    refundedGrosze: refunded.reduce((sum, lesson) => sum + (lesson.priceGrosze ?? 0), 0),
  }

  const entries: PlatformWalletEntry[] = paid
    .map((lesson) => ({
      lessonId: lesson.id,
      teacherName: lesson.teacherName,
      studentName: lesson.studentName,
      topic: lesson.topic,
      grossGrosze: lesson.priceGrosze ?? 0,
      platformFeeGrosze: lesson.platformFeeGrosze ?? 0,
      teacherAmountGrosze: lesson.teacherAmountGrosze ?? 0,
      status: lesson.paymentStatus ?? 'paid',
      transferStatus: lesson.stripeTransferId ? 'sent' as const : 'pending' as const,
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
