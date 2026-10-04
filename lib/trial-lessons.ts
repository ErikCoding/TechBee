import { LESSON_DURATION_OPTIONS } from './lesson-durations'
import {
  normalizeLessonKind,
  checkoutAutoRefundIdempotencyKey,
  normalizeTrialLessonDurationWithOptions,
  normalizeTrialLessonPriceGrosze,
  resolveCheckoutLessonTermsWithOptions,
  resolveTeacherTrialLessonConfigWithOptions,
  studentHasConsumedTrialLesson,
  trialLessonConsumesEligibility,
  type CheckoutLessonTerms,
  type TeacherTrialLessonConfig,
} from './trial-lessons-core'
import type { Lesson, Teacher } from './types'

const allowedDurations = LESSON_DURATION_OPTIONS.map((option) => option.minutes)

export { checkoutAutoRefundIdempotencyKey, normalizeLessonKind, normalizeTrialLessonPriceGrosze, studentHasConsumedTrialLesson, trialLessonConsumesEligibility }
export type { CheckoutLessonTerms, TeacherTrialLessonConfig }

export function normalizeTrialLessonDuration(value: unknown): number | undefined {
  return normalizeTrialLessonDurationWithOptions(value, allowedDurations)
}

export function resolveTeacherTrialLessonConfig(
  teacher?: Pick<Teacher, 'trialLessonEnabled' | 'trialLessonDuration' | 'trialLessonPriceGrosze'> | null,
): TeacherTrialLessonConfig {
  return resolveTeacherTrialLessonConfigWithOptions(teacher, allowedDurations)
}

export function resolveCheckoutLessonTerms({
  lessonKind,
  requestedDuration,
  regularPriceGrosze,
  teacher,
}: {
  lessonKind?: unknown
  requestedDuration: number
  regularPriceGrosze: number
  teacher?: Pick<Teacher, 'trialLessonEnabled' | 'trialLessonDuration' | 'trialLessonPriceGrosze'> | null
}): CheckoutLessonTerms {
  return resolveCheckoutLessonTermsWithOptions({
    lessonKind,
    requestedDuration,
    regularPriceGrosze,
    teacher,
    allowedDurations,
  })
}
