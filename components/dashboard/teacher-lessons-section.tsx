'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Loader2 } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/lib/auth-context'
import { getTeacherLessons, respondToBookingRequest, respondToLessonChange } from '@/services/lessons.service'
import type { Lesson } from '@/lib/types'

interface Props {
  initialLessons: Lesson[]
}

/**
 * Renders "Zapytania o lekcje" (new booking requests — accept/reject,
 * nothing is charged either way), "Prośby o zmianę" (a student's
 * cancel/reschedule request — accept/reject), and "Nadchodzące
 * lekcje" (confirmed, ready to start). Starts from the server-fetched
 * demo baseline and, once the real signed-in teacher is known
 * client-side, re-fetches their real lessons.
 */
export function TeacherLessonsSection({ initialLessons }: Props) {
  const { user } = useAuth()
  const [lessons, setLessons] = useState(initialLessons)
  const [actingOn, setActingOn] = useState<string | null>(null)

  async function refresh() {
    if (!user) return
    const fresh = await getTeacherLessons(user.id, user.name)
    setLessons(fresh)
  }

  useEffect(() => {
    if (!user) return
    let cancelled = false
    getTeacherLessons(user.id, user.name).then((fresh) => {
      if (!cancelled) setLessons(fresh)
    })
    return () => {
      cancelled = true
    }
  }, [user])

  const bookingRequests = lessons.filter((l) => l.status === 'pending')
  const changeRequests = lessons.filter((l) => l.status === 'upcoming' && l.pendingChange)
  const upcoming = lessons.filter((l) => l.status === 'upcoming' && !l.pendingChange)

  async function handleBookingDecision(lesson: Lesson, decision: 'accepted' | 'rejected') {
    setActingOn(lesson.id)
    try {
      await respondToBookingRequest(lesson, decision)
      await refresh()
    } finally {
      setActingOn(null)
    }
  }

  async function handleChangeDecision(lesson: Lesson, decision: 'accepted' | 'rejected') {
    setActingOn(lesson.id)
    try {
      await respondToLessonChange(lesson, decision)
      await refresh()
    } finally {
      setActingOn(null)
    }
  }

  return (
    <>
      {/* Booking requests */}
      <section className="rounded-2xl border border-border bg-card p-6">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-foreground">Zapytania o lekcje</h2>
          <Badge className="bg-[#F4B400] text-[#0A0A0A]">{bookingRequests.length} oczekujące</Badge>
        </div>
        <div className="mt-4 flex flex-col gap-3">
          {bookingRequests.map((req) => (
            <div
              key={req.id}
              className="flex flex-col gap-3 rounded-xl border border-border p-4 transition-colors hover:bg-muted/40 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-foreground">{req.topic}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {req.studentName} · {req.date} o {req.time} · {req.price} zł
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2 sm:ml-4">
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 flex-1 text-xs sm:flex-none"
                  disabled={actingOn === req.id}
                  onClick={() => handleBookingDecision(req, 'rejected')}
                >
                  Odrzuć
                </Button>
                <Button
                  size="sm"
                  className="h-7 flex-1 bg-[#F4B400] text-[#0A0A0A] hover:bg-[#FBBF24] text-xs font-semibold sm:flex-none"
                  disabled={actingOn === req.id}
                  onClick={() => handleBookingDecision(req, 'accepted')}
                >
                  {actingOn === req.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Akceptuj'}
                </Button>
              </div>
            </div>
          ))}
          {bookingRequests.length === 0 && (
            <p className="py-4 text-center text-sm text-muted-foreground">Brak oczekujących zapytań.</p>
          )}
        </div>
      </section>

      {/* Change requests (cancel/reschedule) */}
      {changeRequests.length > 0 && (
        <section className="rounded-2xl border border-yellow-500/30 bg-yellow-500/5 p-6">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-foreground">Prośby o zmianę</h2>
            <Badge className="bg-yellow-500 text-[#0A0A0A]">{changeRequests.length}</Badge>
          </div>
          <div className="mt-4 flex flex-col gap-3">
            {changeRequests.map((lesson) => (
              <div key={lesson.id} className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-foreground">{lesson.topic}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {lesson.studentName} prosi o {lesson.pendingChange?.type === 'cancel' ? 'odwołanie' : 'przełożenie'} lekcji {lesson.date} o {lesson.time}
                    {lesson.pendingChange?.type === 'reschedule' && lesson.pendingChange.newDate ? ` → ${lesson.pendingChange.newDate} o ${lesson.pendingChange.newTime}` : ''}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2 sm:ml-4">
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 flex-1 text-xs sm:flex-none"
                    disabled={actingOn === lesson.id}
                    onClick={() => handleChangeDecision(lesson, 'rejected')}
                  >
                    Odrzuć
                  </Button>
                  <Button
                    size="sm"
                    className="h-7 flex-1 bg-[#F4B400] text-[#0A0A0A] hover:bg-[#FBBF24] text-xs font-semibold sm:flex-none"
                    disabled={actingOn === lesson.id}
                    onClick={() => handleChangeDecision(lesson, 'accepted')}
                  >
                    {actingOn === lesson.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Akceptuj'}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Upcoming lessons */}
      <section className="rounded-2xl border border-border bg-card p-6">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-foreground">Nadchodzące lekcje</h2>
          <Badge variant="secondary">{upcoming.length}</Badge>
        </div>
        <div className="mt-4 flex flex-col gap-3">
          {upcoming.map((lesson) => (
            <div
              key={lesson.id}
              className="flex flex-col gap-3 rounded-xl border border-border p-4 transition-colors hover:bg-muted/40 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-foreground">{lesson.topic}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {lesson.studentName} · {lesson.date} o {lesson.time} · {lesson.duration} min
                </p>
              </div>
              <div className="flex shrink-0 items-center justify-between gap-2 sm:ml-4 sm:justify-end">
                <span className="text-sm font-bold text-[#F4B400]">{lesson.price} zł</span>
                <Link href={`/lesson/${lesson.id}/room?with=${encodeURIComponent(lesson.studentName)}&topic=${encodeURIComponent(lesson.topic)}`}>
                  <Button size="sm" className="h-7 bg-[#F4B400] text-[#0A0A0A] hover:bg-[#FBBF24] text-xs font-semibold">
                    Rozpocznij
                  </Button>
                </Link>
              </div>
            </div>
          ))}
          {upcoming.length === 0 && (
            <p className="py-4 text-center text-sm text-muted-foreground">Brak nadchodzących lekcji.</p>
          )}
        </div>
      </section>
    </>
  )
}
