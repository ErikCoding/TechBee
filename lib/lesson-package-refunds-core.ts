import type { LessonPackageStatus } from './types'

export type RefundReviewPatch = {
  status: LessonPackageStatus
  refundRequiresAdminReview: true
  stripeRefundId?: string
  stripeRefundStatus?: string
  refundAmountGrosze?: number
  refundFull?: boolean
  refundedAt: number
  updatedAt: number
}

type ObjectWithId = { id?: unknown }

function objectId(value: unknown): string | null {
  return value && typeof value === 'object' && typeof (value as ObjectWithId).id === 'string'
    ? (value as { id: string }).id
    : null
}

export function paymentIntentIdFromRefundLike(refund: {
  payment_intent?: unknown
  charge?: unknown
}, charge?: { payment_intent?: unknown } | null): string | null {
  if (typeof refund.payment_intent === 'string') return refund.payment_intent
  const refundPaymentIntentId = objectId(refund.payment_intent)
  if (refundPaymentIntentId) return refundPaymentIntentId
  if (typeof charge?.payment_intent === 'string') return charge.payment_intent
  return objectId(charge?.payment_intent)
}

export function shouldLockPackageForRefundStatus(status: string | null | undefined): boolean {
  const normalized = typeof status === 'string' ? status.toLowerCase() : ''
  return normalized !== 'failed' && normalized !== 'canceled' && normalized !== 'cancelled'
}

export function buildPackageRefundReviewPatch(input: {
  stripeRefundId?: string
  refundStatus?: string | null
  refundAmountGrosze?: number
  refundFull?: boolean
  now: number
}): RefundReviewPatch | null {
  if (!shouldLockPackageForRefundStatus(input.refundStatus)) return null
  return {
    status: 'refund_review',
    refundRequiresAdminReview: true,
    ...(input.stripeRefundId ? { stripeRefundId: input.stripeRefundId } : {}),
    ...(input.refundStatus ? { stripeRefundStatus: input.refundStatus } : {}),
    ...(typeof input.refundAmountGrosze === 'number' ? { refundAmountGrosze: input.refundAmountGrosze } : {}),
    ...(typeof input.refundFull === 'boolean' ? { refundFull: input.refundFull } : {}),
    refundedAt: input.now,
    updatedAt: input.now,
  }
}

export function selectPackageRefundReviewPatch(input: {
  refunds: Array<{ id?: string; status?: string | null; amount?: number }>
  now: number
}): RefundReviewPatch | null {
  for (const refund of input.refunds) {
    const patch = buildPackageRefundReviewPatch({
      stripeRefundId: refund.id,
      refundStatus: refund.status,
      refundAmountGrosze: refund.amount,
      now: input.now,
    })
    if (patch) return patch
  }
  return null
}

export function stripeRefundListDataOrThrow(input: { data?: unknown }): Array<{ id?: string; status?: string | null; amount?: number }> {
  if (!Array.isArray(input.data)) {
    throw new Error('Stripe refund list response was incomplete.')
  }
  return input.data as Array<{ id?: string; status?: string | null; amount?: number }>
}

export async function writePackageRefundReview(input: {
  database: {
    runTransaction<T>(fn: (tx: {
      get(ref: unknown): Promise<{ exists: boolean }>
      update(ref: unknown, patch: RefundReviewPatch): void
    }) => Promise<T>): Promise<T>
  }
  packageRef: unknown | null | undefined
  patch: RefundReviewPatch | null
}): Promise<boolean> {
  if (!input.packageRef || !input.patch) return false
  return input.database.runTransaction(async (tx) => {
    const packageSnap = await tx.get(input.packageRef)
    if (!packageSnap.exists) return false
    tx.update(input.packageRef, input.patch!)
    return true
  })
}
