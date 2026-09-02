'use client'

import Link from 'next/link'
import { CalendarDays, Clock, Timer, Video, Wallet, CalendarX2, Clock3, MessageSquare } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { MetaStrip } from '@/components/dashboard/dashboard-primitives'
import type { Lesson } from '@/lib/types'

interface Props {
  lesson: Lesson | null
  /** Booking requests still awaiting the teacher's answer — the useful next step when nothing is confirmed. */
  requestCount: number
}

/**
 * The teacher's equivalent of the student's next-lesson panel, but built
 * around a different question. A student asks "how do I join?"; a
 * teacher asks "who am I teaching next, and what did they ask for?" — so
 * the student's name and the requested topic lead, and messaging that
 * student sits right next to the join action, because "let me message
 * them before we start" is a real teacher behaviour that previously
 * meant leaving for /chat and finding the thread by hand.
 *
 * `date`/`time` are rendered exactly as stored (display-only strings on
 * the Lesson doc, no real scheduled timestamp exists), so nothing here
 * invents a countdown.
 */
export function TeacherNextLesson({ lesson, requestCount }: Props) {
  if (!lesson) {
    return (
      <section className="rounded-2xl border border-dashed border-border bg-card px-5 py-8 text-center sm:px-8 sm:py-10">
        <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-muted">
          <CalendarX2 className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
        </div>
        <h2 className="mt-3 text-base font-bold text-foreground">Brak zaplanowanych lekcji</h2>
        <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">
          {requestCount > 0
            ? `Masz ${requestCount} ${requestCount === 1 ? 'zapytanie' : 'zapytań'} o lekcję — odpowiedz, aby zapełnić kalendarz.`
            : 'Gdy uczeń zarezerwuje termin i go potwierdzisz, pojawi się tutaj.'}
        </p>
        <Link href="/dashboard/teacher/apply" className="mt-4 inline-block">
          <Button variant="outline" size="sm">Sprawdź swoją dostępność</Button>
        </Link>
      </section>
    )
  }

  const joinHref = `/lesson/${lesson.id}/room?with=${encodeURIComponent(lesson.studentName)}&topic=${encodeURIComponent(lesson.topic)}`

  return (
    <section className="overflow-hidden rounded-2xl border border-primary/40 bg-card">
      <div className="flex items-center gap-2 border-b border-primary/25 bg-accent px-5 py-2.5">
        <span className="relative flex h-2 w-2" aria-hidden="true">
          <span className="absolute inline-flex h-full w-full rounded-full bg-primary opacity-60" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-primary" />
        </span>
        <p className="text-[11px] font-semibold uppercase tracking-wide text-accent-foreground">Następna lekcja</p>
        {lesson.pendingChange && (
          <span className="ml-auto flex items-center gap-1 text-[11px] font-medium text-warning">
            <Clock3 className="h-3 w-3" aria-hidden="true" />
            Prośba o zmianę
          </span>
        )}
      </div>

      <div className="flex flex-col gap-5 px-5 py-5 sm:px-6">
        <div className="flex items-start gap-3.5">
          <Avatar className="h-12 w-12 shrink-0">
            <AvatarFallback color={lesson.teacherColor}>
              {lesson.studentName.slice(0, 2).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Uczeń</p>
            <h2 className="truncate text-lg font-bold leading-snug text-foreground sm:text-xl">{lesson.studentName}</h2>
            <p className="mt-0.5 truncate text-sm text-muted-foreground">{lesson.topic}</p>
          </div>
        </div>

        <MetaStrip
          items={[
            { icon: CalendarDays, label: 'Data', value: lesson.date },
            { icon: Clock, label: 'Godzina', value: lesson.time },
            { icon: Timer, label: 'Czas', value: `${lesson.duration} min` },
            { icon: Wallet, label: 'Stawka', value: `${lesson.price} zł` },
          ]}
        />

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <Link href={joinHref} className="sm:flex-1">
            <Button className="w-full font-semibold transition-transform hover:-translate-y-0.5">
              <Video className="h-4 w-4" aria-hidden="true" />
              Rozpocznij lekcję
            </Button>
          </Link>
          <Link href="/chat" className="sm:w-auto">
            <Button variant="outline" className="w-full sm:w-auto">
              <MessageSquare className="h-4 w-4" aria-hidden="true" />
              Napisz do ucznia
            </Button>
          </Link>
        </div>
      </div>
    </section>
  )
}
