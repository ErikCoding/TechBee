import {
  beePointsEarningRulesData,
  beePointsEventsData,
  beePointsRedemptionRulesData,
  beePointsStatsData,
  beePointsTiersData,
} from '@/data/beepoints.data'
import type { BeePointsEvent, BeePointsRule, BeePointsStats, BeePointsTier } from '@/lib/types'

// ─────────────────────────────────────────────────────────────
// Data-access layer for the BeePoints loyalty program.
// ─────────────────────────────────────────────────────────────

export async function getBeePointsTiers(): Promise<BeePointsTier[]> {
  // Tiers are program config, not per-user — could live in Firestore `config/beepoints`
  return beePointsTiersData
}

export async function getBeePointsStats(_userId?: string): Promise<BeePointsStats> {
  // TODO(firebase): const snap = await getDoc(doc(db, 'beepoints', userId))
  return beePointsStatsData
}

export async function getBeePointsEvents(_userId?: string): Promise<BeePointsEvent[]> {
  // TODO(firebase): const snap = await getDocs(collection(db, 'beepoints', userId, 'events'))
  return beePointsEventsData
}

export async function getBeePointsRules(): Promise<{ earning: BeePointsRule[]; redemption: BeePointsRule[] }> {
  // Program rules — same config-doc candidate as tiers.
  return { earning: beePointsEarningRulesData, redemption: beePointsRedemptionRulesData }
}
