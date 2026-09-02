'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { ClipboardCheck, Inbox, ShieldAlert, CheckCircle2 } from 'lucide-react'
import { useAuth } from '@/lib/auth-context'
import { getStudentLessons, getTeacherLessons, getParentLessons, lessonToReportCard } from '@/services/lessons.service'
import { getLinkedStudents } from '@/services/family-link.service'
import { Panel, AllClearBanner } from '@/components/dashboard/dashboard-primitives'
import { ReportRow } from '@/components/reports/report-row'
import { ReportDetailDialog } from '@/components/reports/report-detail-dialog'
import { isActionableBy } from '@/components/reports/report-status'
import { Spinner } from '@/components/ui/spinner'
import { EmptyState } from '@/components/ui/empty-state'
import { ShowMoreButton, COLLAPSED_ROWS } from '@/components/dashboard/collapsible-list-controls'
import type { Lesson, LessonReportCard } from '@/lib/types'

type Entry = {
  lesson: Lesson
  card: LessonReportCard
  sortKey: number
  /** Only set for a parent viewer with more than one linked student, so cards can be told apart. */
  studentLabel?: string
}

/**
 * Every report that concerns the signed-in user — student, teacher or
 * parent — in one place.
 *
 * Restructured from a flat grid of identical chat cards into three
 * groups ordered by what the reader has to do about them: what needs
 * their decision, what is stuck waiting on someone else, and what is
 * finished. The old layout gave a report awaiting confirmation exactly
 * the same size, colour and position as one settled weeks earlier, so
 * the page could not be triaged — and the fixed-width cards wasted most
 * of the row on a page this wide.
 *
 * Rows carry only what's needed to choose one; the whole report opens in
 * ReportDetailDialog. History collapses after a few rows so a long
 * archive can't bury the top of the page.
 *
 * Lessons, not chat messages, remain the source of truth — each card is
 * rebuilt from its Lesson doc via lessonToReportCard, so this still
 * works for a report whose chat delivery failed.
 */
export function ReportsClient() {
  const { user } = useAuth()
  const [entries, setEntries] = useState<Entry[] | null>(null)
  const [openCard, setOpenCard] = useState<LessonReportCard | null>(null)
  const [historyExpanded, setHistoryExpanded] = useState(false)

  const load = useCallback(async () => {
    if (!user) return
    let lessons: Lesson[] = []
    let labelByStudentId: Record<string, string> = {}

    if (user.role === 'teacher') {
      lessons = await getTeacherLessons(user.id, user.name)
    } else if (user.role === 'student') {
      lessons = await getStudentLessons(user.id)
    } else if (user.role === 'parent') {
      const linked = await getLinkedStudents(user.id)
      labelByStudentId = Object.fromEntries(linked.map((s) => [s.id, s.name]))
      const perStudent = await Promise.all(linked.map((s) => getStudentLessons(s.id)))
      // A parent may also have paid for a lesson belonging to a student
      // they are no longer linked to — those reports still concern them.
      const paid = await getParentLessons(user.id)
      const seen = new Map<string, Lesson>()
      for (const lesson of [...perStudent.flat(), ...paid]) seen.set(lesson.id, lesson)
      lessons = [...seen.values()]
    }

    const multipleChildren = Object.keys(labelByStudentId).length > 1
    const mapped = lessons
      .map((lesson): Entry | null => {
        const card = lessonToReportCard(lesson)
        if (!card) return null
        return {
          lesson,
          card,
          sortKey: lesson.reportSubmittedAt ?? lesson.completedAt ?? 0,
          studentLabel: multipleChildren ? labelByStudentId[lesson.studentId] : undefined,
        }
      })
      .filter((e): e is Entry => e !== null)
      .sort((a, b) => b.sortKey - a.sortKey)

    setEntries(mapped)
  }, [user])

  useEffect(() => {
    load()
  }, [load])

  const handleStatusChange = useCallback((lessonId: string, newStatus: LessonReportCard['status']) => {
    // Patch the one card in place instead of refetching — the grouping
    // below is derived on every render, so the row moves to the right
    // section by itself.
    setEntries((prev) =>
      prev?.map((e) => (e.card.lessonId === lessonId ? { ...e, card: { ...e.card, status: newStatus } } : e)) ?? prev,
    )
    setOpenCard((prev) => (prev && prev.lessonId === lessonId ? { ...prev, status: newStatus } : prev))
  }, [])

  const groups = useMemo(() => {
    if (!entries || !user) return null
    const actionable = entries.filter((e) => isActionableBy(e.card, user.id))
    const waiting = entries.filter(
      (e) => !actionable.includes(e) && (e.card.status === 'pending' || e.card.status === 'dispute_open'),
    )
    const settled = entries.filter((e) => !actionable.includes(e) && !waiting.includes(e))
    return { actionable, waiting, settled }
  }, [entries, user])

  if (!user || entries === null || groups === null) {
    return (
      <div className="flex min-h-[240px] items-center justify-center rounded-2xl border border-border bg-card">
        <Spinner size="lg" className="text-muted-foreground" />
      </div>
    )
  }

  if (entries.length === 0) {
    return (
      <div className="rounded-2xl border border-border bg-card">
        <EmptyState
          icon={Inbox}
          title="Brak raportów"
          description={
            user.role === 'teacher'
              ? 'Raporty, które wyślesz po zakończonych lekcjach, pojawią się tutaj.'
              : 'Raporty z lekcji pojawią się tutaj, gdy nauczyciel je wyśle.'
          }
          className="py-16"
        />
      </div>
    )
  }

  /** A student sees the teacher; a teacher sees the student. */
  function counterparty(entry: Entry) {
    return user!.role === 'teacher'
      ? { name: entry.card.studentName, color: entry.lesson.teacherColor }
      : { name: entry.card.teacherName, color: entry.lesson.teacherColor }
  }

  const visibleSettled = historyExpanded ? groups.settled : groups.settled.slice(0, COLLAPSED_ROWS)

  return (
    <div className="flex flex-col gap-5">
      {/* ── Needs a decision from this viewer ── */}
      {groups.actionable.length > 0 ? (
        <Panel
          icon={ClipboardCheck}
          title="Wymaga Twojej decyzji"
          tone="attention"
          count={groups.actionable.length}
        >
          <p className="border-b border-border px-5 py-2.5 text-xs leading-relaxed text-muted-foreground">
            Potwierdzenie raportu przekazuje płatność nauczycielowi. Jeśli nikt nie zareaguje, nastąpi to automatycznie
            po 24 godzinach od wysłania raportu.
          </p>
          <ul className="flex flex-col divide-y divide-border">
            {groups.actionable.map((entry) => {
              const other = counterparty(entry)
              return (
                <ReportRow
                  key={entry.card.lessonId}
                  card={entry.card}
                  counterpartyName={other.name}
                  counterpartyColor={other.color}
                  contextLabel={entry.studentLabel}
                  actionable
                  onOpen={() => setOpenCard(entry.card)}
                />
              )
            })}
          </ul>
        </Panel>
      ) : (
        <AllClearBanner
          message="Nic nie czeka na Twoją decyzję."
          hint="Wszystkie raporty są rozpatrzone."
        />
      )}

      {/* ── In flight, but with someone else ── */}
      {groups.waiting.length > 0 && (
        <Panel icon={ShieldAlert} title="W toku" count={groups.waiting.length}>
          <p className="border-b border-border px-5 py-2.5 text-xs text-muted-foreground">
            Te raporty czekają na decyzję drugiej strony lub na rozpatrzenie przez Runbee.
          </p>
          <ul className="flex flex-col divide-y divide-border">
            {groups.waiting.map((entry) => {
              const other = counterparty(entry)
              return (
                <ReportRow
                  key={entry.card.lessonId}
                  card={entry.card}
                  counterpartyName={other.name}
                  counterpartyColor={other.color}
                  contextLabel={entry.studentLabel}
                  actionable={false}
                  onOpen={() => setOpenCard(entry.card)}
                />
              )
            })}
          </ul>
        </Panel>
      )}

      {/* ── Closed ── */}
      {groups.settled.length > 0 && (
        <Panel icon={CheckCircle2} title="Zakończone" count={groups.settled.length}>
          <ul className="flex flex-col divide-y divide-border">
            {visibleSettled.map((entry) => {
              const other = counterparty(entry)
              return (
                <ReportRow
                  key={entry.card.lessonId}
                  card={entry.card}
                  counterpartyName={other.name}
                  counterpartyColor={other.color}
                  contextLabel={entry.studentLabel}
                  actionable={false}
                  onOpen={() => setOpenCard(entry.card)}
                />
              )
            })}
          </ul>
          <div className="px-5 py-3">
            <ShowMoreButton
              expanded={historyExpanded}
              hiddenCount={groups.settled.length - COLLAPSED_ROWS}
              onToggle={() => setHistoryExpanded((v) => !v)}
            />
          </div>
        </Panel>
      )}

      {openCard && (
        <ReportDetailDialog
          card={openCard}
          viewerId={user.id}
          viewerRole={user.role}
          onClose={() => setOpenCard(null)}
          onStatusChange={handleStatusChange}
        />
      )}
    </div>
  )
}

