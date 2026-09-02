'use client'

import { useState } from 'react'
import { CheckCircle2, Clock, Loader2, ShieldAlert, Star } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { StatusBadge } from '@/components/ui/status-badge'
import { REPORT_STATUS_CONFIG, describeWaitingParty, isActionableBy } from '@/components/reports/report-status'
import { LessonDisputeModal } from '@/components/dashboard/lesson-dispute-modal'
import { confirmLessonReport, getLessonById } from '@/services/lessons.service'
import { cn } from '@/lib/utils'
import type { Lesson, LessonReportCard } from '@/lib/types'

interface Props {
  card: LessonReportCard
  viewerId: string
  /** The signed-in viewer's account role — used only to word the read-only "why can't I act on this" hint below (e.g. tell a student their parent is the one who needs to confirm, instead of a generic message). Optional and display-only: doesn't affect `canAct`, which stays governed entirely by `card.managerIds` (see lib/report-permissions.ts). */
  viewerRole?: 'student' | 'teacher' | 'parent' | 'admin'
  /** Called right after a successful confirm/dispute with the new status — lets a one-shot list (e.g. components/dashboard/reports-client.tsx, which doesn't have chat's live onSnapshot subscription) update its local state immediately instead of needing a refetch. Optional: chat itself doesn't need it, since its own subscription already picks up the write. */
  onStatusChange?: (lessonId: string, status: LessonReportCard['status']) => void
}

/**
 * Status labels now come from the one shared vocabulary in
 * components/reports/report-status.ts, so a report reads identically in
 * chat, on /reports, on the parent dashboard and in the detail dialog.
 */
const STATUS_CONFIG = REPORT_STATUS_CONFIG

function RatingStars({ value }: { value: number }) {
  return (
    <div className="flex items-center gap-0.5" aria-label={`Ocena ${value}/5`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Star key={n} className={cn('h-3 w-3', n <= value ? 'fill-primary text-primary' : 'fill-transparent text-muted-foreground/30')} aria-hidden="true" />
      ))}
    </div>
  )
}

/**
 * A lesson report delivered as a rich, interactive chat "card" — modeled
 * on a payment-request bubble — instead of a dashboard list entry (see
 * LessonReportCard in lib/types.ts). Only the resolved confirming party
 * (the student, or their linked parent) sees Confirm/Zgłoś spór actions;
 * everyone else sees a live, read-only status pill that updates itself
 * the moment the card's status changes (see updateReportCardStatus in
 * chat.service.ts) — no refresh needed, since this renders straight from
 * the thread's existing real-time subscription. The full Lesson doc is
 * only fetched lazily, right when the viewer actually acts on the card.
 */
export function ReportCardMessage({ card, viewerId, viewerRole, onStatusChange }: Props) {
  const [busy, setBusy] = useState<'confirm' | 'dispute' | null>(null)
  const [disputeLesson, setDisputeLesson] = useState<Lesson | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [localStatus, setLocalStatus] = useState<LessonReportCard['status'] | null>(null)
  const [justConfirmed, setJustConfirmed] = useState(false)

  // `localStatus` lets this card reflect a just-completed action
  // instantly, even in a context with no live subscription (see
  // onStatusChange above) — it always defers to a newer `card.status`
  // from the parent once that catches up (e.g. chat's onSnapshot, or a
  // fresh /reports fetch), so it can never get stuck showing something
  // stale.
  const effectiveStatus = localStatus ?? card.status
  const status = STATUS_CONFIG[effectiveStatus]
  const canAct = isActionableBy({ ...card, status: effectiveStatus }, viewerId)

  async function handleConfirm() {
    setBusy('confirm')
    setError(null)
    try {
      const lesson = await getLessonById(card.lessonId)
      if (!lesson) throw new Error('Lesson not found')
      await confirmLessonReport(lesson, viewerId)
      setLocalStatus('confirmed')
      setJustConfirmed(true)
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

  function handleDisputeSubmitted() {
    setDisputeLesson(null)
    setLocalStatus('dispute_open')
    onStatusChange?.(card.lessonId, 'dispute_open')
  }

  return (
    <div className="w-full max-w-[340px] overflow-hidden rounded-2xl border border-border bg-card shadow-sm animate-fade-in-up">
      <div className="flex items-center justify-between gap-3 bg-accent/60 px-4 py-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent text-bee-yellow-dark">
            <Clock className="h-4 w-4" aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <p className="text-[13px] font-semibold text-foreground">Raport z lekcji</p>
            <p className="truncate text-[11px] text-muted-foreground">{card.topic}</p>
          </div>
        </div>
        <p className="shrink-0 text-sm font-bold text-foreground">{card.price} zł</p>
      </div>

      <div className="flex flex-col gap-2.5 px-4 py-3">
        <div className="flex items-center justify-between text-[12px]">
          <span className="text-muted-foreground">Postęp ucznia</span>
          <RatingStars value={card.progressRating} />
        </div>
        <div className="flex items-center justify-between text-[12px]">
          <span className="text-muted-foreground">Zaangażowanie</span>
          <RatingStars value={card.engagementRating} />
        </div>

        {card.homework && (
          <div className="rounded-lg bg-muted/60 px-2.5 py-2 text-[12px] leading-relaxed text-foreground">
            <span className="font-medium">Zadanie domowe: </span>{card.homework}
          </div>
        )}
        {card.tutorNote && (
          <div className="rounded-lg bg-muted/60 px-2.5 py-2 text-[12px] leading-relaxed text-foreground">
            <span className="font-medium">Notatka: </span>{card.tutorNote}
          </div>
        )}
        {card.nextTopic && <p className="text-[11px] text-muted-foreground">Kolejny temat: {card.nextTopic}</p>}

        <StatusBadge tone={status.tone} className="mt-0.5 w-fit">
          {status.label}
        </StatusBadge>

        {error && <p className="text-[11px] text-destructive">{error}</p>}

        {justConfirmed && (
          <p className="flex items-center gap-1.5 text-[11px] font-medium text-success-on-surface">
            <CheckCircle2 className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            Potwierdzono — płatność została zwolniona.
          </p>
        )}

        {canAct && (
          <div className="mt-1 flex gap-2">
            <Button
              onClick={handleConfirm}
              disabled={busy !== null}
              size="sm"
              className="h-8 flex-1 text-xs font-semibold"
            >
              {busy === 'confirm' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
              Potwierdź
            </Button>
            <Button
              onClick={handleOpenDispute}
              disabled={busy !== null}
              size="sm"
              variant="destructive"
              className="h-8 flex-1 text-xs font-semibold"
            >
              {busy === 'dispute' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ShieldAlert className="h-3.5 w-3.5" />}
              Zgłoś spór
            </Button>
          </div>
        )}

        {/* Who this is waiting on, in the same words used everywhere else. */}
        {!canAct && (
          <p className="text-[11px] leading-relaxed text-muted-foreground">
            {describeWaitingParty(effectiveStatus, card, viewerId, viewerRole)}
          </p>
        )}
      </div>

      {disputeLesson && (
        <LessonDisputeModal lesson={disputeLesson} onClose={() => setDisputeLesson(null)} onSubmitted={handleDisputeSubmitted} />
      )}
    </div>
  )
}
