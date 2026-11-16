'use client'

import Link from 'next/link'
import { AlertCircle, CalendarClock, ClipboardCheck, Loader2, MessageSquare, ShieldAlert, Star, Clock3 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Panel, AttentionRow, AllClearBanner } from '@/components/dashboard/dashboard-primitives'
import { formatLessonStudentTotal } from '@/lib/lesson-money'
import type { Lesson } from '@/lib/types'

interface Props {
  /** Lessons whose report this student is allowed to confirm/dispute and hasn't yet (see lib/report-permissions.ts). */
  awaitingReportConfirmation: Lesson[]
  /** Lessons with a dispute this student raised that an admin hasn't resolved yet. */
  openDisputes: Lesson[]
  /** One entry per teacher the student has completed a lesson with but not yet reviewed. */
  awaitingReview: Lesson[]
  /** Confirmed lessons where the student's cancel/reschedule request is still with the teacher. */
  awaitingTeacherOnChange: Lesson[]
  /** Cancel/reschedule proposals started by the teacher — the student must accept or reject. */
  teacherChangeProposals: Lesson[]
  actingOn: string | null
  actionError: string | null
  onProposalDecision: (lesson: Lesson, decision: 'accepted' | 'rejected') => void
  unreadMessages: number
  onReview: (lesson: Lesson) => void
}

/**
 * "Wymaga Twojej uwagi" — the single biggest gap in the previous
 * dashboard: a student's most consequential pending action (confirming a
 * lesson report, which releases the held payment to the teacher) lived
 * only on /reports and inside a chat thread, and was invisible here.
 * Unread messages were likewise only a small navbar icon.
 *
 * Every row is derived from lesson/conversation data that already
 * exists; nothing new is computed or faked. The panel hides itself
 * entirely when there is genuinely nothing to act on, so it never
 * becomes decorative chrome.
 */
export function StudentActionCenter({
  awaitingReportConfirmation,
  openDisputes,
  awaitingReview,
  awaitingTeacherOnChange,
  teacherChangeProposals,
  actingOn,
  actionError,
  onProposalDecision,
  unreadMessages,
  onReview,
}: Props) {
  const total =
    awaitingReportConfirmation.length +
    openDisputes.length +
    awaitingReview.length +
    awaitingTeacherOnChange.length +
    teacherChangeProposals.length +
    (unreadMessages > 0 ? 1 : 0)

  if (total === 0) {
    return <AllClearBanner message="Wszystko ogarnięte." hint="Nie masz żadnych zaległych spraw." />
  }

  return (
    <Panel icon={AlertCircle} title="Wymaga Twojej uwagi" tone="attention" count={total}>
      <ul className="flex flex-col divide-y divide-border">
        {/* Teacher-initiated change: time-sensitive, the lesson is on hold until the student answers. */}
        {teacherChangeProposals.map((lesson) => {
          const change = lesson.pendingChange
          const busy = actingOn === lesson.id
          const isCancel = change?.type === 'cancel'
          return (
            <AttentionRow
              key={`proposal-${lesson.id}`}
              icon={CalendarClock}
              tone="attention"
              title={isCancel ? `${lesson.teacherName} chce odwołać lekcję` : `${lesson.teacherName} proponuje nowy termin`}
              detail={
                isCancel
                  ? `${lesson.topic} · ${lesson.date} o ${lesson.time}${change?.note ? ` · Powód: ${change.note}` : ''}`
                  : `${lesson.date} o ${lesson.time} → ${change?.newDate ?? ''} o ${change?.newTime ?? ''}${change?.note ? ` · ${change.note}` : ''}`
              }
              action={
                <div className="flex items-center gap-2">
                  <Button size="sm" variant="outline" className="h-8 text-xs" disabled={busy} onClick={() => onProposalDecision(lesson, 'rejected')}>
                    {isCancel ? 'Nie zgadzam się' : 'Zostaw stary termin'}
                  </Button>
                  <Button size="sm" className="h-8 text-xs font-semibold" disabled={busy} onClick={() => onProposalDecision(lesson, 'accepted')}>
                    {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : isCancel ? 'Zgoda, zwróć pieniądze' : 'Akceptuję nowy termin'}
                  </Button>
                </div>
              }
            />
          )
        })}
        {actionError && (
          <li className="px-5 py-2 text-xs text-destructive" role="alert">{actionError}</li>
        )}

        {/* Highest stakes first: confirming a report moves real money. */}
        {awaitingReportConfirmation.map((lesson) => (
          <AttentionRow
            key={`report-${lesson.id}`}
            icon={ClipboardCheck}
            tone="attention"
            title="Potwierdź raport z lekcji"
            detail={`${lesson.teacherName} · ${lesson.topic} · ${formatLessonStudentTotal(lesson)}`}
            action={
              <Link href="/reports">
                <Button size="sm" className="h-8 text-xs font-semibold">Sprawdź raport</Button>
              </Link>
            }
          />
        ))}

        {openDisputes.map((lesson) => (
          <AttentionRow
            key={`dispute-${lesson.id}`}
            icon={ShieldAlert}
            tone="critical"
            title="Zgłoszony spór w trakcie rozpatrywania"
            detail={`${lesson.teacherName} · ${lesson.topic}`}
            action={
              <Link href="/reports">
                <Button size="sm" variant="outline" className="h-8 text-xs">Zobacz status</Button>
              </Link>
            }
          />
        ))}

        {awaitingReview.map((lesson) => (
          <AttentionRow
            key={`review-${lesson.id}`}
            icon={Star}
            tone="default"
            title={`Oceń nauczyciela — ${lesson.teacherName}`}
            detail="Twoja opinia pomoże innym uczniom wybrać nauczyciela"
            action={
              <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => onReview(lesson)}>
                Dodaj opinię
              </Button>
            }
          />
        ))}

        {awaitingTeacherOnChange.map((lesson) => (
          <AttentionRow
            key={`change-${lesson.id}`}
            icon={Clock3}
            tone="default"
            title={lesson.pendingChange?.type === 'cancel' ? 'Prośba o odwołanie czeka na nauczyciela' : 'Prośba o przełożenie czeka na nauczyciela'}
            detail={`${lesson.teacherName} · ${lesson.date} o ${lesson.time}`}
            action={<span className="shrink-0 text-xs text-muted-foreground">Czeka na odpowiedź</span>}
          />
        ))}

        {unreadMessages > 0 && (
          <AttentionRow
            icon={MessageSquare}
            tone="default"
            title={`${unreadMessages} ${unreadMessages === 1 ? 'nieprzeczytana wiadomość' : 'nieprzeczytanych wiadomości'}`}
            detail="Od Twoich nauczycieli"
            action={
              <Link href="/chat">
                <Button size="sm" variant="outline" className="h-8 text-xs">Otwórz czat</Button>
              </Link>
            }
          />
        )}
      </ul>
    </Panel>
  )
}
