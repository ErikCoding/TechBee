import type {
  CommissionSource,
  FoundingTeacherProgramConfig,
  FoundingTeacherPromotion,
} from '@/lib/types'

export const FOUNDING_TEACHER_CONFIG_DOC_ID = 'foundingTeacherProgram'
export const FOUNDING_TEACHER_DAY_MS = 24 * 60 * 60 * 1000

export const FOUNDING_TEACHER_DEFAULT_CONFIG: FoundingTeacherProgramConfig = {
  enabled: false,
  limit: 50,
  promoRate: 5,
  durationDays: 90,
  participantsCount: 0,
  marketplaceHighlightEnabled: true,
  homepageBannerEnabled: true,
  teachSectionEnabled: true,
}

function numberOrFallback(value: unknown, fallback: number): number {
  const n = Number(value)
  return Number.isFinite(n) ? n : fallback
}

function booleanOrFallback(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback
}

export function clampPercent(value: unknown, fallback: number): number {
  const n = numberOrFallback(value, fallback)
  return Math.min(50, Math.max(0, Math.round(n * 100) / 100))
}

export function normalizeFoundingTeacherConfig(input?: Partial<FoundingTeacherProgramConfig> | null): FoundingTeacherProgramConfig {
  const source = input ?? {}
  return {
    enabled: booleanOrFallback(source.enabled, FOUNDING_TEACHER_DEFAULT_CONFIG.enabled),
    limit: Math.max(1, Math.floor(numberOrFallback(source.limit, FOUNDING_TEACHER_DEFAULT_CONFIG.limit))),
    promoRate: clampPercent(source.promoRate, FOUNDING_TEACHER_DEFAULT_CONFIG.promoRate),
    durationDays: Math.max(1, Math.floor(numberOrFallback(source.durationDays, FOUNDING_TEACHER_DEFAULT_CONFIG.durationDays))),
    participantsCount: Math.max(0, Math.floor(numberOrFallback(source.participantsCount, FOUNDING_TEACHER_DEFAULT_CONFIG.participantsCount))),
    marketplaceHighlightEnabled: booleanOrFallback(source.marketplaceHighlightEnabled, FOUNDING_TEACHER_DEFAULT_CONFIG.marketplaceHighlightEnabled),
    homepageBannerEnabled: booleanOrFallback(source.homepageBannerEnabled, FOUNDING_TEACHER_DEFAULT_CONFIG.homepageBannerEnabled),
    teachSectionEnabled: booleanOrFallback(source.teachSectionEnabled, FOUNDING_TEACHER_DEFAULT_CONFIG.teachSectionEnabled),
    ...(typeof source.initializedAt === 'number' ? { initializedAt: source.initializedAt } : {}),
    ...(typeof source.initializedBy === 'string' ? { initializedBy: source.initializedBy } : {}),
    ...(typeof source.updatedAt === 'number' ? { updatedAt: source.updatedAt } : {}),
    ...(typeof source.updatedBy === 'string' ? { updatedBy: source.updatedBy } : {}),
  }
}

export function foundingPromotionIsActive(promotion?: FoundingTeacherPromotion | null, now = Date.now()): promotion is FoundingTeacherPromotion {
  return Boolean(
    promotion &&
      promotion.type === 'founding_teacher' &&
      Number.isFinite(promotion.rate) &&
      promotion.rate >= 0 &&
      Number.isFinite(promotion.startedAt) &&
      Number.isFinite(promotion.endsAt) &&
      promotion.startedAt <= now &&
      promotion.endsAt > now,
  )
}

export function getFoundingPromotionStatus(
  promotion?: FoundingTeacherPromotion | null,
  now = Date.now(),
): 'active' | 'expiring_soon' | 'ended' {
  if (!foundingPromotionIsActive(promotion, now)) return 'ended'
  return promotion.endsAt - now <= 7 * FOUNDING_TEACHER_DAY_MS ? 'expiring_soon' : 'active'
}

export function calculateFoundingPromotionEndsAt(startedAt: number, durationDays: number): number {
  return startedAt + Math.max(1, Math.floor(durationDays)) * FOUNDING_TEACHER_DAY_MS
}

export function computeNextFoundingTeacherNumber(participantsCount: number, limit: number): number | null {
  const count = Math.max(0, Math.floor(participantsCount))
  const max = Math.max(1, Math.floor(limit))
  if (count >= max) return null
  return count + 1
}

export function foundingTeacherSlotId(number: number): string {
  return String(Math.max(1, Math.floor(number))).padStart(3, '0')
}

export function resolveEffectiveCommission(input: {
  standardCommissionPercent: number
  foundingTeacherPromotion?: FoundingTeacherPromotion | null
  now?: number
}): { effectiveCommissionPercent: number; commissionSource: CommissionSource } {
  if (foundingPromotionIsActive(input.foundingTeacherPromotion, input.now ?? Date.now())) {
    return {
      effectiveCommissionPercent: clampPercent(input.foundingTeacherPromotion.rate, input.standardCommissionPercent),
      commissionSource: 'founding_teacher',
    }
  }
  return {
    effectiveCommissionPercent: clampPercent(input.standardCommissionPercent, FOUNDING_TEACHER_DEFAULT_CONFIG.promoRate),
    commissionSource: 'standard',
  }
}
