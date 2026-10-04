import 'server-only'
import type { Firestore } from 'firebase-admin/firestore'
import { collections } from '@/lib/firebase'
import { getStripePaymentFeeSnapshot, type StripePaymentFeeSnapshot } from '@/lib/stripe-payment-fees'
import { syncMissingStripeFeeTargets, type StripeFeeSyncTarget } from '@/lib/stripe-fee-sync-core'
import type { Lesson, LessonPackage } from '@/lib/types'

type StoredLesson = Lesson & { id: string }
type StoredLessonPackage = LessonPackage & { id: string }

async function writeLessonFeeSnapshot(
  database: Firestore,
  target: StripeFeeSyncTarget,
  snapshot: StripePaymentFeeSnapshot,
): Promise<boolean> {
  const lessonRef = database.collection(collections.lessons).doc(target.id)
  const snapshotRef = database.collection(collections.lessonPaymentSnapshots).doc(target.id)

  return database.runTransaction(async (tx) => {
    const current = await tx.get(lessonRef)
    if (!current.exists) return false
    const data = current.data() as Lesson
    if (Number.isFinite(data.stripeFeeGrosze)) return false
    if (data.stripePaymentIntentId !== target.stripePaymentIntentId) return false

    tx.update(lessonRef, { stripeFeeGrosze: snapshot.stripeFeeGrosze })
    tx.set(snapshotRef, {
      lessonId: target.id,
      stripePaymentIntentId: target.stripePaymentIntentId,
      stripeFeeGrosze: snapshot.stripeFeeGrosze,
      stripeChargeId: snapshot.stripeChargeId,
      stripeBalanceTransactionId: snapshot.stripeBalanceTransactionId,
      livemode: Boolean(data.livemode),
      createdAt: data.createdAt ?? Date.now(),
      updatedAt: Date.now(),
    }, { merge: true })
    return true
  })
}

async function writePackageFeeSnapshot(
  database: Firestore,
  target: StripeFeeSyncTarget,
  snapshot: StripePaymentFeeSnapshot,
): Promise<boolean> {
  const packageRef = database.collection(collections.lessonPackages).doc(target.id)

  return database.runTransaction(async (tx) => {
    const current = await tx.get(packageRef)
    if (!current.exists) return false
    const data = current.data() as LessonPackage
    if (Number.isFinite(data.stripeFeeGrosze)) return false
    if (data.stripePaymentIntentId !== target.stripePaymentIntentId) return false

    tx.update(packageRef, {
      stripeFeeGrosze: snapshot.stripeFeeGrosze,
      stripeChargeId: snapshot.stripeChargeId,
      stripeBalanceTransactionId: snapshot.stripeBalanceTransactionId,
    })
    return true
  })
}

export async function syncMissingStripeFeesForReporting(input: {
  database: Firestore
  lessons: StoredLesson[]
  packages: StoredLessonPackage[]
  limit?: number
}): Promise<{ updatedLessons: number; updatedPackages: number }> {
  const targets: StripeFeeSyncTarget[] = [
    ...input.lessons
      .filter((lesson) => lesson.paymentStatus === 'paid' && lesson.paymentSource !== 'package')
      .map((lesson) => ({
        id: lesson.id,
        kind: 'lesson' as const,
        stripePaymentIntentId: lesson.stripePaymentIntentId,
        stripeFeeGrosze: lesson.stripeFeeGrosze,
      })),
    ...input.packages
      .filter((pkg) => pkg.status !== 'refunded')
      .map((pkg) => ({
        id: pkg.id,
        kind: 'package' as const,
        stripePaymentIntentId: pkg.stripePaymentIntentId,
        stripeFeeGrosze: pkg.stripeFeeGrosze,
      })),
  ]

  let updatedLessons = 0
  let updatedPackages = 0
  await syncMissingStripeFeeTargets({
    targets,
    limit: input.limit,
    fetchFeeSnapshot: getStripePaymentFeeSnapshot,
    writeFeeSnapshot: async (target, snapshot) => {
      const updated = target.kind === 'lesson'
        ? await writeLessonFeeSnapshot(input.database, target, snapshot)
        : await writePackageFeeSnapshot(input.database, target, snapshot)
      if (!updated) return false
      if (target.kind === 'lesson') {
        const lesson = input.lessons.find((item) => item.id === target.id)
        if (lesson) lesson.stripeFeeGrosze = snapshot.stripeFeeGrosze
        updatedLessons += 1
      } else {
        const pkg = input.packages.find((item) => item.id === target.id)
        if (pkg) {
          pkg.stripeFeeGrosze = snapshot.stripeFeeGrosze
          pkg.stripeChargeId = snapshot.stripeChargeId
          pkg.stripeBalanceTransactionId = snapshot.stripeBalanceTransactionId
        }
        updatedPackages += 1
      }
      return true
    },
  })

  return { updatedLessons, updatedPackages }
}
