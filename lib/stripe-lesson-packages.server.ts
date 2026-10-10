import 'server-only'
import type Stripe from 'stripe'
import { adminDb } from '@/lib/firebase-admin'
import { collections } from '@/lib/firebase'
import { existingLessonPackageIdForCheckout, normalizeLessonPackageSize, packageSubjectKey } from '@/lib/lesson-packages-core'
import { normalizeLessonPackagePurchaseMode } from '@/lib/lesson-package-purchases-core'
import { bookLessonWithPackageCreditServer } from '@/lib/lesson-package-booking.server'
import { runbeeAppUrl, sendProductNotificationEmail } from '@/lib/email/product-notifications.server'
import type { LessonPackage, LessonPackageFirstBookingStatus, LessonPackagePurchaseIntent } from '@/lib/types'

function paidCheckoutSession(session: Stripe.Checkout.Session): boolean {
  return session.status === 'complete' && session.payment_status === 'paid'
}

function moneyMeta(value: string | undefined, fallback: number): number {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? Math.max(0, Math.round(parsed)) : fallback
}

export async function ensureLessonPackageForCheckoutSession(session: Stripe.Checkout.Session): Promise<string | null> {
  if (!adminDb) return null
  const database = adminDb

  const existing = await database.collection(collections.lessonPackages).where('stripeCheckoutSessionId', '==', session.id).limit(1).get()
  const existingPackageId = existingLessonPackageIdForCheckout(existing.docs)
  if (existingPackageId) {
    await fulfillFirstBookingIfNeeded(existingPackageId, session)
    return existingPackageId
  }

  if (!paidCheckoutSession(session)) return null

  const m = session.metadata
  if (m?.paymentType !== 'lesson_package') return null
  const intentSnap = m.purchaseIntentId
    ? await database.collection(collections.lessonPackagePurchaseIntents).doc(m.purchaseIntentId).get()
    : null
  const intent = intentSnap?.exists ? { id: intentSnap.id, ...intentSnap.data() } as LessonPackagePurchaseIntent : null
  const packageSize = intent?.packageSize ?? normalizeLessonPackageSize(Number(m.packageSize))
  const subjectKey = intent?.subjectKey ?? packageSubjectKey({ subjectCategoryId: m.subjectCategoryId, specialty: m.specialty })
  const teacherId = intent?.teacherId ?? m.teacherId
  const studentId = intent?.studentId ?? m.studentId
  const payerId = intent?.payerId ?? m.payerId
  if (!packageSize || !teacherId || !studentId || !payerId || !subjectKey) {
    console.error('[stripe/packages] paid session missing required metadata', session.id)
    return null
  }

  const paymentIntentId = typeof session.payment_intent === 'string' ? session.payment_intent : session.payment_intent?.id
  const now = Date.now()
  const subtotalGrosze = intent?.subtotalGrosze ?? moneyMeta(m.subtotalGrosze, moneyMeta(m.totalPriceGrosze, 0))
  const studentServiceFeeGrosze = intent?.studentServiceFeeGrosze ?? moneyMeta(m.studentServiceFeeGrosze, 0)
  const studentTotalGrosze = intent?.studentTotalGrosze ?? moneyMeta(m.studentTotalGrosze, subtotalGrosze + studentServiceFeeGrosze)
  const ref = database.collection(collections.lessonPackages).doc(intent?.packageId || session.id)
  const purchaseMode = intent?.purchaseMode ?? normalizeLessonPackagePurchaseMode(m.purchaseMode)
  const pkg: Omit<LessonPackage, 'id'> = {
    teacherId,
    teacherName: intent?.teacherName ?? m.teacherName ?? '',
    teacherInitials: intent?.teacherInitials ?? m.teacherInitials ?? '',
    teacherColor: intent?.teacherColor ?? m.teacherColor ?? '#F4B400',
    ...(intent?.teacherPhotoUrl || m.teacherPhotoUrl ? { teacherPhotoUrl: intent?.teacherPhotoUrl ?? m.teacherPhotoUrl } : {}),
    studentId,
    studentName: intent?.studentName ?? m.studentName ?? '',
    payerId,
    payerRole: intent?.payerRole ?? (m.payerRole === 'parent' ? 'parent' : 'student'),
    packageSize,
    remainingCredits: packageSize,
    reservedCredits: 0,
    usedCredits: 0,
    subjectKey,
    ...(intent?.subjectCategoryId || m.subjectCategoryId ? { subjectCategoryId: intent?.subjectCategoryId ?? m.subjectCategoryId } : {}),
    specialty: intent?.specialty ?? m.specialty ?? '',
    duration: intent?.duration ?? Number(m.duration ?? 60),
    totalPriceGrosze: subtotalGrosze,
    subtotalGrosze,
    studentServiceFeeGrosze,
    studentTotalGrosze,
    perLessonGrossGrosze: intent?.perLessonGrossGrosze ?? Number(m.perLessonGrossGrosze ?? 0),
    platformFeePerLessonGrosze: intent?.platformFeePerLessonGrosze ?? Number(m.platformFeePerLessonGrosze ?? 0),
    teacherAmountPerLessonGrosze: intent?.teacherAmountPerLessonGrosze ?? Number(m.teacherAmountPerLessonGrosze ?? 0),
    effectiveCommissionPercent: intent?.effectiveCommissionPercent ?? Number(m.effectiveCommissionPercent ?? m.commissionPercent ?? 0),
    commissionSource: intent?.commissionSource ?? (m.commissionSource === 'founding_teacher' ? 'founding_teacher' : 'standard'),
    stripeCheckoutSessionId: session.id,
    ...(paymentIntentId ? { stripePaymentIntentId: paymentIntentId } : {}),
    purchaseMode,
    ...(intent ? { purchaseIntentId: intent.id } : {}),
    firstLessonBookingStatus: purchaseMode === 'package_and_book' ? 'pending' : 'not_requested',
    livemode: Boolean(session.livemode),
    status: 'active',
    createdAt: now,
  }

  const created = await database.runTransaction(async (tx) => {
    const current = await tx.get(ref)
    if (current.exists) return false
    tx.set(ref, pkg)
    if (intent) {
      tx.update(database.collection(collections.lessonPackagePurchaseIntents).doc(intent.id), {
        packageId: ref.id,
        stripeCheckoutSessionId: session.id,
        ...(paymentIntentId ? { stripePaymentIntentId: paymentIntentId } : {}),
        status: 'package_created',
        firstLessonBookingStatus: purchaseMode === 'package_and_book' ? 'pending' : 'not_requested',
        livemode: Boolean(session.livemode),
        updatedAt: now,
      })
    }
    return true
  })

  if (created) {
    await database.collection(collections.notifications).add({
      userId: studentId,
      type: 'payment',
      title: 'Pakiet lekcji aktywny',
      description: `Pakiet ${packageSize} lekcji z ${pkg.teacherName} jest gotowy do wykorzystania przy rezerwacji.`,
      date: new Date(now).toLocaleDateString('pl-PL', { day: 'numeric', month: 'short', year: 'numeric' }),
      read: false,
      createdAt: now,
    })
    await sendProductNotificationEmail({
      // The payment confirmation belongs to whoever paid (a parent may pay for a student).
      eventId: `lesson-package:${ref.id}:created:payer`,
      recipientUid: payerId,
      type: 'payments.paymentConfirmation',
      subject: 'Pakiet lekcji Runbee jest aktywny',
      title: 'Twój pakiet lekcji jest aktywny',
      preheader: `Pakiet ${packageSize} lekcji jest gotowy do wykorzystania.`,
      body: `Pakiet ${packageSize} lekcji z ${pkg.teacherName} został opłacony i jest gotowy do wykorzystania przy rezerwacji kolejnych terminów.`,
      details: [
        { label: 'Nauczyciel', value: pkg.teacherName },
        { label: 'Przedmiot', value: pkg.specialty },
        { label: 'Długość lekcji', value: `${pkg.duration} min` },
        { label: 'Dostępne lekcje', value: `${pkg.remainingCredits}/${pkg.packageSize}` },
      ],
      cta: { label: 'Zobacz moje pakiety', href: runbeeAppUrl('/dashboard') },
    })
  }

  await fulfillFirstBookingIfNeeded(ref.id, session)

  console.log(`[stripe/packages] Created lesson package ${ref.id} from checkout session ${session.id}`)
  return ref.id
}

async function fulfillFirstBookingIfNeeded(packageId: string, session: Stripe.Checkout.Session): Promise<void> {
  if (!adminDb || session.metadata?.paymentType !== 'lesson_package' || !session.metadata.purchaseIntentId) return
  const database = adminDb
  const intentRef = database.collection(collections.lessonPackagePurchaseIntents).doc(session.metadata.purchaseIntentId)
  const intentSnap = await intentRef.get()
  if (!intentSnap.exists) return
  const intent = { id: intentSnap.id, ...intentSnap.data() } as LessonPackagePurchaseIntent
  if (intent.purchaseMode !== 'package_and_book' || !intent.booking) return
  if (intent.firstLessonBookingStatus === 'booked' && intent.firstLessonId) return

  const result = await bookLessonWithPackageCreditServer({
    database,
    packageId,
    teacherId: intent.teacherId,
    dateIso: intent.booking.dateIso,
    time: intent.booking.time,
    duration: intent.duration,
    topic: intent.booking.topic,
    subjectCategoryId: intent.subjectCategoryId,
    specialty: intent.specialty,
    studentId: intent.studentId,
    studentName: intent.studentName,
    occurrenceCount: 1,
    bookingRequestId: intent.booking.bookingRequestId,
  })

  const now = Date.now()
  const packageRef = database.collection(collections.lessonPackages).doc(packageId)
  if (result.ok) {
    const firstLessonId = result.lessonIds[0]
    await Promise.all([
      intentRef.update({
        status: 'booked',
        firstLessonBookingStatus: 'booked' satisfies LessonPackageFirstBookingStatus,
        firstLessonId,
        firstLessonIds: result.lessonIds,
        updatedAt: now,
      }),
      packageRef.update({
        firstLessonBookingStatus: 'booked' satisfies LessonPackageFirstBookingStatus,
        firstLessonId,
        firstLessonIds: result.lessonIds,
        updatedAt: now,
      }),
    ])
    return
  }

  const bookingStatus: LessonPackageFirstBookingStatus = result.code === 'slot_conflict' ? 'slot_conflict' : 'failed'
  await Promise.all([
    intentRef.update({
      status: 'booking_failed',
      firstLessonBookingStatus: bookingStatus,
      firstLessonBookingError: result.error,
      updatedAt: now,
    }),
    packageRef.update({
      firstLessonBookingStatus: bookingStatus,
      firstLessonBookingError: result.error,
      updatedAt: now,
    }),
  ])
}
