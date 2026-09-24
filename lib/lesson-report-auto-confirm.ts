export const REPORT_AUTO_CONFIRM_MS = 24 * 60 * 60 * 1000
export const AUTO_CONFIRM_BATCH_SIZE = 50

export type AutoConfirmLessonLike = {
  report?: unknown
  reportSubmittedAt?: number
  reportConfirmedAt?: number
  dispute?: { status?: string } | null
  paymentStatus?: string
  paymentReleased?: boolean
  stripeTransferId?: string
  teacherAmountGrosze?: number
}

export function isLessonReleaseEligible(
  lesson: AutoConfirmLessonLike,
  options: { allowResolvedTeacherDispute?: boolean } = {},
): boolean {
  if (!lesson.report || typeof lesson.reportSubmittedAt !== 'number') return false
  if (lesson.reportConfirmedAt) return false
  if (lesson.paymentStatus !== 'paid') return false
  if (lesson.paymentReleased === true || lesson.stripeTransferId) return false
  if (typeof lesson.teacherAmountGrosze !== 'number' || !Number.isFinite(lesson.teacherAmountGrosze) || lesson.teacherAmountGrosze <= 0) return false
  if (lesson.dispute) return options.allowResolvedTeacherDispute === true && lesson.dispute.status === 'resolved_teacher'
  return true
}

export function isReportAutoConfirmEligible(lesson: AutoConfirmLessonLike, now = Date.now()): boolean {
  if (!isLessonReleaseEligible(lesson)) return false
  if (now - lesson.reportSubmittedAt! < REPORT_AUTO_CONFIRM_MS) return false
  return true
}

export function selectAutoConfirmCronBatch<T extends AutoConfirmLessonLike>(lessons: T[], now = Date.now(), limit = AUTO_CONFIRM_BATCH_SIZE): T[] {
  const cutoff = now - REPORT_AUTO_CONFIRM_MS
  return lessons
    .filter((lesson) => lesson.paymentStatus === 'paid' && typeof lesson.reportSubmittedAt === 'number' && lesson.reportSubmittedAt <= cutoff)
    .sort((a, b) => (a.reportSubmittedAt! - b.reportSubmittedAt!))
    .slice(0, limit)
}

export function authorizeCronRequest(authHeader: string | null, cronSecret: string | undefined): { ok: true } | { ok: false; status: 401 | 503; error: string } {
  if (!cronSecret) return { ok: false, status: 503, error: 'CRON_SECRET is not configured.' }
  if (authHeader !== `Bearer ${cronSecret}`) return { ok: false, status: 401, error: 'Unauthorized cron request.' }
  return { ok: true }
}
