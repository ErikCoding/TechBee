// ─────────────────────────────────────────────────────────────
// Shared Stripe constants — the one place platform-commission and
// currency live, so both server (actual charge/transfer math) and
// client (UI display) agree. Change PLATFORM_COMMISSION_PERCENT here
// and every calculation picks it up automatically.
//
// Money is always handled in the smallest currency unit (grosze —
// 100 PLN = 10000) everywhere it touches Stripe or gets persisted,
// to avoid floating-point drift. `Lesson.price`/`Teacher.hourlyRate`
// stay plain PLN numbers (pre-existing, UI-facing) — the `*Grosze`
// fields added alongside them are the authoritative money values.
// ─────────────────────────────────────────────────────────────

export const PLATFORM_COMMISSION_PERCENT = 15

export const STRIPE_CURRENCY = 'pln'

/** PLN → grosze (smallest unit), rounded to the nearest grosz. */
export function toGrosze(pln: number): number {
  return Math.round(pln * 100)
}

/** Grosze → PLN, for display. */
export function fromGrosze(grosze: number): number {
  return Math.round(grosze) / 100
}

/** Splits a gross lesson price (in grosze) into the platform's commission and the teacher's net earnings, using PLATFORM_COMMISSION_PERCENT. Commission is rounded down in the platform's favor by a single grosz at most — teacherAmount + platformFee always sums back to grossAmount exactly. */
export function splitPayment(grossGrosze: number): { platformFeeGrosze: number; teacherAmountGrosze: number } {
  const platformFeeGrosze = Math.round((grossGrosze * PLATFORM_COMMISSION_PERCENT) / 100)
  return { platformFeeGrosze, teacherAmountGrosze: grossGrosze - platformFeeGrosze }
}
