import type { StripePaymentFeeSnapshot } from './stripe-payment-fees'

export type StripeFeeSyncTarget = {
  id: string
  kind: 'lesson' | 'package'
  stripePaymentIntentId?: string
  stripeFeeGrosze?: number
}

export type StripeFeeSyncResult = {
  checked: number
  updated: number
  missingFromStripe: number
}

function missingFee(target: StripeFeeSyncTarget): boolean {
  return typeof target.stripePaymentIntentId === 'string'
    && target.stripePaymentIntentId.length > 0
    && !Number.isFinite(target.stripeFeeGrosze)
}

export function selectMissingStripeFeeTargets(targets: StripeFeeSyncTarget[], limit: number): StripeFeeSyncTarget[] {
  return targets.filter(missingFee).slice(0, Math.max(0, limit))
}

export async function syncMissingStripeFeeTargets(input: {
  targets: StripeFeeSyncTarget[]
  fetchFeeSnapshot: (paymentIntentId: string) => Promise<StripePaymentFeeSnapshot | null>
  writeFeeSnapshot: (target: StripeFeeSyncTarget, snapshot: StripePaymentFeeSnapshot) => Promise<boolean>
  limit?: number
}): Promise<StripeFeeSyncResult> {
  const targets = selectMissingStripeFeeTargets(input.targets, input.limit ?? 20)
  const result: StripeFeeSyncResult = { checked: targets.length, updated: 0, missingFromStripe: 0 }

  for (const target of targets) {
    const snapshot = await input.fetchFeeSnapshot(target.stripePaymentIntentId!)
    if (!snapshot) {
      result.missingFromStripe += 1
      continue
    }
    if (await input.writeFeeSnapshot(target, snapshot)) {
      result.updated += 1
    }
  }

  return result
}
