'use client'

import { useState } from 'react'
import Link from 'next/link'
import {
  CalendarDays, CheckCircle2, XCircle, Circle, Clock3, RefreshCw, Star, Search, Video,
  ClipboardList,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { EmptyState } from '@/components/ui/empty-state'
import { ShowMoreButton, COLLAPSED_ROWS } from '@/components/dashboard/collapsible-list-controls'
import { SegmentedTabs, PanelFooterLink } from '@/components/dashboard/dashboard-primitives'
import { cn } from '@/lib/utils'
import type { Lesson } from '@/lib/types'

type TabKey = 'upcoming' | 'pending' | 'history'

const historyStatusConfig = {
  pending: { label: 'Oczekuje na nauczyciela', icon: Clock3, className: 'text-warning-on-surface bg-warning-surface' },
  upcoming: { label: 'Nadchodząca', icon: Circle, className: 'text-info-on-surface bg-info-surface' },
  completed: { label: 'Ukończona', icon: CheckCircle2, className: 'text-success-on-surface bg-success-surface' },
  cancelled: { label: 'Anulowana', icon: XCircle, className: 'text-muted-foreground bg-muted' },
}

interface Props {
  upcoming: Lesson[]
  pending: Lesson[]
  past: Lesson[]
  onManage: (lesson: Lesson) => void
  onReview: (lesson: Lesson) => void
  /** Teachers this student already holds their single review for — switches the row action from "Oceń" to "Edytuj opinię". */
  reviewedTeacherIds: Set<string>
}

/**
 * One panel with a segmented control, replacing the three separately
 * bordered, always-expanded sections ("Oczekujące potwierdzenia",
 * "Nadchodzące lekcje", "Historia lekcji") the dashboard used to stack
 * on top of each other. That old shape cost roughly two extra screens of
 * scrolling on a phone before any sidebar content became reachable, and
 * gave a 12-lesson history the same visual weight as a lesson starting
 * today.
 *
 * The next lesson is intentionally *not* repeated here — it has its own
 * panel above (StudentNextLesson); this list starts from the one after
 * it, so the same lesson never appears twice on the page.
 */
export function StudentLessonsPanel({ upcoming, pending, past, onManage, onReview, reviewedTeacherIds }: Props) {
  const [tab, setTab] = useState<TabKey>('upcoming')
  const [historyExpanded, setHistoryExpanded] = useState(false)

  const tabs: { key: TabKey; label: string; count: number }[] = [
    { key: 'upcoming', label: 'Nadchodzące', count: upcoming.length },
    { key: 'pending', label: 'Oczekujące', count: pending.length },
    { key: 'history', label: 'Historia', count: past.length },
  ]

  const visiblePast = historyExpanded ? past : past.slice(0, COLLAPSED_ROWS)

  return (
    <section className="overflow-hidden rounded-2xl border border-border">
      <div className="flex flex-col gap-3 bg-muted/40 px-5 py-3.5 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-sm font-semibold text-foreground">Moje lekcje</h2>
        <SegmentedTabs tabs={tabs} value={tab} onChange={setTab} label="Filtruj lekcje" />
      </div>

      <div className="bg-card">
        {tab === 'upcoming' && (
          upcoming.length === 0 ? (
            <EmptyState
              icon={CalendarDays}
              title="Brak kolejnych lekcji"
              description="Gdy zarezerwujesz więcej terminów, pojawią się tutaj."
              className="py-10"
              action={
                <Link href="/marketplace">
                  <Button size="sm" variant="outline">
                    <Search className="h-3.5 w-3.5" aria-hidden="true" />
                    Przeglądaj nauczycieli
                  </Button>
                </Link>
              }
            />
          ) : (
            <ul className="flex flex-col divide-y divide-border">
              {upcoming.map((lesson) => (
                <li
                  key={lesson.id}
                  className="flex flex-col gap-3 px-5 py-4 transition-colors hover:bg-muted/30 sm:flex-row sm:items-center sm:gap-4"
                >
                  <div className="flex min-w-0 flex-1 items-center gap-3">
                    <Avatar className="h-10 w-10 shrink-0">
                      <AvatarFallback color={lesson.teacherColor} className="text-sm">
                        {lesson.teacherInitials}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-foreground">{lesson.topic}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {lesson.teacherName} · {lesson.date} o {lesson.time} · {lesson.duration} min
                      </p>
                      {lesson.pendingChange && (
                        <p className="mt-0.5 flex items-center gap-1 text-[11px] font-medium text-warning">
                          <Clock3 className="h-3 w-3" aria-hidden="true" />
                          {lesson.pendingChange.type === 'cancel' ? 'Prośba o odwołanie' : 'Prośba o przełożenie'} czeka na nauczyciela
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center justify-between gap-2 sm:justify-end">
                    <span className="text-xs font-semibold text-foreground">{lesson.price} zł</span>
                    {!lesson.pendingChange && (
                      <Button size="sm" variant="ghost" className="h-8 text-xs" onClick={() => onManage(lesson)}>
                        <RefreshCw className="h-3 w-3" aria-hidden="true" />
                        Zarządzaj
                      </Button>
                    )}
                    <Link href={`/lesson/${lesson.id}/room?with=${encodeURIComponent(lesson.teacherName)}&topic=${encodeURIComponent(lesson.topic)}`}>
                      <Button size="sm" variant="outline" className="h-8 text-xs font-semibold">
                        <Video className="h-3 w-3" aria-hidden="true" />
                        Dołącz
                      </Button>
                    </Link>
                  </div>
                </li>
              ))}
            </ul>
          )
        )}

        {tab === 'pending' && (
          pending.length === 0 ? (
            <EmptyState
              icon={Clock3}
              title="Brak oczekujących rezerwacji"
              description="Wszystkie Twoje rezerwacje zostały już rozpatrzone."
              className="py-10"
            />
          ) : (
            <ul className="flex flex-col divide-y divide-border">
              {pending.map((lesson) => (
                <li key={lesson.id} className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:gap-4">
                  <div className="flex min-w-0 flex-1 items-center gap-3">
                    <Avatar className="h-10 w-10 shrink-0">
                      <AvatarFallback color={lesson.teacherColor} className="text-sm">
                        {lesson.teacherInitials}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-foreground">{lesson.topic}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {lesson.teacherName} · {lesson.date} o {lesson.time}
                      </p>
                    </div>
                  </div>
                  <span className="flex shrink-0 items-center gap-1.5 self-start rounded-full bg-warning-surface px-2.5 py-1 text-[11px] font-medium text-warning-on-surface sm:self-auto">
                    <Clock3 className="h-3 w-3" aria-hidden="true" />
                    Czeka na potwierdzenie
                  </span>
                </li>
              ))}
            </ul>
          )
        )}

        {tab === 'history' && (
          past.length === 0 ? (
            <EmptyState
              icon={CheckCircle2}
              title="Brak ukończonych lekcji"
              description="Tutaj zbierze się historia Twojej nauki."
              className="py-10"
            />
          ) : (
            <>
              <ul className="flex flex-col divide-y divide-border">
                {visiblePast.map((lesson) => {
                  const status = historyStatusConfig[lesson.status]
                  const StatusIcon = status.icon
                  return (
                    <li
                      key={lesson.id}
                      className="flex flex-col gap-3 px-5 py-4 transition-colors hover:bg-muted/30 sm:flex-row sm:items-center sm:gap-4"
                    >
                      <div className="flex min-w-0 flex-1 items-center gap-3">
                        <Avatar className="h-10 w-10 shrink-0">
                          <AvatarFallback color={lesson.teacherColor} className="text-sm">
                            {lesson.teacherInitials}
                          </AvatarFallback>
                        </Avatar>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold text-foreground">{lesson.topic}</p>
                          <p className="truncate text-xs text-muted-foreground">
                            {lesson.teacherName} · {lesson.date}
                          </p>
                        </div>
                      </div>
                      <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 sm:justify-end">
                        <span className={cn('flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium', status.className)}>
                          <StatusIcon className="h-3 w-3" aria-hidden="true" />
                          {status.label}
                        </span>
                        <span className="text-xs text-muted-foreground">{lesson.price} zł</span>
                        {/*
                          One review per teacher, so a lesson with an
                          already-reviewed teacher offers an edit rather
                          than asking for another opinion.
                        */}
                        {lesson.status === 'completed' && (
                          <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => onReview(lesson)}>
                            <Star className="h-3 w-3" aria-hidden="true" />
                            {reviewedTeacherIds.has(lesson.teacherId) ? 'Twoja opinia' : 'Oceń'}
                          </Button>
                        )}
                      </div>
                    </li>
                  )
                })}
              </ul>
              <div className="px-5 py-3">
                <ShowMoreButton
                  expanded={historyExpanded}
                  hiddenCount={past.length - COLLAPSED_ROWS}
                  onToggle={() => setHistoryExpanded((v) => !v)}
                />
              </div>
            </>
          )
        )}

        {/*
          Permanent route to /reports. The old dashboard exposed it through a
          generic "Szybkie linki" list; here it sits against the lesson list it
          actually describes, so it stays discoverable even when no report is
          currently awaiting the student (in which case StudentActionCenter
          shows nothing).
        */}
        <PanelFooterLink href="/reports" icon={ClipboardList}>
          Raporty z lekcji
        </PanelFooterLink>
      </div>
    </section>
  )
}
