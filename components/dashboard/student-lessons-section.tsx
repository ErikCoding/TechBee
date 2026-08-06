'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { CalendarDays, CheckCircle2, XCircle, Circle } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/lib/auth-context'
import { getStudentLessons } from '@/services/lessons.service'
import { cn } from '@/lib/utils'
import type { Lesson } from '@/lib/types'

const statusConfig = {
  upcoming: { label: 'Nadchodząca', icon: Circle, className: 'text-blue-500 bg-blue-500/10' },
  completed: { label: 'Ukończona', icon: CheckCircle2, className: 'text-emerald-500 bg-emerald-500/10' },
  cancelled: { label: 'Anulowana', icon: XCircle, className: 'text-muted-foreground bg-muted' },
}

interface Props {
  initialLessons: Lesson[]
}

/**
 * Renders "Nadchodzące lekcje" + "Historia lekcji". Starts from the
 * server-fetched baseline (`initialLessons`, unscoped) and, once the
 * real signed-in user is known client-side, re-fetches scoped to
 * their id — so a lesson booked moments ago on a teacher's profile
 * shows up here immediately.
 */
export function StudentLessonsSection({ initialLessons }: Props) {
  const { user } = useAuth()
  const [lessons, setLessons] = useState(initialLessons)

  useEffect(() => {
    if (!user) return
    let cancelled = false
    getStudentLessons(user.id).then((fresh) => {
      if (!cancelled) setLessons(fresh)
    })
    return () => {
      cancelled = true
    }
  }, [user])

  const upcomingLessons = lessons.filter((l) => l.status === 'upcoming')
  const pastLessons = lessons.filter((l) => l.status !== 'upcoming')

  return (
    <>
      {/* Upcoming lessons */}
      <section className="rounded-2xl border border-border bg-card p-6">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-foreground">Nadchodzące lekcje</h2>
          <Badge variant="secondary">{upcomingLessons.length}</Badge>
        </div>
        {upcomingLessons.length === 0 ? (
          <div className="mt-6 flex flex-col items-center gap-2 py-8 text-center">
            <CalendarDays className="h-8 w-8 text-muted-foreground/40" />
            <p className="text-sm text-muted-foreground">Brak nadchodzących lekcji</p>
            <Link href="/marketplace">
              <Button size="sm" variant="outline" className="mt-2">Przeglądaj nauczycieli</Button>
            </Link>
          </div>
        ) : (
          <div className="mt-4 flex flex-col gap-3">
            {upcomingLessons.map((lesson) => (
              <div
                key={lesson.id}
                className="flex items-center gap-4 rounded-xl border border-border p-4 transition-colors hover:bg-muted/40"
              >
                <div
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-sm font-bold text-white"
                  style={{ backgroundColor: lesson.teacherColor }}
                  aria-hidden="true"
                >
                  {lesson.teacherInitials}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-foreground">{lesson.topic}</p>
                  <p className="text-xs text-muted-foreground">
                    z {lesson.teacherName} · {lesson.date} o {lesson.time} · {lesson.duration} min
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-foreground">{lesson.price} zł</span>
                  <Link href={`/lesson/${lesson.id}/room?with=${encodeURIComponent(lesson.teacherName)}&topic=${encodeURIComponent(lesson.topic)}`}>
                    <Button size="sm" className="h-7 bg-[#F4B400] text-[#0A0A0A] hover:bg-[#FBBF24] text-xs font-semibold">
                      Dołącz
                    </Button>
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Past lessons */}
      <section className="rounded-2xl border border-border bg-card p-6">
        <h2 className="font-semibold text-foreground">Historia lekcji</h2>
        <div className="mt-4 flex flex-col gap-3">
          {pastLessons.map((lesson) => {
            const status = statusConfig[lesson.status]
            const StatusIcon = status.icon
            return (
              <div
                key={lesson.id}
                className="flex items-center gap-4 rounded-xl border border-border p-4 transition-colors hover:bg-muted/40"
              >
                <div
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-sm font-bold text-white"
                  style={{ backgroundColor: lesson.teacherColor }}
                  aria-hidden="true"
                >
                  {lesson.teacherInitials}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-foreground">{lesson.topic}</p>
                  <p className="text-xs text-muted-foreground">
                    {lesson.teacherName} · {lesson.date}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className={cn('flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium', status.className)}>
                    <StatusIcon className="h-3 w-3" aria-hidden="true" />
                    {status.label}
                  </span>
                  <span className="text-xs text-muted-foreground">{lesson.price} zł</span>
                </div>
              </div>
            )
          })}
          {pastLessons.length === 0 && (
            <p className="py-4 text-center text-sm text-muted-foreground">Brak ukończonych lekcji.</p>
          )}
        </div>
      </section>
    </>
  )
}
