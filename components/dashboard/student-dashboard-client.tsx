'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { CalendarDays, LayoutDashboard, MessageSquare, PackageCheck, Search, UserCog, UserRound } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/lib/auth-context'
import { getStudentLessons, getStudentStats } from '@/services/lessons.service'
import { subscribeToConversations } from '@/services/chat.service'
import { canManageLessonReport } from '@/lib/report-permissions'
import { getReviewedTeacherIds } from '@/services/teachers.service'
import { DashboardColumns, DashboardHeader, DashboardTabPanel, DashboardTabs } from '@/components/dashboard/dashboard-primitives'
import { StudentNextLesson } from '@/components/dashboard/student-next-lesson'
import { StudentActionCenter } from '@/components/dashboard/student-action-center'
import { StudentLessonsPanel } from '@/components/dashboard/student-lessons-panel'
import { StudentPackagesPanel } from '@/components/dashboard/student-packages-panel'
import { StudentStatsCards } from '@/components/dashboard/student-stats-client'
import { StudentLinkCodeWidget } from '@/components/dashboard/student-link-code-widget'
import { NotificationsPanel } from '@/components/dashboard/notifications-panel'
import { LessonChangeModal } from '@/components/dashboard/lesson-change-modal'
import { LessonReviewModal } from '@/components/dashboard/lesson-review-modal'
import { DashboardMessagesTab } from '@/components/dashboard/dashboard-messages-tab'
import type { ChatConversation, Lesson, Notification, StudentStats } from '@/lib/types'

interface Props {
  initialLessons: Lesson[]
  initialStats: StudentStats
  initialNotifications: Notification[]
}

/**
 * Owns the whole student dashboard.
 *
 * Lesson state used to live inside StudentLessonsSection, which meant
 * anything else on the page that needed to reason about lessons — "what
 * is my next one", "is a report waiting for me", "is a change request
 * still with the teacher" — either couldn't, or would have had to fetch
 * the same list a second time. Lifting it here lets one fetch drive the
 * next-lesson panel, the attention list and the lesson tabs at once, and
 * keeps a single refresh path after a modal writes.
 *
 * Data sources are unchanged: the same getStudentLessons /
 * getStudentStats / subscribeToConversations calls, the same
 * server-rendered baseline re-fetched once the signed-in student is
 * known client-side, and the same canManageLessonReport rule from
 * lib/report-permissions.ts that /reports and chat already use.
 */
export function StudentDashboardClient({ initialLessons, initialStats, initialNotifications }: Props) {
  const { user } = useAuth()
  const [lessons, setLessons] = useState(initialLessons)
  const [stats, setStats] = useState(initialStats)
  const [conversations, setConversations] = useState<ChatConversation[] | null>(null)
  /** Teachers this student has already written their one review for. */
  const [reviewedTeacherIds, setReviewedTeacherIds] = useState<Set<string>>(new Set())
  const [tab, setTab] = useState<'overview' | 'lessons' | 'packages' | 'messages' | 'account'>('overview')
  const [changeModalFor, setChangeModalFor] = useState<Lesson | null>(null)
  const [reviewModalFor, setReviewModalFor] = useState<Lesson | null>(null)

  const refresh = useCallback(async () => {
    if (!user) return
    const [freshLessons, freshStats] = await Promise.all([getStudentLessons(user.id), getStudentStats(user.id)])
    setLessons(freshLessons)
    setStats(freshStats)
    setReviewedTeacherIds(
      await getReviewedTeacherIds(
        user.id,
        freshLessons.filter((l) => l.status === 'completed').map((l) => l.teacherId),
      ),
    )
  }, [user])

  useEffect(() => {
    if (!user) return
    let cancelled = false
    Promise.all([getStudentLessons(user.id), getStudentStats(user.id)]).then(async ([freshLessons, freshStats]) => {
      if (cancelled) return
      setLessons(freshLessons)
      setStats(freshStats)
      const reviewed = await getReviewedTeacherIds(
        user.id,
        freshLessons.filter((l) => l.status === 'completed').map((l) => l.teacherId),
      )
      if (!cancelled) setReviewedTeacherIds(reviewed)
    })
    return () => {
      cancelled = true
    }
  }, [user])

  // Live unread/conversation feed — the same subscription the navbar badge uses.
  useEffect(() => {
    if (!user) return
    const unsubscribe = subscribeToConversations(user.id, setConversations)
    return unsubscribe
  }, [user])

  const buckets = useMemo(() => {
    const upcomingAll = lessons.filter((l) => l.status === 'upcoming')
    const nextLesson = upcomingAll[0] ?? null
    const laterUpcoming = upcomingAll.slice(1)
    return {
      nextLesson,
      laterUpcoming,
      pending: lessons.filter((l) => l.status === 'pending'),
      past: lessons.filter((l) => l.status === 'completed' || l.status === 'cancelled'),
      awaitingReportConfirmation: user
        ? lessons.filter((l) => l.report && !l.reportConfirmedAt && !l.dispute && canManageLessonReport(l, user.id))
        : [],
      openDisputes: lessons.filter((l) => l.dispute?.status === 'open'),
      // One prompt per teacher the student hasn't reviewed yet — not one
      // per completed lesson, which is what the old per-lesson review
      // model produced.
      awaitingReview: Object.values(
        lessons
          .filter((l) => l.status === 'completed' && !reviewedTeacherIds.has(l.teacherId))
          .reduce<Record<string, Lesson>>((acc, lesson) => {
            const seen = acc[lesson.teacherId]
            if (!seen || (lesson.completedAt ?? 0) > (seen.completedAt ?? 0)) acc[lesson.teacherId] = lesson
            return acc
          }, {}),
      ),
      // The next lesson's own pending change is already surfaced on its hero panel — don't say it twice.
      awaitingTeacherOnChange: laterUpcoming.filter((l) => l.pendingChange),
    }
  }, [lessons, user, reviewedTeacherIds])

  const unread = conversations?.reduce((sum, c) => sum + c.unread, 0) ?? 0

  const attentionCount =
    buckets.awaitingReportConfirmation.length +
    buckets.openDisputes.length +
    buckets.awaitingReview.length +
    buckets.awaitingTeacherOnChange.length +
    (unread > 0 ? 1 : 0)

  return (
    <>
      <DashboardHeader
        eyebrow="Panel ucznia"
        title={`Cześć${user?.firstName ? `, ${user.firstName}` : ''}`}
        status={
          attentionCount > 0
            ? `${attentionCount} ${attentionCount === 1 ? 'sprawa czeka' : 'spraw czeka'} na Ciebie`
            : buckets.nextLesson
              ? 'Wszystko gotowe na kolejną lekcję'
              : 'Zacznij od znalezienia nauczyciela'
        }
        action={
          <div className="flex flex-col gap-2 sm:flex-row">
            <Link href="/dashboard/student/profile">
              <Button variant="outline" className="w-full font-semibold sm:w-auto">
                <UserCog className="h-4 w-4" aria-hidden="true" />
                Edytuj profil
              </Button>
            </Link>
            <Link href="/marketplace">
              <Button className="w-full font-semibold transition-transform hover:-translate-y-0.5 sm:w-auto">
                <Search className="h-4 w-4" aria-hidden="true" />
                Zarezerwuj lekcję
              </Button>
            </Link>
          </div>
        }
      />

      <div className="mt-5">
        <DashboardTabs
          label="Sekcje panelu ucznia"
          value={tab}
          onChange={setTab}
          tabs={[
            { key: 'overview', label: 'Przegląd', icon: LayoutDashboard, count: attentionCount },
            { key: 'lessons', label: 'Lekcje', icon: CalendarDays, count: buckets.pending.length },
            { key: 'packages', label: 'Pakiety', icon: PackageCheck },
            { key: 'messages', label: 'Wiadomości', icon: MessageSquare, count: unread },
            { key: 'account', label: 'Konto', icon: UserRound },
          ]}
        />
      </div>

      <DashboardTabPanel tab={tab}>
        {tab === 'overview' && (
          <DashboardColumns
            main={
              <>
                <StudentNextLesson
                  lesson={buckets.nextLesson}
                  pendingCount={buckets.pending.length}
                  onManage={setChangeModalFor}
                />
                <StudentActionCenter
                  awaitingReportConfirmation={buckets.awaitingReportConfirmation}
                  openDisputes={buckets.openDisputes}
                  awaitingReview={buckets.awaitingReview}
                  awaitingTeacherOnChange={buckets.awaitingTeacherOnChange}
                  unreadMessages={unread}
                  onReview={setReviewModalFor}
                />
              </>
            }
            side={
              <>
                <StudentStatsCards stats={stats} />
                <NotificationsPanel initialNotifications={initialNotifications} />
              </>
            }
          />
        )}
        {tab === 'lessons' && (
          <StudentLessonsPanel
            upcoming={buckets.laterUpcoming}
            pending={buckets.pending}
            past={buckets.past}
            onManage={setChangeModalFor}
            onReview={setReviewModalFor}
            reviewedTeacherIds={reviewedTeacherIds}
          />
        )}
        {tab === 'packages' && <StudentPackagesPanel />}
        {tab === 'messages' && (
          <DashboardMessagesTab
            conversations={conversations}
            unread={unread}
            emptyDescription="Napisz do nauczyciela z jego profilu, aby zacząć."
            notifications={initialNotifications}
          />
        )}
        {tab === 'account' && (
          <div className="max-w-xl">
            <StudentLinkCodeWidget />
          </div>
        )}
      </DashboardTabPanel>

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
