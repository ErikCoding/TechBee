import type { Lesson } from './types'

// ─────────────────────────────────────────────────────────────
// Single source of truth for "who can confirm/dispute this lesson's
// report" — used client-side (components/chat/report-card-message.tsx,
// components/dashboard/reports-client.tsx) AND server-side
// (app/api/stripe/lessons/[lessonId]/transfer + refund) so the two
// can never drift apart. Framework-agnostic on purpose (no Firebase
// import) so a Next.js API route can import it directly instead of
// duplicating the rule or pulling in the client Firestore SDK.
//
// The rule:
//   - No linked parent at report time → the student manages it alone.
//   - A linked parent, and they haven't enabled "Pozwól uczniowi
//     samodzielnie akceptować i odrzucać raporty" → only the parent
//     manages it (existing behavior, unchanged default).
//   - A linked parent, with that setting enabled → both the parent and
//     the student can act.
//
// `studentCanManageReport` is a snapshot frozen onto the Lesson at
// report-submission time (see submitLessonReport in
// services/lessons.service.ts), the same way `confirmingPartyId` itself
// is frozen — so a parent flipping the setting later doesn't
// retroactively change who could act on a report already in flight,
// and every lesson from before this setting existed simply has it
// `undefined`, which this treats as `false` (only the parent manages
// it) — the explicit backward-compatibility rule.
// ─────────────────────────────────────────────────────────────

/** Pure version of the rule above, for callers building a `LessonReportCard` before the `Lesson` doc itself has been written yet (see submitLessonReport). */
export function computeReportManagerIds(params: {
  studentId: string
  confirmingPartyId: string
  confirmingPartyRole: 'student' | 'parent'
  studentCanManageReport?: boolean
}): string[] {
  if (params.confirmingPartyRole === 'parent' && params.studentCanManageReport && params.studentId !== params.confirmingPartyId) {
    return [params.confirmingPartyId, params.studentId]
  }
  return [params.confirmingPartyId]
}

/** Every user id allowed to confirm/dispute this lesson's report. */
export function getReportManagerIds(lesson: Lesson): string[] {
  return computeReportManagerIds({
    studentId: lesson.studentId,
    confirmingPartyId: lesson.confirmingPartyId ?? lesson.studentId,
    confirmingPartyRole: lesson.confirmingPartyRole ?? 'student',
    studentCanManageReport: lesson.studentCanManageReport,
  })
}

/** Whether this specific user may confirm/dispute this lesson's report. */
export function canManageLessonReport(lesson: Lesson, viewerId: string): boolean {
  return getReportManagerIds(lesson).includes(viewerId)
}
