'use client'

import Link from 'next/link'
import {
  CalendarDays, Clock, GraduationCap, BookOpen, Wallet, Search, UserPlus, Video,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import type { Lesson, LinkedStudentSummary } from '@/lib/types'

export interface ChildSummary extends LinkedStudentSummary {
  nextLesson: Lesson | null
  completedCount: number
  hoursLearned: number
  teacherCount: number
  totalPaid: number
}

interface Props {
  children: ChildSummary[] | null
  selectedId: string | null
  onSelect: (id: string) => void
}

/**
 * The parent dashboard's subject line: a full-width band about one
 * child, not a card in a grid.
 *
 * The other two dashboards open with a greeting and a stack of panels,
 * because a student or teacher is looking at *their own* work. A parent
 * is looking at somebody else, so the page needs to say whose data this
 * is before it says anything else — and a supervising parent's first
 * question is simply "is everything on track, and when is the next
 * lesson?". Both answers live here, above any panel.
 *
 * Multiple children appear as tabs on the band itself rather than as a
 * second grid of selectable cards, so switching child never shifts the
 * page's structure — only its subject.
 */
export function ParentChildBand({ children, selectedId, onSelect }: Props) {
  if (children === null) {
    return (
      <section className="overflow-hidden rounded-2xl border border-border bg-card">
        <div className="flex items-center gap-4 px-5 py-5">
          <Skeleton className="h-14 w-14 rounded-full" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-3 w-56" />
          </div>
        </div>
        <Skeleton className="h-14 w-full rounded-none" />
      </section>
    )
  }

  if (children.length === 0) {
    return (
      <section className="rounded-2xl border border-dashed border-border bg-card px-5 py-9 text-center sm:px-8">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-accent">
          <UserPlus className="h-5 w-5 text-bee-yellow-dark" aria-hidden="true" />
        </div>
        <h2 className="mt-3 text-base font-bold text-foreground">Nie masz jeszcze połączonego dziecka</h2>
        <p className="mx-auto mt-1 max-w-md text-sm leading-relaxed text-muted-foreground">
          Poproś dziecko, aby w swoim panelu ucznia otworzyło „Konto rodzica" i wygenerowało kod. Po wpisaniu go poniżej
          zobaczysz tutaj jego lekcje, raporty i płatności.
        </p>
      </section>
    )
  }

  const selected = children.find((c) => c.id === selectedId) ?? children[0]
  const multiple = children.length > 1

  return (
    <section className="overflow-hidden rounded-2xl border border-border bg-card">
      {/* Child switcher — only when there is a choice to make. */}
      {multiple && (
        <div role="tablist" aria-label="Wybierz dziecko" className="flex gap-1 overflow-x-auto border-b border-border bg-muted/40 px-2 py-2">
          {children.map((child) => (
            <button
              key={child.id}
              type="button"
              role="tab"
              aria-selected={child.id === selected.id}
              onClick={() => onSelect(child.id)}
              className={cn(
                'flex shrink-0 items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors',
                child.id === selected.id
                  ? 'bg-card text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              <Avatar className="h-5 w-5">
                <AvatarFallback color={child.avatarColor} className="text-[9px]">{child.initials}</AvatarFallback>
              </Avatar>
              {child.name}
              {child.pendingConfirmationsCount > 0 && (
                <span className="h-1.5 w-1.5 rounded-full bg-warning" aria-label="Wymaga uwagi" />
              )}
            </button>
          ))}
        </div>
      )}

      {/* Identity + next activity */}
      <div className="flex flex-col gap-4 px-5 py-5 sm:flex-row sm:items-center sm:gap-5">
        <Avatar className="h-14 w-14 shrink-0">
          <AvatarFallback color={selected.avatarColor} className="text-lg">{selected.initials}</AvatarFallback>
        </Avatar>

        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Podopieczny</p>
          <h2 className="truncate text-xl font-bold text-foreground">{selected.name}</h2>

          {selected.nextLesson ? (
            <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-sm text-muted-foreground">
              <span className="flex items-center gap-1.5 font-medium text-foreground">
                <CalendarDays className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
                {selected.nextLesson.date}
              </span>
              <span className="flex items-center gap-1.5 font-medium text-foreground">
                <Clock className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
                {selected.nextLesson.time}
              </span>
              <span className="truncate">
                · {selected.nextLesson.topic} · {selected.nextLesson.teacherName}
              </span>
            </p>
          ) : (
            <p className="mt-1 text-sm text-muted-foreground">Brak zaplanowanych lekcji.</p>
          )}
        </div>

        <div className="flex shrink-0 flex-col gap-2 sm:flex-row sm:items-center">
          {selected.nextLesson && (
            <Link
              href={`/lesson/${selected.nextLesson.id}/room?with=${encodeURIComponent(selected.nextLesson.teacherName)}&topic=${encodeURIComponent(selected.nextLesson.topic)}`}
            >
              <Button variant="outline" size="sm" className="w-full sm:w-auto">
                <Video className="h-3.5 w-3.5" aria-hidden="true" />
                Podgląd lekcji
              </Button>
            </Link>
          )}
          <Link href={`/marketplace?bookingForId=${selected.id}&bookingForName=${encodeURIComponent(selected.name)}`}>
            <Button size="sm" className="w-full font-semibold sm:w-auto">
              <Search className="h-3.5 w-3.5" aria-hidden="true" />
              Zarezerwuj lekcję
            </Button>
          </Link>
        </div>
      </div>

      {/* At-a-glance activity — inline, so it informs without competing for attention as its own panel. */}
      <dl className="grid grid-cols-2 divide-x divide-y divide-border border-t border-border sm:grid-cols-4 sm:divide-y-0">
        {[
          { icon: BookOpen, label: 'Odbyte lekcje', value: selected.completedCount },
          { icon: Clock, label: 'Godziny nauki', value: selected.hoursLearned },
          { icon: GraduationCap, label: 'Nauczyciele', value: selected.teacherCount },
          { icon: Wallet, label: 'Opłacone', value: `${selected.totalPaid.toLocaleString('pl-PL')} zł` },
        ].map(({ icon: Icon, label, value }) => (
          <div key={label} className="flex items-center gap-2.5 px-4 py-3">
            <Icon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
            <div className="min-w-0">
              <dd className="truncate text-sm font-bold text-foreground">{value}</dd>
              <dt className="truncate text-[10px] uppercase tracking-wide text-muted-foreground">{label}</dt>
            </div>
          </div>
        ))}
      </dl>
    </section>
  )
}
