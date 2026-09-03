import 'server-only'
import { adminDb } from '@/lib/firebase-admin'
import { collections } from '@/lib/firebase'
import { PLATFORM_COMMISSION_PERCENT } from '@/lib/stripe-config'
import type { PlatformPaymentSettings } from '@/lib/types'

const SETTINGS_DOC_ID = 'payments'
const MIN_COMMISSION_PERCENT = 0
const MAX_COMMISSION_PERCENT = 50

export function normalizeCommissionPercent(value: unknown): number {
  const numeric = Number(value)
  if (!Number.isFinite(numeric)) return PLATFORM_COMMISSION_PERCENT
  const clamped = Math.min(MAX_COMMISSION_PERCENT, Math.max(MIN_COMMISSION_PERCENT, numeric))
  return Math.round(clamped * 100) / 100
}

export async function getPlatformPaymentSettings(): Promise<PlatformPaymentSettings> {
  if (!adminDb) return { commissionPercent: PLATFORM_COMMISSION_PERCENT }
  const snap = await adminDb.collection(collections.platformSettings).doc(SETTINGS_DOC_ID).get()
  if (!snap.exists) return { commissionPercent: PLATFORM_COMMISSION_PERCENT }
  const data = snap.data() as Partial<PlatformPaymentSettings>
  return {
    commissionPercent: normalizeCommissionPercent(data.commissionPercent),
    updatedAt: data.updatedAt,
    updatedBy: data.updatedBy,
  }
}

export async function updatePlatformCommissionPercent(commissionPercent: number, adminId: string): Promise<PlatformPaymentSettings> {
  if (!adminDb) return { commissionPercent: PLATFORM_COMMISSION_PERCENT }
  const settings: PlatformPaymentSettings = {
    commissionPercent: normalizeCommissionPercent(commissionPercent),
    updatedAt: Date.now(),
    updatedBy: adminId,
  }
  await adminDb.collection(collections.platformSettings).doc(SETTINGS_DOC_ID).set(settings, { merge: true })
  return settings
}
