export type TrialLessonKind = 'regular' | 'trial'

type TrialTeacherConfigInput = {
  trialLessonEnabled?: boolean
  trialLessonDuration?: number
  trialLessonPriceGrosze?: number
}

type TrialLessonEligibilityInput = {
  lessonKind?: TrialLessonKind
  paymentStatus?: 'paid' | 'refunded' | 'failed'
  status?: 'pending' | 'upcoming' | 'completed' | 'cancelled'
  stripeRefundId?: string
}

export type TeacherTrialLessonConfig =
  | { enabled: false }
  | { enabled: true; duration: number; priceGrosze: number }

export type CheckoutLessonTerms =
  | { ok: true; lessonKind: TrialLessonKind; duration: number; priceGrosze: number }
  | { ok: false; error: 'trial_disabled' | 'invalid_trial_duration' }

export function normalizeLessonKind(value: unknown): TrialLessonKind {
  return value === 'trial' ? 'trial' : 'regular'
}

export function checkoutAutoRefundIdempotencyKey(checkoutSessionId: string): string {
  return `auto-refund-checkout:${checkoutSessionId}`
}

export function normalizeTrialLessonDurationWithOptions(value: unknown, allowedDurations: readonly number[]): number | undefined {
  return typeof value === 'number' && Number.isInteger(value) && allowedDurations.includes(value)
    ? value
    : undefined
}

export function normalizeTrialLessonPriceGrosze(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isInteger(value) && value > 0
    ? value
    : undefined
}

export function resolveTeacherTrialLessonConfigWithOptions(
  teacher: TrialTeacherConfigInput | null | undefined,
  allowedDurations: readonly number[],
): TeacherTrialLessonConfig {
  if (teacher?.trialLessonEnabled !== true) return { enabled: false }
  const duration = normalizeTrialLessonDurationWithOptions(teacher.trialLessonDuration, allowedDurations)
  const priceGrosze = normalizeTrialLessonPriceGrosze(teacher.trialLessonPriceGrosze)
  if (!duration || !priceGrosze) return { enabled: false }
  return { enabled: true, duration, priceGrosze }
}

export function resolveCheckoutLessonTermsWithOptions({
  lessonKind,
  requestedDuration,
  regularPriceGrosze,
  teacher,
  allowedDurations,
}: {
  lessonKind?: unknown
  requestedDuration: number
  regularPriceGrosze: number
  teacher?: TrialTeacherConfigInput | null
  allowedDurations: readonly number[]
}): CheckoutLessonTerms {
  const normalizedKind = normalizeLessonKind(lessonKind)
  if (normalizedKind === 'regular') {
    return { ok: true, lessonKind: 'regular', duration: requestedDuration, priceGrosze: regularPriceGrosze }
  }

  const config = resolveTeacherTrialLessonConfigWithOptions(teacher, allowedDurations)
  if (!config.enabled) return { ok: false, error: 'trial_disabled' }
  if (requestedDuration !== config.duration) return { ok: false, error: 'invalid_trial_duration' }
  return { ok: true, lessonKind: 'trial', duration: config.duration, priceGrosze: config.priceGrosze }
}

export function trialLessonConsumesEligibility(lesson: TrialLessonEligibilityInput): boolean {
  if (normalizeLessonKind(lesson.lessonKind) !== 'trial') return false
  if (lesson.paymentStatus === 'refunded') return false
  if (lesson.status === 'cancelled' && lesson.stripeRefundId) return false
  return lesson.paymentStatus === 'paid'
}

export function studentHasConsumedTrialLesson(lessons: TrialLessonEligibilityInput[]): boolean {
  return lessons.some(trialLessonConsumesEligibility)
}
