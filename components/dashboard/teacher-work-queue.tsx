'use client'

import { useEffect, useMemo, useState } from 'react'
import { Loader2, ClipboardList, Inbox, RefreshCw, CheckCircle2, ListChecks } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/empty-state'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { SegmentedTabs } from '@/components/dashboard/dashboard-primitives'
import { ShowMoreButton, COLLAPSED_ROWS } from '@/components/dashboard/collapsible-list-controls'
import type { Lesson } from '@/lib/types'

type QueueKey = 'requests' | 'changes' | 'reports'

interface Props {
  bookingRequests: Lesson[]
  changeRequests: Lesson[]
  needsReport: Lesson[]
  actingOn: string | null
  onBookingDecision: (lesson: Lesson, decision: 'accepted' | 'rejected') => void
  onChangeDecision: (lesson: Lesson, decision: 'accepted' | 'rejected') => void
  onWriteReport: (lesson: Lesson) => void
}

/**
 * The teacher's inbox: everything waiting on a decision from them, in
 * one panel with counted tabs.
 *
 * This replaces three separately bordered, always-expanded sections
 * ("Zapytania o lekcje", "Prośby o zmianę", "Lekcje do zaraportowania")
 * plus a summary banner above them that restated the same three counts
 * in a sentence. Four blocks describing one queue meant a teacher with a
 * single pending request still scrolled past three headers to find it,
 * and the counts existed in two places at once. The tab badges now *are*
 * the summary.
 *
 * The panel opens on whichever bucket actually has work, so the first
 * thing a teacher sees is something they can act on rather than an empty
 * "Zapytania" list. Reports win that tie: an unfiled report is what
 * blocks the teacher's own payout.
 */
export function TeacherWorkQueue({
  bookingRequests,
  changeRequests,
  needsReport,
  actingOn,
  onBookingDecision,
  onChangeDecision,
  onWriteReport,
}: Props) {
  const firstWithWork: QueueKey = needsReport.length > 0
    ? 'reports'
    : bookingRequests.length > 0
      ? 'requests'
      : changeRequests.length > 0
        ? 'changes'
        : 'requests'

  const [tab, setTab] = useState<QueueKey>(firstWithWork)
  const [touched, setTouched] = useState(false)
  const [reportsExpanded, setReportsExpanded] = useState(false)

  // Follow the work until the teacher expresses a preference by tapping a
  // tab — after that, stay where they put it even as counts change.
  useEffect(() => {
    if (!touched) setTab(firstWithWork)
  }, [firstWithWork, touched])

  function selectTab(key: QueueKey) {
    setTouched(true)
    setTab(key)
  }

  const tabs = useMemo(
    () => [
      { key: 'reports' as const, label: 'Do zaraportowania', count: needsReport.length },
      { key: 'requests' as const, label: 'Zapytania', count: bookingRequests.length },
      { key: 'changes' as const, label: 'Zmiany terminu', count: changeRequests.length },
    ],
    [needsReport.length, bookingRequests.length, changeRequests.length],
  )

  const total = bookingRequests.length + changeRequests.length + needsReport.length
  const visibleReports = reportsExpanded ? needsReport : needsReport.slice(0, COLLAPSED_ROWS)

  return (
    <section className={`overflow-hidden rounded-2xl border ${total > 0 ? 'border-warning/40' : 'border-border'}`}>
      <div
        className={`flex flex-col gap-3 px-5 py-3.5 sm:flex-row sm:items-center sm:justify-between ${
          total > 0 ? 'bg-warning-surface' : 'bg-muted/40'
        }`}
      >
        <div className="flex items-center gap-2">
          <ListChecks
            className={`h-4 w-4 shrink-0 ${total > 0 ? 'text-warning' : 'text-muted-foreground'}`}
            aria-hidden="true"
          />
          <h2 className="text-sm font-semibold text-foreground">Do zrobienia</h2>
        </div>
        <SegmentedTabs tabs={tabs} value={tab} onChange={selectTab} label="Filtruj zadania" />
      </div>

      <div className="bg-card">
        {/* ── Reports due — first, because an unfiled report holds the teacher's own payment ── */}
        {tab === 'reports' && (
          needsReport.length === 0 ? (
            <EmptyState
              icon={CheckCircle2}
              title="Wszystkie raporty złożone"
              description="Po każdej zakończonej lekcji pojawi się tu prośba o raport."
              className="py-10"
            />
          ) : (
            <>
              <p className="border-b border-border px-5 py-2.5 text-xs text-muted-foreground">
                Uzupełnij raport, aby zwolnić płatność za te lekcje.
              </p>
              <ul className="flex flex-col divide-y divide-border">
                {visibleReports.map((lesson) => (
                  <li key={lesson.id} className="flex flex-col gap-3 px-5 py-4 transition-colors hover:bg-muted/30 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex min-w-0 flex-1 items-center gap-3">
                      <Avatar className="h-9 w-9 shrink-0">
                        <AvatarFallback color={lesson.teacherColor} className="text-[11px]">
                          {lesson.studentName.slice(0, 2).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-foreground">{lesson.topic}</p>
                        <p className="truncate text-xs text-muted-foreground">
                          {lesson.studentName} · {lesson.date} · {lesson.price} zł
                        </p>
                      </div>
                    </div>
                    <Button size="sm" className="h-8 shrink-0 text-xs font-semibold" onClick={() => onWriteReport(lesson)}>
                      <ClipboardList className="h-3 w-3" aria-hidden="true" />
                      Dodaj raport
                    </Button>
                  </li>
                ))}
              </ul>
              <div className="px-5 py-3">
                <ShowMoreButton
                  expanded={reportsExpanded}
                  hiddenCount={needsReport.length - COLLAPSED_ROWS}
                  onToggle={() => setReportsExpanded((v) => !v)}
                />
              </div>
            </>
          )
        )}

        {/* ── New booking requests ── */}
        {tab === 'requests' && (
          bookingRequests.length === 0 ? (
            <EmptyState
              icon={Inbox}
              title="Brak nowych zapytań"
              description="Nowe rezerwacje od uczniów pojawią się tutaj do akceptacji."
              className="py-10"
            />
          ) : (
            <ul className="flex flex-col divide-y divide-border">
              {bookingRequests.map((req) => (
                <li key={req.id} className="flex flex-col gap-3 px-5 py-4 transition-colors hover:bg-muted/30 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex min-w-0 flex-1 items-center gap-3">
                    <Avatar className="h-9 w-9 shrink-0">
                      <AvatarFallback color={req.teacherColor} className="text-[11px]">
                        {req.studentName.slice(0, 2).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-foreground">{req.topic}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {req.studentName} · {req.date} o {req.time} · {req.price} zł
                      </p>
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-2 sm:ml-4">
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-8 flex-1 text-xs sm:flex-none"
                      disabled={actingOn === req.id}
                      onClick={() => onBookingDecision(req, 'rejected')}
                    >
                      Odrzuć
                    </Button>
                    <Button
                      size="sm"
                      className="h-8 flex-1 text-xs font-semibold sm:flex-none"
                      disabled={actingOn === req.id}
                      onClick={() => onBookingDecision(req, 'accepted')}
                    >
                      {actingOn === req.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Akceptuj'}
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )
        )}

        {/* ── Cancel / reschedule requests ── */}
        {tab === 'changes' && (
          changeRequests.length === 0 ? (
            <EmptyState
              icon={RefreshCw}
              title="Brak próśb o zmianę"
              description="Prośby uczniów o odwołanie lub przełożenie lekcji trafią tutaj."
              className="py-10"
            />
          ) : (
            <ul className="flex flex-col divide-y divide-border">
              {changeRequests.map((lesson) => (
                <li key={lesson.id} className="flex flex-col gap-3 px-5 py-4 transition-colors hover:bg-muted/30 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-foreground">{lesson.topic}</p>
                    <p className="text-xs text-muted-foreground">
                      {lesson.studentName} prosi o{' '}
                      {lesson.pendingChange?.type === 'cancel' ? 'odwołanie' : 'przełożenie'} lekcji {lesson.date} o {lesson.time}
                      {lesson.pendingChange?.type === 'reschedule' && lesson.pendingChange.newDate
                        ? ` → ${lesson.pendingChange.newDate} o ${lesson.pendingChange.newTime}`
                        : ''}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2 sm:ml-4">
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-8 flex-1 text-xs sm:flex-none"
                      disabled={actingOn === lesson.id}
                      onClick={() => onChangeDecision(lesson, 'rejected')}
                    >
                      Odrzuć
                    </Button>
                    <Button
                      size="sm"
                      className="h-8 flex-1 text-xs font-semibold sm:flex-none"
                      disabled={actingOn === lesson.id}
                      onClick={() => onChangeDecision(lesson, 'accepted')}
                    >
                      {actingOn === lesson.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Akceptuj'}
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )
        )}
      </div>
    </section>
  )
}
