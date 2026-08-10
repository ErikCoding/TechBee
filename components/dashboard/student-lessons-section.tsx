'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { CalendarDays, CheckCircle2, XCircle, Circle, Clock3, RefreshCw, Star } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/lib/auth-context'
import { getStudentLessons } from '@/services/lessons.service'
import { LessonChangeModal } from '@/components/dashboard/lesson-change-modal'
import { LessonReviewModal } from '@/components/dashboard/lesson-review-modal'
import { LessonReportReviewCard } from '@/components/dashboard/lesson-report-review-card'
import { cn } from '@/lib/utils'
import type { Lesson } from '@/lib/types'

const historyStatusConfig = {
  pending: { label: 'Oczekuje na nauczyciela', icon: Clock3, className: 'text-yellow-600 bg-yellow-500/10 dark:text-yellow-400' },
  upcoming: { label: 'Nadchodząca', icon: Circle, className: 'text-blue-500 bg-blue-500/10' },
  completed: { label: 'Ukończona', icon: CheckCircle2, className: 'text-emerald-500 bg-emerald-500/10' },
  cancelled: { label: 'Anulowana', icon: XCircle, className: 'text-muted-foreground bg-muted' },
}

interface Props {
  initialLessons: Lesson[]
}

/**
 * Renders "Oczekujące potwierdzenia" + "Nadchodzące lekcje" +
 * "Historia lekcji". Starts from the server-fetched baseline
 * (`initialLessons`, unscoped) and, once the real signed-in user is
 * known client-side, re-fetches scoped to their id — so a lesson
 * booked moments ago on a teacher's profile shows up here
 * immediately, and status changes (teacher confirming/rejecting,
 * a change request being resolved) are picked up on refresh.
 */
export function StudentLessonsSection({ initialLessons }: Props) {
  const { user } = useAuth()
  const [lessons, setLessons] = useState(initialLessons)
  const [changeModalFor, setChangeModalFor] = useState<Lesson | null>(null)
  const [reviewModalFor, setReviewModalFor] = useState<Lesson | null>(null)

  async function refresh() {
    if (!user) return
    const fresh = await getStudentLessons(user.id)
    setLessons(fresh)
  }

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

  const pendingRequests = lessons.filter((l) => l.status === 'pending')
  const upcomingLessons = lessons.filter((l) => l.status === 'upcoming')
  const pastLessons = lessons.filter((l) => l.status === 'completed' || l.status === 'cancelled')
  const reportsToConfirm = user
    ? lessons.filter((l) => l.report && !l.reportConfirmedAt && !l.dispute && l.confirmingPartyId === user.id)
    : []

  return (
    <>
      {/* Pending confirmation */}
      {pendingRequests.length > 0 && (
        <section className="rounded-2xl border border-yellow-500/30 bg-yellow-500/5 p-6">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-foreground">Oczekujące potwierdzenia</h2>
            <Badge className="bg-yellow-500 text-[#0A0A0A]">{pendingRequests.length}</Badge>
          </div>
          <div className="mt-4 flex flex-col gap-3">
            {pendingRequests.map((lesson) => (
              <div key={lesson.id} className="flex flex-col gap-1 rounded-xl border border-border bg-card p-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-foreground">{lesson.topic}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    z {lesson.teacherName} · {lesson.date} o {lesson.time} — czeka na potwierdzenie nauczyciela
                  </p>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Reports awaiting your confirmation — releases the held payment (see LessonReportReviewCard) */}
      {reportsToConfirm.length > 0 && user && (
        <section className="rounded-2xl border border-yellow-500/30 bg-yellow-500/5 p-6">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-foreground">Raporty do potwierdzenia</h2>
            <Badge className="bg-yellow-500 text-[#0A0A0A]">{reportsToConfirm.length}</Badge>
          </div>
          <div className="mt-4 flex flex-col gap-3">
            {reportsToConfirm.map((lesson) => (
              <LessonReportReviewCard key={lesson.id} lesson={lesson} confirmedByUserId={user.id} onResolved={refresh} />
            ))}
          </div>
        </section>
      )}

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
                className="flex flex-col gap-3 rounded-xl border border-border p-4 transition-colors hover:bg-muted/40 sm:flex-row sm:items-center sm:gap-4"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <div
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-sm font-bold text-white"
                    style={{ backgroundColor: lesson.teacherColor }}
                    aria-hidden="true"
                  >
                    {lesson.teacherInitials}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-foreground">{lesson.topic}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      z {lesson.teacherName} · {lesson.date} o {lesson.time} · {lesson.duration} min
                    </p>
                    {lesson.pendingChange && (
                      <p className="mt-0.5 flex items-center gap-1 text-[11px] font-medium text-yellow-600 dark:text-yellow-400">
                        <Clock3 className="h-3 w-3" aria-hidden="true" />
                        {lesson.pendingChange.type === 'cancel' ? 'Prośba o odwołanie' : 'Prośba o przełożenie'} czeka na nauczyciela
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 sm:justify-end">
                  <span className="text-xs font-semibold text-foreground">{lesson.price} zł</span>
                  {!lesson.pendingChange && (
                    <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setChangeModalFor(lesson)}>
                      <RefreshCw className="mr-1 h-3 w-3" aria-hidden="true" />
                      Zarządzaj
                    </Button>
                  )}
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
            const status = historyStatusConfig[lesson.status]
            const StatusIcon = status.icon
            return (
              <div
                key={lesson.id}
                className="flex flex-col gap-3 rounded-xl border border-border p-4 transition-colors hover:bg-muted/40 sm:flex-row sm:items-center sm:gap-4"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <div
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-sm font-bold text-white"
                    style={{ backgroundColor: lesson.teacherColor }}
                    aria-hidden="true"
                  >
                    {lesson.teacherInitials}
                  </div>
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
                  {lesson.dispute?.status === 'open' && (
                    <span className="rounded-full bg-orange-500/10 px-2.5 py-0.5 text-xs font-medium text-orange-600 dark:text-orange-400">Spór w toku</span>
                  )}
                  {lesson.status === 'completed' && !lesson.reviewed && (
                    <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setReviewModalFor(lesson)}>
                      <Star className="mr-1 h-3 w-3" aria-hidden="true" />
                      Oceń lekcję
                    </Button>
                  )}
                </div>
              </div>
            )
          })}
          {pastLessons.length === 0 && (
            <p className="py-4 text-center text-sm text-muted-foreground">Brak ukończonych lekcji.</p>
          )}
        </div>
      </section>

      {changeModalFor && (
        <LessonChangeModal
          lesson={changeModalFor}
          requestedBy="student"
          onClose={() => setChangeModalFor(null)}
          onRequested={() => {
            setChangeModalFor(null)
            refresh()
          }}
        />
      )}

      {reviewModalFor && (
        <LessonReviewModal
          lesson={reviewModalFor}
          onClose={() => setReviewModalFor(null)}
          onSubmitted={() => {
            setReviewModalFor(null)
            refresh()
          }}
        />
      )}
    </>
  )
}
