'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { UserPlus, Loader2, AlertCircle, CalendarDays, Clock3, Wallet } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { useAuth } from '@/lib/auth-context'
import { getLinkedStudents, redeemLinkCode } from '@/services/family-link.service'
import { getStudentLessons } from '@/services/lessons.service'
import { LessonReportReviewCard } from '@/components/dashboard/lesson-report-review-card'
import type { LinkedStudentSummary, Lesson } from '@/lib/types'

/**
 * The core of the parent dashboard: a "redeem a student's link code"
 * form, plus a card per already-linked student with a live wallet
 * balance and lesson counts. `getLinkedStudents` (family-link.service.ts)
 * leaves lesson counts at 0 to avoid a circular import with
 * lessons.service.ts — this component overlays the real numbers itself
 * by fetching each linked student's lessons directly.
 */
export function ParentLinkedStudents() {
  const { user } = useAuth()
  const [students, setStudents] = useState<LinkedStudentSummary[] | null>(null)
  const [reportsToConfirm, setReportsToConfirm] = useState<Lesson[]>([])
  const [code, setCode] = useState('')
  const [redeeming, setRedeeming] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const loadStudents = useCallback(async () => {
    if (!user) return
    const base = await getLinkedStudents(user.id)
    const allReports: Lesson[] = []
    const enriched = await Promise.all(
      base.map(async (s) => {
        const lessons = await getStudentLessons(s.id)
        const upcomingLessonsCount = lessons.filter((l) => l.status === 'upcoming').length
        const pending = lessons.filter((l) => l.report && !l.reportConfirmedAt && !l.dispute && l.confirmingPartyId === user.id)
        allReports.push(...pending)
        return { ...s, upcomingLessonsCount, pendingConfirmationsCount: pending.length }
      }),
    )
    setStudents(enriched)
    setReportsToConfirm(allReports)
  }, [user])

  useEffect(() => {
    loadStudents()
  }, [loadStudents])

  async function handleRedeem(e: React.FormEvent) {
    e.preventDefault()
    if (!user || !code.trim()) return
    setRedeeming(true)
    setError(null)
    try {
      const result = await redeemLinkCode(user.id, code.trim())
      if (!result.ok) {
        setError(result.error)
        return
      }
      setCode('')
      await loadStudents()
    } finally {
      setRedeeming(false)
    }
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Reports awaiting your confirmation — releases the held payment (see LessonReportReviewCard) */}
      {reportsToConfirm.length > 0 && user && (
        <section className="rounded-2xl border border-yellow-500/30 bg-yellow-500/5 p-6">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-foreground">Raporty do potwierdzenia</h2>
            <Badge className="bg-yellow-500 text-[#0A0A0A]">{reportsToConfirm.length}</Badge>
          </div>
          <div className="mt-4 flex flex-col gap-3">
            {reportsToConfirm.map((lesson) => (
              <LessonReportReviewCard
                key={lesson.id}
                lesson={lesson}
                confirmedByUserId={user.id}
                onResolved={loadStudents}
                contextLabel={`dla ${lesson.studentName}, z ${lesson.teacherName}`}
              />
            ))}
          </div>
        </section>
      )}

      <section className="rounded-2xl border border-border bg-card p-6">
        <h2 className="font-semibold text-foreground">Połącz konto ucznia</h2>
        <p className="mt-1 text-sm text-muted-foreground">Wpisz kod, który uczeń wygenerował na swoim koncie (panel ucznia → „Konto rodzica").</p>
        <form onSubmit={handleRedeem} className="mt-3 flex flex-col gap-2 sm:flex-row">
          <Input
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            placeholder="np. 7K9XQP"
            className="font-mono uppercase tracking-widest sm:max-w-[220px]"
            maxLength={6}
          />
          <Button type="submit" disabled={redeeming || !code.trim()} className="bg-[#F4B400] text-[#0A0A0A] hover:bg-[#FBBF24] font-semibold">
            {redeeming ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <UserPlus className="h-4 w-4" aria-hidden="true" />}
            Połącz
          </Button>
        </form>
        {error && (
          <div className="mt-3 flex items-start gap-2 rounded-lg bg-destructive/10 px-3 py-2 text-xs text-destructive">
            <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            {error}
          </div>
        )}
      </section>

      <section className="rounded-2xl border border-border bg-card p-6">
        <h2 className="font-semibold text-foreground">Połączeni uczniowie</h2>
        {students === null ? (
          <p className="mt-4 text-sm text-muted-foreground">Ładowanie…</p>
        ) : students.length === 0 ? (
          <div className="mt-6 flex flex-col items-center gap-2 py-8 text-center">
            <UserPlus className="h-8 w-8 text-muted-foreground/40" aria-hidden="true" />
            <p className="text-sm text-muted-foreground">Nie masz jeszcze połączonych uczniów — użyj kodu powyżej.</p>
          </div>
        ) : (
          <div className="mt-4 flex flex-col gap-3">
            {students.map((s) => (
              <div key={s.id} className="flex flex-col gap-3 rounded-xl border border-border p-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex min-w-0 items-center gap-3">
                  <div
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-sm font-bold text-white"
                    style={{ backgroundColor: s.avatarColor }}
                    aria-hidden="true"
                  >
                    {s.initials}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-foreground">{s.name}</p>
                    <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Wallet className="h-3 w-3" aria-hidden="true" />
                        {s.walletBalance.toLocaleString('pl-PL')} zł
                      </span>
                      <span className="flex items-center gap-1">
                        <CalendarDays className="h-3 w-3" aria-hidden="true" />
                        {s.upcomingLessonsCount} nadchodzących
                      </span>
                      {s.pendingConfirmationsCount > 0 && (
                        <span className="flex items-center gap-1 font-medium text-yellow-600 dark:text-yellow-400">
                          <Clock3 className="h-3 w-3" aria-hidden="true" />
                          {s.pendingConfirmationsCount} do potwierdzenia
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <Link href={`/marketplace?bookingForId=${s.id}&bookingForName=${encodeURIComponent(s.name)}`}>
                    <Button size="sm" variant="outline" className="h-8 text-xs">Zarezerwuj lekcję</Button>
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
