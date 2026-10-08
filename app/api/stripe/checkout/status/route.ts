import { NextResponse } from 'next/server'
import { adminDb, isAdminConfigured } from '@/lib/firebase-admin'
import { collections } from '@/lib/firebase'
import { stripe, isStripeConfigured } from '@/lib/stripe'
import { verifyCaller } from '@/lib/stripe-server-auth'
import { canAccessCheckoutSubject } from '@/lib/checkout-session-access-core'
import { ensureLessonForCheckoutSession } from '@/lib/stripe-checkout-lessons'
import { ensureLessonPackageForCheckoutSession } from '@/lib/stripe-lesson-packages.server'
import type { Lesson, LessonPackage, LessonPackagePurchaseIntent } from '@/lib/types'

// ─────────────────────────────────────────────────────────────

function moneyMeta(value: string | undefined, fallback = 0): number {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? Math.max(0, Math.round(parsed)) : fallback
}

function lessonPaymentBreakdown(lesson: Lesson) {
  const subtotalGrosze = lesson.subtotalGrosze ?? lesson.priceGrosze ?? Math.round((lesson.price ?? 0) * 100)
  const studentServiceFeeGrosze = lesson.studentServiceFeeGrosze ?? 0
  return {
    subtotalGrosze,
    studentServiceFeeGrosze,
    studentTotalGrosze: lesson.studentTotalGrosze ?? subtotalGrosze + studentServiceFeeGrosze,
  }
}

function packagePaymentBreakdown(pkg: LessonPackage) {
  const subtotalGrosze = pkg.subtotalGrosze ?? pkg.totalPriceGrosze ?? 0
  const studentServiceFeeGrosze = pkg.studentServiceFeeGrosze ?? 0
  return {
    subtotalGrosze,
    studentServiceFeeGrosze,
    studentTotalGrosze: pkg.studentTotalGrosze ?? subtotalGrosze + studentServiceFeeGrosze,
  }
}

function packageBookingResult(pkg: LessonPackage) {
  return {
    firstLessonBookingStatus: pkg.firstLessonBookingStatus,
    firstLessonId: pkg.firstLessonId,
    firstLessonBookingError: pkg.firstLessonBookingError,
  }
}

function sessionPaymentBreakdown(session: { metadata?: Record<string, string> | null }) {
  const m = session.metadata
  if (!m) return undefined
  const subtotalGrosze = moneyMeta(m.subtotalGrosze, moneyMeta(m.priceGrosze, moneyMeta(m.totalPriceGrosze, 0)))
  const studentServiceFeeGrosze = moneyMeta(m.studentServiceFeeGrosze, 0)
  return {
    subtotalGrosze,
    studentServiceFeeGrosze,
    studentTotalGrosze: moneyMeta(m.studentTotalGrosze, subtotalGrosze + studentServiceFeeGrosze),
  }
}
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
  const authHeader = request.headers.get('authorization')
  const idToken = authHeader?.startsWith('Bearer ') ? authHeader.slice('Bearer '.length) : undefined
  const uid = await verifyCaller(idToken)
  if (!uid) return NextResponse.json({ error: 'Musisz być zalogowany.' }, { status: 401 })
  const callerUid = uid

  async function canAccessPayment(subject: { studentId?: string | null; payerId?: string | null }): Promise<boolean> {
    const [viewerSnap, studentSnap] = await Promise.all([
      adminDb!.collection(collections.users).doc(callerUid).get(),
      subject.studentId ? adminDb!.collection(collections.users).doc(subject.studentId).get() : Promise.resolve(null),
    ])
    return canAccessCheckoutSubject(subject, {
      uid: callerUid,
      role: viewerSnap.data()?.role,
      linkedParentIds: studentSnap?.data()?.linkedParentIds,
    })
  }

  const [lessonSnap, packageSnap] = await Promise.all([
    adminDb!.collection(collections.lessons).where('stripeCheckoutSessionId', '==', sessionId).limit(1).get(),
    adminDb!.collection(collections.lessonPackages).where('stripeCheckoutSessionId', '==', sessionId).limit(1).get(),
  ])
  if (!lessonSnap.empty) {
    const lesson = lessonSnap.docs[0].data() as Lesson
    if (!(await canAccessPayment({ studentId: lesson.studentId, payerId: lesson.payerId }))) {
      return NextResponse.json({ error: 'Brak dostępu do tej płatności.' }, { status: 403 })
    }
    return NextResponse.json({ type: 'lesson', lessonId: lessonSnap.docs[0].id, payment: lessonPaymentBreakdown(lesson) })
  }
  if (!packageSnap.empty) {
    const pkg = packageSnap.docs[0].data() as LessonPackage
    if (!(await canAccessPayment({ studentId: pkg.studentId, payerId: pkg.payerId }))) {
      return NextResponse.json({ error: 'Brak dostępu do tej płatności.' }, { status: 403 })
    }
    return NextResponse.json({ type: 'lesson_package', packageId: packageSnap.docs[0].id, payment: packagePaymentBreakdown(pkg), ...packageBookingResult(pkg) })
  }

  if (!isStripeConfigured) return NextResponse.json({ lessonId: null })

  try {
    const session = await stripe!.checkout.sessions.retrieve(sessionId)
    let checkoutSubject = { studentId: session.metadata?.studentId, payerId: session.metadata?.payerId }
    if (session.metadata?.paymentType === 'lesson_package' && session.metadata.purchaseIntentId && !checkoutSubject.studentId) {
      const intentSnap = await adminDb!.collection(collections.lessonPackagePurchaseIntents).doc(session.metadata.purchaseIntentId).get()
      const intent = intentSnap.exists ? intentSnap.data() as LessonPackagePurchaseIntent : null
      checkoutSubject = { studentId: intent?.studentId, payerId: intent?.payerId }
    }
    if (!(await canAccessPayment(checkoutSubject))) {
      return NextResponse.json({ error: 'Brak dostępu do tej płatności.' }, { status: 403 })
    }
    if (session.metadata?.paymentType === 'lesson_package') {
      const packageId = await ensureLessonPackageForCheckoutSession(session)
      const pkgSnap = packageId ? await adminDb!.collection(collections.lessonPackages).doc(packageId).get() : null
      const pkg = pkgSnap?.exists ? pkgSnap.data() as LessonPackage : null
      return NextResponse.json({
        type: packageId ? 'lesson_package' : null,
        packageId,
        payment: pkg ? packagePaymentBreakdown(pkg) : sessionPaymentBreakdown(session),
        ...(pkg ? packageBookingResult(pkg) : {}),
      })
    }
    const lessonId = await ensureLessonForCheckoutSession(session)
    return NextResponse.json({ type: lessonId ? 'lesson' : null, lessonId, payment: sessionPaymentBreakdown(session) })
  } catch (err) {
    console.error('[stripe/checkout/status] Failed to reconcile session:', err)
    return NextResponse.json({ lessonId: null })
  }
}
