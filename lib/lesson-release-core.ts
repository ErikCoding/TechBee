/** Legacy key (v1). Kept for reference/tests; new transfers use lessonTeacherTransferAttemptIdempotencyKey. */
export function lessonTeacherTransferIdempotencyKey(lessonId: string): string {
  return `lesson:${lessonId}:teacher-release:v1`
}

/**
 * v2 key: stable per (lesson, attempt). Concurrent/duplicate calls for the same attempt still
 * share one key (no double pay), but after a `balance_insufficient` failure the attempt counter is
 * bumped so Stripe does not replay the cached error for 24h (and so changed params such as
 * `source_transaction` are not rejected as a mismatch against the old v1 key).
 */
export function lessonTeacherTransferAttemptIdempotencyKey(lessonId: string, attempt = 0): string {
  const n = Number.isInteger(attempt) && attempt > 0 ? attempt : 0
  return `lesson:${lessonId}:teacher-release:v2:a${n}`
}
