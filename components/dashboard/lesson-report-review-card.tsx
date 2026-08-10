'use client'

import { useState } from 'react'
import { CheckCircle2, Loader2, AlertTriangle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { confirmLessonReport } from '@/services/lessons.service'
import { LessonDisputeModal } from '@/components/dashboard/lesson-dispute-modal'
import type { Lesson } from '@/lib/types'

interface Props {
  lesson: Lesson
  confirmedByUserId: string
  onResolved: () => void
  /** Shown above the report content — lets the same card read naturally on both the student dashboard ("z {teacher}") and the parent dashboard ("dla {student}, z {teacher}"). */
  contextLabel?: string
}

/**
 * The teacher's report for a completed lesson, with Confirm/Dispute
 * actions for whoever has confirmation authority (see
 * Lesson.confirmingPartyId — the student, or their linked parent).
 * Confirming releases the held payment to the teacher; disputing parks
 * it until an admin resolves it (see services/lessons.service.ts).
 */
export function LessonReportReviewCard({ lesson, confirmedByUserId, onResolved, contextLabel }: Props) {
  const [confirming, setConfirming] = useState(false)
  const [disputeOpen, setDisputeOpen] = useState(false)
  const report = lesson.report
  if (!report) return null

  async function handleConfirm() {
    setConfirming(true)
    try {
      await confirmLessonReport(lesson, confirmedByUserId)
      onResolved()
    } finally {
      setConfirming(false)
    }
  }

  return (
    <div className="rounded-xl border border-yellow-500/30 bg-yellow-500/5 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-foreground">{lesson.topic}</p>
          <p className="truncate text-xs text-muted-foreground">
            {contextLabel ?? `z ${lesson.teacherName}`} · {lesson.date}
          </p>
        </div>
        <span className="shrink-0 text-xs font-semibold text-foreground">{lesson.price} zł</span>
      </div>

      <div className="mt-3 flex flex-col gap-1.5 text-xs text-muted-foreground">
        <p><span className="font-medium text-foreground">Temat: </span>{report.topic}</p>
        <p><span className="font-medium text-foreground">Postęp: </span>{report.progressRating}/5 · <span className="font-medium text-foreground">Zaangażowanie: </span>{report.engagementRating}/5</p>
        {report.homework && <p><span className="font-medium text-foreground">Zadanie domowe: </span>{report.homework}</p>}
        {report.tutorNote && <p><span className="font-medium text-foreground">Notatka: </span>{report.tutorNote}</p>}
        {report.nextTopic && <p><span className="font-medium text-foreground">Następnym razem: </span>{report.nextTopic}</p>}
      </div>

      <div className="mt-3 flex items-center gap-2">
        <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setDisputeOpen(true)} disabled={confirming}>
          <AlertTriangle className="mr-1 h-3 w-3" aria-hidden="true" />
          Zgłoś spór
        </Button>
        <Button size="sm" className="h-7 bg-[#F4B400] text-[#0A0A0A] hover:bg-[#FBBF24] text-xs font-semibold" onClick={handleConfirm} disabled={confirming}>
          {confirming ? <Loader2 className="mr-1 h-3 w-3 animate-spin" aria-hidden="true" /> : <CheckCircle2 className="mr-1 h-3 w-3" aria-hidden="true" />}
          Potwierdź raport
        </Button>
      </div>

      {disputeOpen && (
        <LessonDisputeModal
          lesson={lesson}
          onClose={() => setDisputeOpen(false)}
          onSubmitted={() => {
            setDisputeOpen(false)
            onResolved()
          }}
        />
      )}
    </div>
  )
}
