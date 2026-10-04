import 'server-only'
import type Stripe from 'stripe'
import { adminDb } from '@/lib/firebase-admin'
import { collections } from '@/lib/firebase'
import { existingLessonPackageIdForCheckout, normalizeLessonPackageSize, packageSubjectKey } from '@/lib/lesson-packages-core'
import type { LessonPackage } from '@/lib/types'

function paidCheckoutSession(session: Stripe.Checkout.Session): boolean {
  return session.status === 'complete' && session.payment_status === 'paid'
}

export async function ensureLessonPackageForCheckoutSession(session: Stripe.Checkout.Session): Promise<string | null> {
  if (!adminDb) return null
  const database = adminDb

  const existing = await database.collection(collections.lessonPackages).where('stripeCheckoutSessionId', '==', session.id).limit(1).get()
  const existingPackageId = existingLessonPackageIdForCheckout(existing.docs)
  if (existingPackageId) return existingPackageId

  if (!paidCheckoutSession(session)) return null

  const m = session.metadata
  if (m?.paymentType !== 'lesson_package') return null
  const packageSize = normalizeLessonPackageSize(Number(m.packageSize))
  const subjectKey = packageSubjectKey({ subjectCategoryId: m.subjectCategoryId, specialty: m.specialty })
  if (!packageSize || !m.teacherId || !m.studentId || !m.payerId || !subjectKey) {
    console.error('[stripe/packages] paid session missing required metadata', session.id)
    return null
  }

  const paymentIntentId = typeof session.payment_intent === 'string' ? session.payment_intent : session.payment_intent?.id
  const now = Date.now()
  const ref = database.collection(collections.lessonPackages).doc()
  const pkg: Omit<LessonPackage, 'id'> = {
    teacherId: m.teacherId,
    teacherName: m.teacherName ?? '',
    teacherInitials: m.teacherInitials ?? '',
    teacherColor: m.teacherColor || '#F4B400',
    ...(m.teacherPhotoUrl ? { teacherPhotoUrl: m.teacherPhotoUrl } : {}),
    studentId: m.studentId,
    studentName: m.studentName ?? '',
    payerId: m.payerId,
    payerRole: m.payerRole === 'parent' ? 'parent' : 'student',
    packageSize,
    remainingCredits: packageSize,
    reservedCredits: 0,
    usedCredits: 0,
    subjectKey,
    ...(m.subjectCategoryId ? { subjectCategoryId: m.subjectCategoryId } : {}),
    specialty: m.specialty ?? '',
    duration: Number(m.duration ?? 60),
    totalPriceGrosze: Number(m.totalPriceGrosze ?? 0),
    perLessonGrossGrosze: Number(m.perLessonGrossGrosze ?? 0),
    platformFeePerLessonGrosze: Number(m.platformFeePerLessonGrosze ?? 0),
    teacherAmountPerLessonGrosze: Number(m.teacherAmountPerLessonGrosze ?? 0),
    effectiveCommissionPercent: Number(m.effectiveCommissionPercent ?? m.commissionPercent ?? 0),
    commissionSource: m.commissionSource === 'founding_teacher' ? 'founding_teacher' : 'standard',
    stripeCheckoutSessionId: session.id,
    ...(paymentIntentId ? { stripePaymentIntentId: paymentIntentId } : {}),
    livemode: Boolean(session.livemode),
    status: 'active',
    createdAt: now,
  }

  await ref.set(pkg)
  await database.collection(collections.notifications).add({
    userId: m.studentId,
    type: 'payment',
    title: 'Pakiet lekcji aktywny',
    description: `Pakiet ${packageSize} lekcji z ${m.teacherName} jest gotowy do wykorzystania przy rezerwacji.`,
    date: new Date(now).toLocaleDateString('pl-PL', { day: 'numeric', month: 'short', year: 'numeric' }),
    read: false,
    createdAt: now,
  })

  console.log(`[stripe/packages] Created lesson package ${ref.id} from checkout session ${session.id}`)
  return ref.id
}
