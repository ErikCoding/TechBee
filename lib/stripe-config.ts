// ─────────────────────────────────────────────────────────────
// Shared Stripe constants. PLATFORM_COMMISSION_PERCENT is only the
// fallback standard commission used when admin-controlled payment
// settings are unavailable or invalid; platformSettings/payments stays
// the source of truth whenever it contains a valid value.
//
// Money is always handled in the smallest currency unit (grosze —
// 100 PLN = 10000) everywhere it touches Stripe or gets persisted,
// to avoid floating-point drift. `Lesson.price`/`Teacher.hourlyRate`
// stay plain PLN numbers (pre-existing, UI-facing) — the `*Grosze`
// fields added alongside them are the authoritative money values.
// ─────────────────────────────────────────────────────────────

export const PLATFORM_COMMISSION_PERCENT = 8

export const STRIPE_CURRENCY = 'pln'

/** PLN → grosze (smallest unit), rounded to the nearest grosz. */
export function toGrosze(pln: number): number {
  return Math.round(pln * 100)
}

/** Grosze → PLN, for display. */
export function fromGrosze(grosze: number): number {
  return Math.round(grosze) / 100
}

/** Splits a gross lesson price (in grosze) into the platform's commission and the teacher's net earnings. Commission is rounded to the nearest grosz; teacherAmount + platformFee always sums back to grossAmount exactly. */
export function splitPayment(grossGrosze: number, commissionPercent = PLATFORM_COMMISSION_PERCENT): { platformFeeGrosze: number; teacherAmountGrosze: number } {
  const platformFeeGrosze = Math.round((grossGrosze * commissionPercent) / 100)
  return { platformFeeGrosze, teacherAmountGrosze: grossGrosze - platformFeeGrosze }
}
