'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/lib/auth-context'
import { getTeacherDashboard } from '@/services/lessons.service'
import type { TeacherDashboardData } from '@/lib/types'

interface Props {
  initialUpcoming: TeacherDashboardData['upcomingLessons']
  initialPending: TeacherDashboardData['pendingRequests']
}

/**
 * Renders "Nadchodzące lekcje" + "Zapytania o lekcje". Starts from
 * the server-fetched demo baseline and, once the real signed-in
 * teacher is known client-side, re-fetches merged with any bookings
 * students made against their profile.
 */
export function TeacherLessonsSection({ initialUpcoming, initialPending }: Props) {
  const { user } = useAuth()
  const [upcoming, setUpcoming] = useState(initialUpcoming)
  const [pending, setPending] = useState(initialPending)

  useEffect(() => {
    if (!user) return
    let cancelled = false
    getTeacherDashboard(user.name).then((fresh) => {
      if (!cancelled) {
        setUpcoming(fresh.upcomingLessons)
        setPending(fresh.pendingRequests)
      }
    })
    return () => {
      cancelled = true
    }
  }, [user])

  return (
    <>
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
              className="flex items-center justify-between rounded-xl border border-border p-4 transition-colors hover:bg-muted/40"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-foreground">{lesson.topic}</p>
                <p className="text-xs text-muted-foreground">
                  {lesson.studentName} · {lesson.date} o {lesson.time} · {lesson.duration} min
                </p>
              </div>
              <div className="ml-4 flex items-center gap-2">
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

      {/* Pending requests */}
      <section className="rounded-2xl border border-border bg-card p-6">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-foreground">Zapytania o lekcje</h2>
          <Badge className="bg-[#F4B400] text-[#0A0A0A]">{pending.length} oczekujące</Badge>
        </div>
        <div className="mt-4 flex flex-col gap-3">
          {pending.map((req) => (
            <div
              key={req.id}
              className="flex items-center justify-between rounded-xl border border-border p-4 transition-colors hover:bg-muted/40"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-foreground">{req.topic}</p>
                <p className="text-xs text-muted-foreground">
                  {req.studentName} · Termin: {req.requestedDate}
                </p>
              </div>
              <div className="ml-4 flex items-center gap-2">
                <Button size="sm" variant="outline" className="h-7 text-xs">
                  Odrzuć
                </Button>
                <Button size="sm" className="h-7 bg-[#F4B400] text-[#0A0A0A] hover:bg-[#FBBF24] text-xs font-semibold">
                  Akceptuj
                </Button>
              </div>
            </div>
          ))}
          {pending.length === 0 && (
            <p className="py-4 text-center text-sm text-muted-foreground">Brak oczekujących zapytań.</p>
          )}
        </div>
      </section>
    </>
  )
}
