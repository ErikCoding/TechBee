import type { StatusTone } from '@/components/ui/status-badge'
import type { LessonReportCard } from '@/lib/types'

/**
 * One vocabulary for report status, shared by the chat card, the
 * /reports page, the parent dashboard and the detail dialog.
 *
 * Labels used to be redefined per component, so the same report could
 * read "Oczekuje na potwierdzenie" in one place and "Potwierdzony —
 * płatność zwolniona" in another with no shared source of truth. The
 * short labels below are for compact rows and pills; `describeWaitingParty`
 * supplies the sentence that answers the question every one of these
 * surfaces previously left unanswered: who is this waiting on, and what
 * happens next.
 */

export const REPORT_STATUS_CONFIG: Record<
  LessonReportCard['status'],
  { label: string; shortLabel: string; tone: StatusTone }
> = {
  pending: { label: 'Oczekuje na potwierdzenie', shortLabel: 'Do potwierdzenia', tone: 'warning' },
  confirmed: { label: 'Potwierdzony — płatność zwolniona', shortLabel: 'Potwierdzony', tone: 'success' },
  dispute_open: { label: 'Zastrzeżenie w rozpatrywaniu', shortLabel: 'Zastrzeżenie', tone: 'error' },
  dispute_resolved_teacher: { label: 'Rozstrzygnięty — płatność zwolniona', shortLabel: 'Rozstrzygnięty', tone: 'success' },
  dispute_resolved_payer: { label: 'Rozstrzygnięty — środki zwrócone', shortLabel: 'Zwrócony', tone: 'info' },
}

/**
 * A plain-language sentence describing the current hand-off, written from
 * the reader's own point of view.
 *
 * `viewerRole` only changes the wording, never the permission: whether
 * someone may actually act is decided solely by `card.managerIds`, which
 * comes from lib/report-permissions.ts.
 */
export function describeWaitingParty(
  status: LessonReportCard['status'],
  card: LessonReportCard,
  viewerId: string,
  viewerRole?: 'student' | 'teacher' | 'parent' | 'admin',
): string | null {
  const viewerCanAct = canManageReportCard(card, viewerId)

  if (status === 'pending') {
    if (viewerCanAct) {
      return 'Czeka na Twoją decyzję. Jeśli nikt nie zareaguje, płatność zostanie zwolniona automatycznie po 24 godzinach od wysłania raportu.'
    }
    if (viewerRole === 'student') {
      return 'Raportami z Twoich lekcji zarządza Twój rodzic — to on potwierdza je w Twoim imieniu. Bez reakcji płatność zostanie zwolniona automatycznie po 24 godzinach.'
    }
    if (viewerRole === 'teacher') {
      return `Czeka na potwierdzenie po stronie ucznia lub rodzica. Jeśli nikt nie zareaguje, płatność trafi do Ciebie automatycznie po 24 godzinach.`
    }
    return 'Czeka na potwierdzenie osoby odpowiedzialnej za raporty tego ucznia.'
  }

  if (status === 'confirmed') {
    return viewerRole === 'teacher'
      ? 'Raport potwierdzony — płatność została przekazana na Twoje konto.'
      : 'Raport potwierdzony — płatność została przekazana nauczycielowi. Nic więcej nie musisz robić.'
  }

  if (status === 'dispute_open') {
    return 'Zastrzeżenie zostało zgłoszone. Płatność jest wstrzymana do czasu rozpatrzenia sprawy przez administratora Runbee.'
  }

  if (status === 'dispute_resolved_teacher') {
    return 'Administrator rozstrzygnął sprawę na korzyść nauczyciela — płatność została zwolniona.'
  }

  if (status === 'dispute_resolved_payer') {
    return 'Administrator rozstrzygnął sprawę na korzyść ucznia/rodzica — środki zostały zwrócone.'
  }

  return null
}

/**
 * Whether this viewer may act on the card.
 *
 * Tolerates a missing `managerIds`, which report cards written to chat
 * before the parent-account model existed genuinely lack. Those cards
 * are normally repaired on read (see normalizeMessage in
 * services/chat.service.ts), but cards also reach the UI straight from
 * `lessonToReportCard` and from callers holding older state, so the
 * predicate itself must not assume the field is there — reading it
 * unguarded is what crashed the chat thread on legacy reports.
 *
 * Falling back to `confirmingPartyId` matches what
 * computeReportManagerIds returns when no parent is linked, which is the
 * only situation those older cards were created in.
 */
export function canManageReportCard(card: LessonReportCard, viewerId: string): boolean {
  const managers = card.managerIds ?? (card.confirmingPartyId ? [card.confirmingPartyId] : [])
  return managers.includes(viewerId)
}

/** Reports still awaiting a decision from this specific viewer. */
export function isActionableBy(card: LessonReportCard, viewerId: string): boolean {
  return card.status === 'pending' && canManageReportCard(card, viewerId)
}
