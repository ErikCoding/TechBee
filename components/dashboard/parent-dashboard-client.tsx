'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { AlertCircle, ShieldAlert, Settings2, FileText, CalendarDays, Clock3 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { Spinner } from '@/components/ui/spinner'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { EmptyState } from '@/components/ui/empty-state'
import { useAuth } from '@/lib/auth-context'
import { getStudentLessons, getParentLessons, lessonToReportCard } from '@/services/lessons.service'
import { getLinkedStudents, getStudentCanManageReports, setStudentCanManageReports } from '@/services/family-link.service'
import { canManageLessonReport } from '@/lib/report-permissions'
import { Panel, PanelFooterLink, AllClearBanner } from '@/components/dashboard/dashboard-primitives'
import { ParentChildBand, type ChildSummary } from '@/components/dashboard/parent-child-band'
import { ParentTeachersPanel } from '@/components/dashboard/parent-teachers-panel'
import { ParentSpendingPanel } from '@/components/dashboard/parent-spending-panel'
import { ParentLinkStudentPanel } from '@/components/dashboard/parent-link-student-panel'
import { NotificationsPanel } from '@/components/dashboard/notifications-panel'
import { ReportRow } from '@/components/reports/report-row'
import { ReportDetailDialog } from '@/components/reports/report-detail-dialog'
import { isActionableBy } from '@/components/reports/report-status'
import type { Lesson, LessonReportCard, Notification } from '@/lib/types'

interface Props {
  initialNotifications: Notification[]
}

/**
 * Owns the parent dashboard.
 *
 * Deliberately shaped unlike the student and teacher dashboards. Those
 * two open with "your work, your queue" because their user is the one
 * doing the work. A parent is supervising somebody else, so this page
 * leads with *whose* data it is (ParentChildBand) and then answers, in
 * order: does anything need me, what has been happening, who is teaching
 * my child, and what has it cost.
 *
 * There is no segmented lesson browser here on purpose — that pattern
 * belongs to the people who live in their own schedule. A parent wants a
 * short recent-activity read plus a way in when something matters, so
 * lists are capped and defer to their full pages.
 *
 * All reads use existing service functions; confirm/dispute runs through
 * ReportDetailDialog, which calls the same confirmLessonReport flow and
 * the same lib/report-permissions.ts rule as chat and /reports.
 */
export function ParentDashboardClient({ initialNotifications }: Props) {
  const { user } = useAuth()
  const [children, setChildren] = useState<ChildSummary[] | null>(null)
  const [lessonsByChild, setLessonsByChild] = useState<Record<string, Lesson[]>>({})
  const [paidLessons, setPaidLessons] = useState<Lesson[] | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [openCard, setOpenCard] = useState<LessonReportCard | null>(null)
  const [canStudentManage, setCanStudentManage] = useState(false)
  const [settingsLoading, setSettingsLoading] = useState(true)
  const [savingSetting, setSavingSetting] = useState(false)

  const load = useCallback(async () => {
    if (!user) return
    const [linked, paid] = await Promise.all([getLinkedStudents(user.id), getParentLessons(user.id)])
    const perChild = await Promise.all(linked.map((s) => getStudentLessons(s.id)))

    const byChild: Record<string, Lesson[]> = {}
    const summaries: ChildSummary[] = linked.map((s, i) => {
      const lessons = perChild[i]
      byChild[s.id] = lessons
      const upcoming = lessons.filter((l) => l.status === 'upcoming')
      const completed = lessons.filter((l) => l.status === 'completed')
      const counted = lessons.filter((l) => l.status !== 'cancelled')
      return {
        ...s,
        upcomingLessonsCount: upcoming.length,
        pendingConfirmationsCount: lessons.filter(
          (l) => l.report && !l.reportConfirmedAt && !l.dispute && canManageLessonReport(l, user.id),
        ).length,
        nextLesson: upcoming[0] ?? null,
        completedCount: completed.length,
        hoursLearned: Math.round((completed.reduce((sum, l) => sum + l.duration, 0) / 60) * 10) / 10,
        teacherCount: new Set(counted.map((l) => l.teacherId)).size,
        totalPaid: paid
          .filter((l) => l.studentId === s.id && l.status !== 'cancelled')
          .reduce((sum, l) => sum + l.price, 0),
      }
    })

    setLessonsByChild(byChild)
    setChildren(summaries)
    setPaidLessons(paid)
    setSelectedId((prev) => (prev && summaries.some((s) => s.id === prev) ? prev : summaries[0]?.id ?? null))
  }, [user])

  useEffect(() => {
    load()
  }, [load])

  useEffect(() => {
    if (!user) return
    let cancelled = false
    getStudentCanManageReports(user.id)
      .then((value) => { if (!cancelled) setCanStudentManage(value) })
      .finally(() => { if (!cancelled) setSettingsLoading(false) })
    return () => { cancelled = true }
  }, [user])

  async function handleToggleSetting() {
    if (!user || savingSetting) return
    const next = !canStudentManage
    setCanStudentManage(next) // optimistic — a plain preference, not a money action
    setSavingSetting(true)
    try {
      await setStudentCanManageReports(user.id, next)
    } catch {
      setCanStudentManage(!next)
    } finally {
      setSavingSetting(false)
    }
  }

  /** Reflect a just-confirmed/disputed report locally so the row leaves the attention area immediately. */
  const handleReportStatusChange = useCallback((lessonId: string, status: LessonReportCard['status']) => {
    setLessonsByChild((prev) => {
      const next: Record<string, Lesson[]> = {}
      for (const [childId, lessons] of Object.entries(prev)) {
        next[childId] = lessons.map((l) =>
          l.id === lessonId
            ? {
                ...l,
                reportConfirmedAt: status === 'confirmed' ? Date.now() : l.reportConfirmedAt,
                dispute:
                  status === 'dispute_open'
                    ? l.dispute ?? {
                        reason: 'other' as const,
                        note: '',
                        raisedBy: 'parent' as const,
                        raisedByUserId: user?.id ?? '',
                        raisedAt: Date.now(),
                        status: 'open' as const,
                      }
                    : l.dispute,
              }
            : l,
        )
      }
      return next
    })
  }, [user])

  const allLessons = useMemo(() => Object.values(lessonsByChild).flat(), [lessonsByChild])

  const actionableReports = useMemo(
    () =>
      user
        ? allLessons.filter((l) => l.report && !l.reportConfirmedAt && !l.dispute && canManageLessonReport(l, user.id))
        : [],
    [allLessons, user],
  )
  const openDisputes = useMemo(() => allLessons.filter((l) => l.dispute?.status === 'open'), [allLessons])

  const selectedChild = children?.find((c) => c.id === selectedId) ?? null
  const selectedLessons = selectedId ? lessonsByChild[selectedId] ?? [] : []

  const recentReports = useMemo(
    () =>
      selectedLessons
        .filter((l) => Boolean(l.report))
        .sort((a, b) => (b.reportSubmittedAt ?? 0) - (a.reportSubmittedAt ?? 0))
        .slice(0, 4),
    [selectedLessons],
  )

  const recentActivity = useMemo(
    () =>
      selectedLessons
        .filter((l) => l.status === 'upcoming' || l.status === 'pending')
        .slice(0, 4),
    [selectedLessons],
  )

  const childNameById = useCallback(
    (studentId: string) => children?.find((c) => c.id === studentId)?.name,
    [children],
  )

  const hasChildren = (children?.length ?? 0) > 0
  const multipleChildren = (children?.length ?? 0) > 1
  const attentionTotal = actionableReports.length + openDisputes.length

  return (
    <>
      {/* A parent's page announces its subject, not its owner — so the child band leads and the greeting is a single quiet line. */}
      <p className="text-sm text-muted-foreground">
        Panel rodzica{user?.firstName ? ` · ${user.firstName}` : ''}
      </p>

      <div className="mt-3">
        <ParentChildBand children={children} selectedId={selectedId} onSelect={setSelectedId} />
      </div>

      {hasChildren && (
        <div className="mt-5">
          {attentionTotal === 0 ? (
            <AllClearBanner
              message="Nic nie wymaga Twojej decyzji."
              hint="Raport z lekcji pojawi się tutaj, gdy nauczyciel go wyśle."
            />
          ) : (
            <Panel
              icon={AlertCircle}
              title="Wymaga Twojej decyzji"
              tone="attention"
              count={attentionTotal}
            >
              {actionableReports.length > 0 && (
                <>
                  <p className="border-b border-border px-5 py-2.5 text-xs leading-relaxed text-muted-foreground">
                    Potwierdzenie raportu przekazuje płatność nauczycielowi. Jeśli nie zareagujesz, nastąpi to
                    automatycznie po 24 godzinach.
                  </p>
                  <ul className="flex flex-col divide-y divide-border">
                    {actionableReports.map((lesson) => {
                      const card = lessonToReportCard(lesson)
                      if (!card) return null
                      return (
                        <ReportRow
                          key={lesson.id}
                          card={card}
                          counterpartyName={card.teacherName}
                          counterpartyColor={lesson.teacherColor}
                          contextLabel={multipleChildren ? childNameById(lesson.studentId) : undefined}
                          actionable
                          onOpen={() => setOpenCard(card)}
                        />
                      )
                    })}
                  </ul>
                </>
              )}

              {openDisputes.length > 0 && (
                <ul className="flex flex-col divide-y divide-border border-t border-border">
                  {openDisputes.map((lesson) => (
                    <li key={lesson.id} className="flex items-center gap-3 px-5 py-3">
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-destructive/10 text-destructive">
                        <ShieldAlert className="h-4 w-4" aria-hidden="true" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-foreground">{lesson.topic}</p>
                        <p className="truncate text-xs text-muted-foreground">
                          Zastrzeżenie w rozpatrywaniu · {lesson.teacherName} · {lesson.price} zł
                        </p>
                      </div>
                      <span className="shrink-0 text-xs text-muted-foreground">Czeka na Runbee</span>
                    </li>
                  ))}
                </ul>
              )}
            </Panel>
          )}
        </div>
      )}

      {/*
        Mobile order: what happened (reports) → what's coming (activity) →
        who teaches → money → notifications → settings → linking. A parent
        checking a phone wants the last report first, not a settings toggle.
      */}
      {hasChildren && selectedChild && (
        <div className="mt-5 flex flex-col gap-5 lg:grid lg:grid-cols-[minmax(0,1fr)_320px] lg:items-start lg:gap-6">
          <div className="contents lg:flex lg:flex-col lg:gap-5">
            <div className="order-1">
              <Panel icon={FileText} title={`Ostatnie raporty — ${selectedChild.name}`}>
                {recentReports.length === 0 ? (
                  <EmptyState
                    icon={FileText}
                    title="Brak raportów"
                    description="Raport pojawi się po pierwszej zakończonej lekcji."
                    className="py-8"
                  />
                ) : (
                  <ul className="flex flex-col divide-y divide-border">
                    {recentReports.map((lesson) => {
                      const card = lessonToReportCard(lesson)
                      if (!card) return null
                      return (
                        <ReportRow
                          key={lesson.id}
                          card={card}
                          counterpartyName={card.teacherName}
                          counterpartyColor={lesson.teacherColor}
                          actionable={isActionableBy(card, user?.id ?? '')}
                          onOpen={() => setOpenCard(card)}
                        />
                      )
                    })}
                  </ul>
                )}
                <PanelFooterLink href="/reports" icon={FileText}>
                  Wszystkie raporty
                </PanelFooterLink>
              </Panel>
            </div>

            <div className="order-2">
              <Panel icon={CalendarDays} title="Zaplanowane lekcje" count={recentActivity.length}>
                {recentActivity.length === 0 ? (
                  <EmptyState
                    icon={CalendarDays}
                    title="Brak zaplanowanych lekcji"
                    description={`${selectedChild.name} nie ma nadchodzących terminów.`}
                    className="py-8"
                    action={
                      <Link
                        href={`/marketplace?bookingForId=${selectedChild.id}&bookingForName=${encodeURIComponent(selectedChild.name)}`}
                      >
                        <Button size="sm" variant="outline">Znajdź nauczyciela</Button>
                      </Link>
                    }
                  />
                ) : (
                  <ul className="flex flex-col divide-y divide-border">
                    {recentActivity.map((lesson) => (
                      <li key={lesson.id} className="flex items-center gap-3 px-5 py-3">
                        <Avatar className="h-9 w-9 shrink-0">
                          <AvatarFallback color={lesson.teacherColor} className="text-[11px]">
                            {lesson.teacherInitials}
                          </AvatarFallback>
                        </Avatar>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold text-foreground">{lesson.topic}</p>
                          <p className="truncate text-xs text-muted-foreground">
                            {lesson.teacherName} · {lesson.date} o {lesson.time}
                          </p>
                        </div>
                        {lesson.status === 'pending' ? (
                          <span className="flex shrink-0 items-center gap-1 rounded-full bg-warning-surface px-2.5 py-0.5 text-[11px] font-medium text-warning-on-surface">
                            <Clock3 className="h-3 w-3" aria-hidden="true" />
                            <span className="hidden sm:inline">Czeka na nauczyciela</span>
                            <span className="sm:hidden">Czeka</span>
                          </span>
                        ) : (
                          <span className="shrink-0 text-xs font-semibold text-foreground">{lesson.price} zł</span>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </Panel>
            </div>
          </div>

          <div className="contents lg:flex lg:flex-col lg:gap-5">
            <div className="order-3">
              <ParentTeachersPanel lessons={selectedLessons} childName={selectedChild.name} />
            </div>
            <div className="order-4">
              <ParentSpendingPanel paidLessons={paidLessons} />
            </div>
            <div className="order-5">
              <NotificationsPanel initialNotifications={initialNotifications} />
            </div>
            <div className="order-6">
              <Panel icon={Settings2} title="Nadzór nad raportami">
                <label
                  htmlFor="studentCanManageReports"
                  className="flex w-full cursor-pointer items-start justify-between gap-3 px-5 py-4 transition-colors hover:bg-muted/40 has-disabled:cursor-not-allowed has-disabled:opacity-60"
                >
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-foreground">
                      Dziecko może samo potwierdzać raporty
                    </p>
                    <p className="mt-0.5 text-[11px] leading-relaxed text-muted-foreground">
                      {canStudentManage
                        ? `${selectedChild.name} może potwierdzać raporty samodzielnie. Ty nadal możesz to robić.`
                        : `Tylko Ty potwierdzasz raporty z lekcji ${selectedChild.name}.`}
                    </p>
                  </div>
                  {settingsLoading ? (
                    <Spinner className="mt-0.5 shrink-0 text-muted-foreground" />
                  ) : (
                    <Switch
                      id="studentCanManageReports"
                      checked={canStudentManage}
                      onCheckedChange={handleToggleSetting}
                      disabled={savingSetting}
                      className="mt-0.5 shrink-0"
                    />
                  )}
                </label>
              </Panel>
            </div>
            <div className="order-7">
              <ParentLinkStudentPanel defaultOpen={false} onLinked={load} />
            </div>
          </div>
        </div>
      )}

      {/* No child linked yet: the only useful action, given its own space. */}
      {children !== null && !hasChildren && (
        <div className="mx-auto mt-5 max-w-lg">
          <ParentLinkStudentPanel defaultOpen onLinked={load} />
        </div>
      )}

      {openCard && (
        <ReportDetailDialog
          card={openCard}
          viewerId={user?.id ?? ''}
          viewerRole="parent"
          onClose={() => setOpenCard(null)}
          onStatusChange={(lessonId, status) => {
            handleReportStatusChange(lessonId, status)
            setOpenCard((prev) => (prev ? { ...prev, status } : prev))
          }}
        />
      )}
    </>
  )
}

