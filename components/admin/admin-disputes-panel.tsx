'use client'

import { useEffect, useState } from 'react'
import { Scale, Check, X, Loader2, Mail, Phone, UserRound } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useAuth } from '@/lib/auth-context'
import { getOpenDisputes, resolveDispute } from '@/services/lessons.service'
import { getUserProfileById } from '@/services/auth.service'
import type { AuthUser, Lesson, LessonDisputeReason } from '@/lib/types'

const reasonLabels: Record<LessonDisputeReason, string> = {
  tutor_no_show: 'Nauczyciel się nie pojawił',
  not_as_described: 'Lekcja przebiegła inaczej niż opisano',
  quality_issue: 'Problem z jakością lekcji',
  other: 'Inny powód',
}

function DisputeRow({ lesson, adminId, onResolved }: { lesson: Lesson; adminId: string; onResolved: (id: string) => void }) {
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState<'teacher' | 'payer' | null>(null)
  const [profiles, setProfiles] = useState<{ teacher: AuthUser | null; student: AuthUser | null; payer: AuthUser | null } | null>(null)
  const dispute = lesson.dispute

  useEffect(() => {
    let cancelled = false
    Promise.all([
      getUserProfileById(lesson.teacherId).catch(() => null),
      getUserProfileById(lesson.studentId).catch(() => null),
      getUserProfileById(lesson.payerId ?? lesson.studentId).catch(() => null),
    ]).then(([teacher, student, payer]) => {
      if (!cancelled) setProfiles({ teacher, student, payer })
    })
    return () => {
      cancelled = true
    }
  }, [lesson.teacherId, lesson.studentId, lesson.payerId])

  if (!dispute) return null

  async function handleResolve(resolution: 'teacher' | 'payer') {
    setBusy(resolution)
    try {
      await resolveDispute(lesson, resolution, note.trim(), adminId)
      onResolved(lesson.id)
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-card">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0 px-4 pt-4">
          <p className="text-sm font-semibold text-foreground">{lesson.topic}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {lesson.teacherName} ↔ {lesson.studentName}
            {lesson.payerRole === 'parent' ? ' (płaci rodzic)' : ''} · {lesson.date} · {lesson.price} zł
          </p>
        </div>
        <Badge variant="secondary" className="mr-4 mt-4 text-[10px]">{reasonLabels[dispute.reason]}</Badge>
      </div>

      <div className="mt-4 grid divide-y divide-border border-y border-border md:grid-cols-2 md:divide-x md:divide-y-0">
        <div className="bg-muted/30 p-4">
          <div className="mb-3 flex items-center gap-2">
            <UserRound className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Strona ucznia / płatnika</p>
          </div>
          <p className="text-sm font-semibold text-foreground">{profiles?.student?.name ?? lesson.studentName}</p>
          <div className="mt-2 flex flex-col gap-1 text-xs text-muted-foreground">
            <p className="flex items-center gap-1.5"><Mail className="h-3.5 w-3.5" aria-hidden="true" />{profiles?.student?.email ?? 'Brak e-maila w profilu'}</p>
            {lesson.payerRole === 'parent' && (
              <p className="flex items-center gap-1.5"><Mail className="h-3.5 w-3.5" aria-hidden="true" />Płatnik: {profiles?.payer?.email ?? lesson.payerId ?? 'rodzic'}</p>
            )}
            <p className="flex items-center gap-1.5"><Phone className="h-3.5 w-3.5" aria-hidden="true" />Telefon nie jest jeszcze zbierany w profilu.</p>
          </div>
          <div className="mt-3 rounded-xl border border-border bg-card px-3 py-2 text-xs leading-relaxed text-muted-foreground">
            <p><span className="font-medium text-foreground">Zgłosił: </span>{dispute.raisedBy === 'parent' ? 'rodzic' : 'uczeń'}</p>
            <p className="mt-1"><span className="font-medium text-foreground">Opis: </span>{dispute.note}</p>
          </div>
        </div>

        <div className="p-4">
          <div className="mb-3 flex items-center gap-2">
            <UserRound className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Strona nauczyciela</p>
          </div>
          <p className="text-sm font-semibold text-foreground">{profiles?.teacher?.name ?? lesson.teacherName}</p>
          <div className="mt-2 flex flex-col gap-1 text-xs text-muted-foreground">
            <p className="flex items-center gap-1.5"><Mail className="h-3.5 w-3.5" aria-hidden="true" />{profiles?.teacher?.email ?? 'Brak e-maila w profilu'}</p>
            <p className="flex items-center gap-1.5"><Phone className="h-3.5 w-3.5" aria-hidden="true" />Telefon nie jest jeszcze zbierany w profilu.</p>
          </div>
          {lesson.report ? (
            <div className="mt-3 rounded-xl border border-border bg-muted/35 px-3 py-2 text-xs leading-relaxed text-muted-foreground">
              <p className="font-medium text-foreground">Raport nauczyciela</p>
              <p className="mt-1">{lesson.report.topic}</p>
              <p className="mt-0.5">Postęp: {lesson.report.progressRating}/5 · Zaangażowanie: {lesson.report.engagementRating}/5</p>
              {lesson.report.tutorNote && <p className="mt-0.5">Notatka: {lesson.report.tutorNote}</p>}
              {lesson.report.homework && <p className="mt-0.5">Zadanie: {lesson.report.homework}</p>}
            </div>
          ) : (
            <p className="mt-3 rounded-xl border border-border bg-muted/35 px-3 py-2 text-xs text-muted-foreground">Brak raportu nauczyciela w tej lekcji.</p>
          )}
        </div>
      </div>

      <div className="flex flex-col gap-1.5 px-4 pt-4">
        <label htmlFor={`note-${lesson.id}`} className="text-xs font-medium text-foreground">Notatka rozstrzygnięcia (opcjonalnie)</label>
        <textarea
          id={`note-${lesson.id}`}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={2}
          className="w-full resize-none rounded-lg border border-border bg-background px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        />
      </div>

      <div className="flex flex-wrap items-center gap-2 px-4 py-4">
        <Button size="sm" variant="outline" disabled={busy !== null} onClick={() => handleResolve('payer')} className="text-xs">
          {busy === 'payer' ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <X className="mr-1 h-3.5 w-3.5" />}
          Na korzyść ucznia/rodzica (zwrot)
        </Button>
        <Button size="sm" disabled={busy !== null} onClick={() => handleResolve('teacher')} className="text-xs font-semibold">
          {busy === 'teacher' ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <Check className="mr-1 h-3.5 w-3.5" />}
          Na korzyść nauczyciela (zwolnij płatność)
        </Button>
      </div>
    </div>
  )
}

export function AdminDisputesPanel() {
  const { user } = useAuth()
  const [disputes, setDisputes] = useState<Lesson[] | null>(null)

  useEffect(() => {
    getOpenDisputes().then(setDisputes)
  }, [])

  function handleResolved(id: string) {
    setDisputes((prev) => (prev ?? []).filter((l) => l.id !== id))
  }

  return (
    <section className="animate-fade-in-up overflow-hidden rounded-2xl border border-border" style={{ animationDelay: '60ms' }}>
      <div className="flex items-center gap-2 bg-muted/40 px-5 py-3.5">
        <Scale className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
        <h2 className="text-sm font-semibold text-foreground">Otwarte spory</h2>
        {disputes !== null && disputes.length > 0 && (
          <Badge className="ml-auto">{disputes.length}</Badge>
        )}
      </div>

      <div className="bg-card p-5">
        {disputes === null ? (
          <div className="h-20 animate-pulse rounded-xl bg-muted" />
        ) : disputes.length === 0 ? (
          <p className="text-sm text-muted-foreground">Brak otwartych sporów.</p>
        ) : !user ? (
          <p className="text-sm text-muted-foreground">Ładowanie konta administratora…</p>
        ) : (
          <div className="flex flex-col gap-3">
            {disputes.map((lesson) => (
              <DisputeRow key={lesson.id} lesson={lesson} adminId={user.id} onResolved={handleResolved} />
            ))}
          </div>
        )}
      </div>
    </section>
  )
}
