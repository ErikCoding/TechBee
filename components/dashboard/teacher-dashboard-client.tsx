'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { Star, UserCog, ExternalLink, BookOpen, Users, TrendingUp, Gauge, MessageCircle, CheckCircle2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { useAuth } from '@/lib/auth-context'
import { getTeacherDashboard, getTeacherLessons, respondToBookingRequest, respondToLessonChange } from '@/services/lessons.service'
import { subscribeToConversations } from '@/services/chat.service'
import { DashboardHeader, Panel, StatRow } from '@/components/dashboard/dashboard-primitives'
import { DashboardMessagesPreview } from '@/components/dashboard/dashboard-messages-preview'
import { TeacherReadinessPanel } from '@/components/dashboard/teacher-readiness-panel'
import { TeacherNextLesson } from '@/components/dashboard/teacher-next-lesson'
import { TeacherWorkQueue } from '@/components/dashboard/teacher-work-queue'
import { TeacherSchedulePanel } from '@/components/dashboard/teacher-schedule-panel'
import { TeacherEarningsPanel } from '@/components/dashboard/teacher-earnings-panel'
import { NotificationsPanel } from '@/components/dashboard/notifications-panel'
import { LessonReportModal } from '@/components/dashboard/lesson-report-modal'
import type { ChatConversation, Lesson, LessonReport, Notification, Teacher, TeacherDashboardData } from '@/lib/types'

interface Props {
  initialData: TeacherDashboardData
  initialLessons: Lesson[]
  initialNotifications: Notification[]
}

/**
 * Owns the teacher dashboard.
 *
 * The previous page composed nine independent blocks, four of which
 * (application status, Stripe setup, a four-card stat row, and a
 * six-month earnings chart) sat above the teacher's actual work. The
 * teaching loop — answer requests, teach, file reports — was split
 * across four stacked sections plus a banner restating their counts.
 *
 * This version orders the page by what a teacher needs to decide:
 * blockers to getting paid first (readiness, only while unresolved),
 * then who they are teaching next, then one queue of everything awaiting
 * their decision, then the rest of the schedule. Money, messages and
 * passive metrics move to the rail.
 *
 * All data flows are unchanged: the same getTeacherDashboard /
 * getTeacherLessons / subscribeToConversations calls, the same
 * respondToBookingRequest / respondToLessonChange handlers, and the same
 * local-patch-instead-of-refetch behaviour after a report is submitted.
 */
export function TeacherDashboardClient({ initialData, initialLessons, initialNotifications }: Props) {
  const { user } = useAuth()
  const [data, setData] = useState(initialData)
  const [lessons, setLessons] = useState(initialLessons)
  const [conversations, setConversations] = useState<ChatConversation[] | null>(null)
  const [application, setApplication] = useState<Teacher | null>(null)
  const [actingOn, setActingOn] = useState<string | null>(null)
  const [reportModalFor, setReportModalFor] = useState<Lesson | null>(null)

  const refresh = useCallback(async () => {
    if (!user) return
    const [freshLessons, freshData] = await Promise.all([
      getTeacherLessons(user.id, user.name),
      getTeacherDashboard(user.name, user.id),
    ])
    setLessons(freshLessons)
    setData(freshData)
  }, [user])

  useEffect(() => {
    if (!user || user.role !== 'teacher') return
    let cancelled = false
    Promise.all([getTeacherLessons(user.id, user.name), getTeacherDashboard(user.name, user.id)]).then(
      ([freshLessons, freshData]) => {
        if (cancelled) return
        setLessons(freshLessons)
        setData(freshData)
      },
    )
    return () => {
      cancelled = true
    }
  }, [user])

  useEffect(() => {
    if (!user) return
    const unsubscribe = subscribeToConversations(user.id, setConversations)
    return unsubscribe
  }, [user])

  const handleApplicationLoaded = useCallback((app: Teacher | null) => setApplication(app), [])

  const buckets = useMemo(() => {
    const upcomingAll = lessons.filter((l) => l.status === 'upcoming' && !l.pendingChange)
    return {
      nextLesson: upcomingAll[0] ?? null,
      laterSchedule: upcomingAll.slice(1),
      bookingRequests: lessons.filter((l) => l.status === 'pending'),
      changeRequests: lessons.filter((l) => l.status === 'upcoming' && l.pendingChange),
      // Newest-first: once reported, a lesson's status lives in its chat
      // report card, so this stays a pure to-do list.
      needsReport: lessons
        .filter((l) => l.status === 'completed' && !l.report)
        .sort((a, b) => (b.completedAt ?? 0) - (a.completedAt ?? 0)),
    }
  }, [lessons])

  const unread = conversations?.reduce((sum, c) => sum + c.unread, 0) ?? 0
  const todoCount = buckets.bookingRequests.length + buckets.changeRequests.length + buckets.needsReport.length

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

  const displayName = user?.role === 'teacher' ? user.name : data.name
  const initials = user?.role === 'teacher' ? user.initials : data.initials
  const avatarColor = user?.role === 'teacher' ? user.avatarColor : data.avatarColor
  const photoUrl = data.photoUrl ?? user?.photoUrl

  return (
    <>
      <DashboardHeader
        eyebrow="Panel nauczyciela"
        title={
          <span className="flex items-center gap-3">
            <Avatar className="h-9 w-9 shrink-0">
              {photoUrl && <AvatarImage src={photoUrl} alt="" />}
              <AvatarFallback color={avatarColor} className="text-xs">{initials}</AvatarFallback>
            </Avatar>
            <span className="truncate">{displayName}</span>
          </span>
        }
        status={
          <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <span className="flex items-center gap-1">
              <Star className="h-3.5 w-3.5 fill-primary stroke-none" aria-hidden="true" />
              <span className="font-semibold text-foreground">{data.rating.toFixed(1)}</span>
              <span>({data.reviewCount} opinii)</span>
            </span>
            <span aria-hidden="true">·</span>
            <span>
              {todoCount > 0
                ? `${todoCount} ${todoCount === 1 ? 'zadanie czeka' : 'zadań czeka'} na Ciebie`
                : 'Brak zaległych zadań'}
            </span>
          </span>
        }
        action={
          <div className="flex flex-wrap items-center gap-2">
            {/* Moved here from the old always-on "profil widoczny" banner, so the
                public-profile link survives once the readiness panel hides itself. */}
            {application && application.status !== 'pending' && application.status !== 'rejected' && (
              <Link href={`/teacher/${application.id}`}>
                <Button variant="ghost" size="sm">
                  <ExternalLink className="h-4 w-4" aria-hidden="true" />
                  Mój profil
                </Button>
              </Link>
            )}
            <Link href="/dashboard/teacher/apply">
              <Button variant="outline" size="sm">
                <UserCog className="h-4 w-4" aria-hidden="true" />
                Edytuj profil
              </Button>
            </Link>
          </div>
        }
      />

      <div className="mt-5">
        <TeacherReadinessPanel onApplicationLoaded={handleApplicationLoaded} />
      </div>

      {/*
        Mobile flattens both columns into one ordered stack via
        `display: contents`, so a phone gets: next lesson → the to-do
        queue → messages → earnings → schedule → notifications → metrics.
        Earnings deliberately outrank the remaining schedule on a phone
        (a teacher checks money far more often than next week's calendar),
        while passive performance metrics sink to the bottom.
      */}
      <div className="mt-5 flex flex-col gap-5 lg:grid lg:grid-cols-[minmax(0,1fr)_340px] lg:items-start lg:gap-6">
        <div className="contents lg:flex lg:flex-col lg:gap-5">
          <div className="order-1">
            <TeacherNextLesson lesson={buckets.nextLesson} requestCount={buckets.bookingRequests.length} />
          </div>
          <div className="order-2">
            <TeacherWorkQueue
              bookingRequests={buckets.bookingRequests}
              changeRequests={buckets.changeRequests}
              needsReport={buckets.needsReport}
              actingOn={actingOn}
              onBookingDecision={handleBookingDecision}
              onChangeDecision={handleChangeDecision}
              onWriteReport={setReportModalFor}
            />
          </div>
          <div className="order-6">
            <TeacherSchedulePanel lessons={buckets.laterSchedule} />
          </div>
        </div>

        <div className="contents lg:flex lg:flex-col lg:gap-5">
          <div className="order-3">
            <NotificationsPanel initialNotifications={initialNotifications} />
          </div>
          <div className="order-4">
            <DashboardMessagesPreview
              conversations={conversations}
              unread={unread}
              emptyDescription="Uczniowie napiszą do Ciebie po rezerwacji lekcji."
            />
          </div>
          <div className="order-5">
            <TeacherEarningsPanel data={data} />
          </div>
          <div className="order-7">
            <Panel icon={Gauge} title="Wyniki">
              <StatRow
                items={[
                  { icon: BookOpen, label: 'Lekcje', value: data.lessonsThisMonth },
                  { icon: Users, label: 'Uczniowie', value: data.studentsThisMonth },
                  { icon: TrendingUp, label: 'Ukończenie', value: `${data.completionRate}%` },
                ]}
              />
              <div className="flex flex-col divide-y divide-border border-t border-border">
                <div className="flex items-center gap-2.5 px-5 py-2.5">
                  <MessageCircle className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
                  <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground">Wskaźnik odpowiedzi</span>
                  <span className="shrink-0 text-xs font-semibold text-foreground">{data.responseRate}%</span>
                </div>
                <div className="flex items-center gap-2.5 px-5 py-2.5">
                  <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
                  <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground">Lekcje łącznie</span>
                  <span className="shrink-0 text-xs font-semibold text-foreground">{data.lessonsThisMonth * 12}</span>
                </div>
              </div>
            </Panel>
          </div>
        </div>
      </div>

      {reportModalFor && (
        <LessonReportModal
          lesson={reportModalFor}
          onClose={() => setReportModalFor(null)}
          onSubmitted={(report: LessonReport) => {
            // Patch just this lesson locally instead of a full refetch
            // (which re-runs auto-confirm over every lesson) — we already
            // know exactly what changed.
            const submittedId = reportModalFor.id
            setLessons((prev) =>
              prev.map((l) => (l.id === submittedId ? { ...l, report, reportSubmittedAt: Date.now() } : l)),
            )
            setReportModalFor(null)
          }}
        />
      )}
    </>
  )
}
