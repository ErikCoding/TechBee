'use client'

import { useState } from 'react'
import {
  CheckCircle2, Loader2, ShieldAlert, Star, CalendarDays, User, Wallet, BookOpen, Info,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogBody, DialogFooter,
} from '@/components/ui/dialog'
import { StatusBadge } from '@/components/ui/status-badge'
import { LessonDisputeModal } from '@/components/dashboard/lesson-dispute-modal'
import { confirmLessonReport, getLessonById } from '@/services/lessons.service'
import { REPORT_STATUS_CONFIG, describeWaitingParty, isActionableBy } from '@/components/reports/report-status'
import { cn } from '@/lib/utils'
import type { Lesson, LessonReportCard } from '@/lib/types'

interface Props {
  card: LessonReportCard
  viewerId: string
  viewerRole?: 'student' | 'teacher' | 'parent' | 'admin'
  onClose: () => void
  onStatusChange?: (lessonId: string, status: LessonReportCard['status']) => void
}

function RatingRow({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center justify-between gap-3 py-1.5">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="flex items-center gap-0.5" aria-label={`${value} na 5`}>
        {[1, 2, 3, 4, 5].map((n) => (
          <Star
            key={n}
            className={cn('h-3.5 w-3.5', n <= value ? 'fill-primary text-primary' : 'fill-transparent text-muted-foreground/30')}
            aria-hidden="true"
          />
        ))}
      </span>
    </div>
  )
}

/**
 * One full report, opened from a row rather than rendered inline.
 *
 * Reports used to be shown everywhere as the same fixed-width chat
 * "payment request" card — fine inside a message thread, but as the only
 * representation it forced every surface (the /reports page, the parent
 * dashboard) into a grid of equal-weight cards where a report needing a
 * decision looked exactly like one settled weeks ago, and where the full
 * detail was truncated to fit.
 *
 * Lists now show compact rows and defer to this dialog for the whole
 * story: what the lesson was, both ratings, homework, the tutor's note,
 * who is currently waiting on whom, and — the part that was missing
 * entirely — what actually happens when you confirm or dispute.
 *
 * The two actions call the same confirmLessonReport / dispute flow as
 * before, still gated by `card.managerIds` from lib/report-permissions.ts.
 */
export function ReportDetailDialog({ card, viewerId, viewerRole, onClose, onStatusChange }: Props) {
  const [busy, setBusy] = useState<'confirm' | 'dispute' | null>(null)
  const [disputeLesson, setDisputeLesson] = useState<Lesson | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [localStatus, setLocalStatus] = useState<LessonReportCard['status'] | null>(null)

  const status = localStatus ?? card.status
  const config = REPORT_STATUS_CONFIG[status]
  const canAct = isActionableBy({ ...card, status }, viewerId)
  const waiting = describeWaitingParty(status, card, viewerId, viewerRole)

  async function handleConfirm() {
    setBusy('confirm')
    setError(null)
    try {
      const lesson = await getLessonById(card.lessonId)
      if (!lesson) throw new Error('Lesson not found')
      await confirmLessonReport(lesson, viewerId)
      setLocalStatus('confirmed')
      onStatusChange?.(card.lessonId, 'confirmed')
    } catch {
      setError('Nie udało się potwierdzić. Spróbuj ponownie.')
    } finally {
      setBusy(null)
    }
  }

  async function handleOpenDispute() {
    setBusy('dispute')
    setError(null)
    try {
      const lesson = await getLessonById(card.lessonId)
      if (!lesson) throw new Error('Lesson not found')
      setDisputeLesson(lesson)
    } catch {
      setError('Nie udało się otworzyć zgłoszenia. Spróbuj ponownie.')
    } finally {
      setBusy(null)
    }
  }

  return (
    <>
      <Dialog open onOpenChange={(open) => { if (!open && !busy) onClose() }}>
        <DialogContent showClose={!busy} className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Raport z lekcji</DialogTitle>
            <DialogDescription>„{card.topic}"</DialogDescription>
          </DialogHeader>

          <DialogBody>
            <StatusBadge tone={config.tone} className="w-fit">{config.label}</StatusBadge>

            {/* Who is waiting for whom — previously nowhere on the page. */}
            {waiting && (
              <p className="flex items-start gap-2 rounded-lg bg-muted/60 px-3 py-2 text-xs leading-relaxed text-muted-foreground">
                <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                {waiting}
              </p>
            )}

            <dl className="grid grid-cols-1 gap-px overflow-hidden rounded-xl border border-border bg-border sm:grid-cols-2">
              {[
                { icon: User, label: 'Nauczyciel', value: card.teacherName },
                { icon: BookOpen, label: 'Uczeń', value: card.studentName },
                { icon: Wallet, label: 'Kwota lekcji', value: `${card.price} zł` },
                { icon: CalendarDays, label: 'Kolejny temat', value: card.nextTopic || '—' },
              ].map(({ icon: Icon, label, value }) => (
                <div key={label} className="flex items-center gap-2 bg-card px-3 py-2.5">
                  <Icon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
                  <div className="min-w-0">
                    <dt className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</dt>
                    <dd className="truncate text-xs font-semibold text-foreground">{value}</dd>
                  </div>
                </div>
              ))}
            </dl>

            <div className="rounded-xl border border-border px-3 py-2">
              <RatingRow label="Postęp ucznia" value={card.progressRating} />
              <RatingRow label="Zaangażowanie" value={card.engagementRating} />
            </div>

            {card.homework && (
              <div className="rounded-lg bg-muted/60 px-3 py-2 text-xs leading-relaxed text-foreground">
                <span className="font-semibold">Zadanie domowe: </span>
                {card.homework}
              </div>
            )}
            {card.tutorNote && (
              <div className="rounded-lg bg-muted/60 px-3 py-2 text-xs leading-relaxed text-foreground">
                <span className="font-semibold">Notatka nauczyciela: </span>
                {card.tutorNote}
              </div>
            )}

            {/* The consequence of each action, spelled out before the buttons. */}
            {canAct && (
              <div className="flex flex-col gap-1.5 rounded-lg border border-border px-3 py-2.5 text-[11px] leading-relaxed text-muted-foreground">
                <p>
                  <span className="font-semibold text-foreground">Potwierdzam</span> — zgadzasz się z raportem, a{' '}
                  {card.price} zł trafia do nauczyciela.
                </p>
                <p>
                  <span className="font-semibold text-foreground">Zgłaszam zastrzeżenie</span> — płatność zostaje
                  wstrzymana, a sprawę rozpatruje administrator Runbee.
                </p>
              </div>
            )}

            {error && <p className="text-xs text-destructive">{error}</p>}
          </DialogBody>

          <DialogFooter>
            {canAct ? (
              <div className="flex w-full flex-col gap-2 sm:flex-row">
                <Button
                  variant="outline"
                  onClick={handleOpenDispute}
                  disabled={busy !== null}
                  className="w-full text-destructive hover:text-destructive sm:flex-1"
                >
                  {busy === 'dispute' ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldAlert className="h-4 w-4" />}
                  Zgłaszam zastrzeżenie
                </Button>
                <Button onClick={handleConfirm} disabled={busy !== null} className="w-full font-semibold sm:flex-1">
                  {busy === 'confirm' ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                  Potwierdzam
                </Button>
              </div>
            ) : (
              <Button variant="outline" onClick={onClose} className="w-full">
                Zamknij
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {disputeLesson && (
        <LessonDisputeModal
          lesson={disputeLesson}
          onClose={() => setDisputeLesson(null)}
          onSubmitted={() => {
            setDisputeLesson(null)
            setLocalStatus('dispute_open')
            onStatusChange?.(card.lessonId, 'dispute_open')
          }}
        />
      )}
    </>
  )
}
