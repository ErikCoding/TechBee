export const LESSON_DURATION_OPTIONS = [
  { minutes: 30, label: '30 min' },
  { minutes: 60, label: '60 min' },
  { minutes: 120, label: '120 min' },
] as const

export const DEFAULT_LESSON_DURATIONS = [60]

const ALLOWED_LESSON_DURATIONS: ReadonlySet<number> = new Set(LESSON_DURATION_OPTIONS.map((option) => option.minutes))

export function normalizeLessonDurations(value?: number[]): number[] {
  const normalized = [...new Set((value ?? DEFAULT_LESSON_DURATIONS).filter((duration) => ALLOWED_LESSON_DURATIONS.has(duration)))]
  const ordered = LESSON_DURATION_OPTIONS
    .map((option) => option.minutes)
    .filter((duration) => normalized.includes(duration))

  return ordered.length ? ordered : DEFAULT_LESSON_DURATIONS
}

export function formatLessonDurations(value?: number[]): string {
  return normalizeLessonDurations(value).map((duration) => `${duration} min`).join(', ')
}
