'use client'

import Link from 'next/link'
import { CalendarDays, Clock, Timer, Video, RefreshCw, Search, Clock3 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { MetaStrip } from '@/components/dashboard/dashboard-primitives'
import type { Lesson } from '@/lib/types'

interface Props {
  /** The single lesson the student should act on next, or null when they have none confirmed. */
  lesson: Lesson | null
  /** Count of bookings still awaiting a teacher's answer — shown as context when there's no confirmed lesson yet. */
  pendingCount: number
  onManage: (lesson: Lesson) => void
}

/**
 * The dashboard's primary focus: "what is my next lesson and how do I
 * join it". Previously this information was a single row inside a long
 * "Nadchodzące lekcje" list, with the join action rendered as a 28px
 * secondary button — the most important thing on the page was also the
 * hardest to spot. It now leads the page as a dedicated panel where the
 * join action is the visual anchor.
 *
 * Deliberately shows `date`/`time` exactly as stored: those are
 * display-only strings on the Lesson doc (there is no real scheduled
 * timestamp), so no countdown or "za 2 godziny" is invented here.
 */
export function StudentNextLesson({ lesson, pendingCount, onManage }: Props) {
  if (!lesson) {
    return (
      <section className="rounded-2xl border border-dashed border-border bg-card px-5 py-8 text-center sm:px-8 sm:py-10">
        <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-accent">
          <CalendarDays className="h-5 w-5 text-bee-yellow-dark" aria-hidden="true" />
        </div>
        <h2 className="mt-3 text-base font-bold text-foreground">Nie masz zaplanowanej lekcji</h2>
        <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">
          {pendingCount > 0
            ? `${pendingCount} ${pendingCount === 1 ? 'rezerwacja czeka' : 'rezerwacje czekają'} na potwierdzenie nauczyciela. W międzyczasie możesz zarezerwować kolejny termin.`
            : 'Wybierz eksperta z giełdy i zarezerwuj pierwszy termin — zajmie to mniej niż minutę.'}
        </p>
        <Link href="/marketplace" className="mt-4 inline-block">
          <Button className="font-semibold">
            <Search className="h-4 w-4" aria-hidden="true" />
            Znajdź nauczyciela
          </Button>
        </Link>
      </section>
    )
  }

  const joinHref = `/lesson/${lesson.id}/room?with=${encodeURIComponent(lesson.teacherName)}&topic=${encodeURIComponent(lesson.topic)}`

  return (
    <section className="overflow-hidden rounded-2xl border border-primary/40 bg-card">
      <div className="flex items-center gap-2 border-b border-primary/25 bg-accent px-5 py-2.5">
        <span className="relative flex h-2 w-2" aria-hidden="true">
          <span className="absolute inline-flex h-full w-full rounded-full bg-primary opacity-60" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-primary" />
        </span>
        <p className="text-[11px] font-semibold uppercase tracking-wide text-accent-foreground">Najbliższa lekcja</p>
        {lesson.pendingChange && (
          <span className="ml-auto flex items-center gap-1 text-[11px] font-medium text-warning">
            <Clock3 className="h-3 w-3" aria-hidden="true" />
            Zmiana u nauczyciela
          </span>
        )}
      </div>

      <div className="flex flex-col gap-5 px-5 py-5 sm:px-6">
        <div className="flex items-start gap-3.5">
          <Avatar className="h-12 w-12 shrink-0">
            <AvatarFallback color={lesson.teacherColor}>{lesson.teacherInitials}</AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <h2 className="text-lg font-bold leading-snug text-foreground sm:text-xl">{lesson.topic}</h2>
            <p className="mt-0.5 truncate text-sm text-muted-foreground">
              {lesson.teacherName} · {lesson.specialty}
            </p>
          </div>
          <span className="hidden shrink-0 text-sm font-bold text-foreground sm:block">{lesson.price} zł</span>
        </div>

        {/* The scheduling facts, grouped instead of buried in a sentence */}
        <MetaStrip
          items={[
            { icon: CalendarDays, label: 'Data', value: lesson.date },
            { icon: Clock, label: 'Godzina', value: lesson.time },
            { icon: Timer, label: 'Czas trwania', value: `${lesson.duration} min` },
            { icon: Video, label: 'Forma', value: 'Lekcja online' },
          ]}
        />

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <Link href={joinHref} className="sm:flex-1">
            <Button className="w-full font-semibold transition-transform hover:-translate-y-0.5">
              <Video className="h-4 w-4" aria-hidden="true" />
              Dołącz do lekcji
            </Button>
          </Link>
          {!lesson.pendingChange && (
            <Button variant="outline" className="w-full sm:w-auto" onClick={() => onManage(lesson)}>
              <RefreshCw className="h-4 w-4" aria-hidden="true" />
              Zmień termin
            </Button>
          )}
          <span className="text-center text-sm font-bold text-foreground sm:hidden">{lesson.price} zł</span>
        </div>
      </div>
    </section>
  )
}
