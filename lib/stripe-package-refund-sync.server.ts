import 'server-only'
import type { Firestore } from 'firebase-admin/firestore'
import { stripe } from '@/lib/stripe'
import { collections } from '@/lib/firebase'
import { selectPackageRefundReviewPatch, stripeRefundListDataOrThrow, writePackageRefundReview } from '@/lib/lesson-package-refunds-core'
import type { LessonPackage } from '@/lib/types'

type StoredLessonPackage = LessonPackage & { id: string }

function canCheckPackageRefunds(pkg: StoredLessonPackage): boolean {
  return typeof pkg.stripePaymentIntentId === 'string' &&
    pkg.stripePaymentIntentId.length > 0 &&
    pkg.status !== 'refund_review' &&
    pkg.status !== 'refunded' &&
    pkg.status !== 'cancelled'
}

export async function lockLessonPackageIfStripeRefundExists(input: {
  database: Firestore
  pkg: StoredLessonPackage
}): Promise<boolean> {
  if (!canCheckPackageRefunds(input.pkg)) return false
  if (!stripe) throw new Error('Stripe is not configured for package refund preflight.')
  const refunds = await stripe.refunds.list({ payment_intent: input.pkg.stripePaymentIntentId!, limit: 10 })
  const patch = selectPackageRefundReviewPatch({ refunds: stripeRefundListDataOrThrow(refunds), now: Date.now() })
  if (!patch) return false
  const updated = await writePackageRefundReview({
    database: input.database,
    packageRef: input.database.collection(collections.lessonPackages).doc(input.pkg.id),
    patch,
  })
  if (updated) Object.assign(input.pkg, patch)
  return updated
}

export async function syncPackageRefundLocksForReporting(input: {
  database: Firestore
  packages: StoredLessonPackage[]
  limit?: number
}): Promise<{ checkedPackages: number; lockedPackages: number }> {
  if (!stripe) return { checkedPackages: 0, lockedPackages: 0 }

  const targets = input.packages
    .filter(canCheckPackageRefunds)
    .slice(0, input.limit ?? 20)

  let checkedPackages = 0
  let lockedPackages = 0
  for (const pkg of targets) {
    checkedPackages += 1
    if (await lockLessonPackageIfStripeRefundExists({ database: input.database, pkg })) lockedPackages += 1
  }

  return { checkedPackages, lockedPackages }
}
