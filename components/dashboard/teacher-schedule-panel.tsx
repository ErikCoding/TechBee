'use client'

import { CalendarClock, CalendarX2, Clock3 } from 'lucide-react'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { EmptyState } from '@/components/ui/empty-state'
import { Panel, PanelFooterLink } from '@/components/dashboard/dashboard-primitives'
import { LessonJoinButton } from '@/components/lesson/lesson-join-button'
import { LessonLiveStatus } from '@/components/lesson/lesson-live-status'
import type { Lesson } from '@/lib/types'

interface Props {
  /** Confirmed lessons after the one already shown in the next-lesson hero. */
  lessons: Lesson[]
}

/**
 * The rest of the confirmed schedule, after the next lesson has been
 * lifted out into its own panel above. Kept separate from the work queue
 * on purpose: these need no decision from the teacher, so mixing them
 * into the "Do zrobienia" tabs would have inflated the counts a teacher
 * uses to judge whether anything actually needs them.
 */
export function TeacherSchedulePanel({ lessons }: Props) {
  return (
    <Panel icon={CalendarClock} title="Dalszy grafik" count={lessons.length}>
      {lessons.length === 0 ? (
        <EmptyState
          icon={CalendarX2}
          title="Brak kolejnych lekcji"
          description="Potwierdzone rezerwacje pojawią się tutaj."
          className="py-10"
        />
      ) : (
        <ul className="flex flex-col divide-y divide-border">
          {lessons.map((lesson) => (
            <li
              key={lesson.id}
              className="flex flex-col gap-3 px-5 py-4 transition-colors hover:bg-muted/30 sm:flex-row sm:items-center sm:gap-4"
            >
              <div className="flex min-w-0 flex-1 items-center gap-3">
                <Avatar className="h-10 w-10 shrink-0">
                  <AvatarFallback color={lesson.teacherColor} className="text-[11px]">
                    {lesson.studentName.slice(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-foreground">{lesson.topic}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {lesson.studentName} · {lesson.date} o {lesson.time} · {lesson.duration} min
                  </p>
                  <LessonLiveStatus lesson={lesson} className="mt-1 max-w-full" />
                  {lesson.pendingChange && (
                    <p className="mt-0.5 flex items-center gap-1 text-[11px] font-medium text-warning">
                      <Clock3 className="h-3 w-3" aria-hidden="true" />
                      Prośba o zmianę czeka na Twoją decyzję
                    </p>
                  )}
                </div>
              </div>
              <div className="flex shrink-0 items-center justify-between gap-2 sm:justify-end">
                <span className="text-sm font-bold text-primary">{lesson.price} zł</span>
                <LessonJoinButton
                  lesson={lesson}
                  href={`/lesson/${lesson.id}/room?with=${encodeURIComponent(lesson.studentName)}&topic=${encodeURIComponent(lesson.topic)}`}
                  label="Rozpocznij"
                  size="sm"
                  variant="outline"
                />
              </div>
            </li>
          ))}
        </ul>
      )}
      <PanelFooterLink href="/dashboard/teacher/apply" icon={CalendarClock}>
        Ustaw dostępność i stawkę
      </PanelFooterLink>
    </Panel>
  )
}
