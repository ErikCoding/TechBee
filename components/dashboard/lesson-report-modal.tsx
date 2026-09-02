'use client'

import { useState } from 'react'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogBody, DialogFooter } from '@/components/ui/dialog'
import { FormError } from '@/components/ui/form-error'
import { submitLessonReport } from '@/services/lessons.service'
import { cn } from '@/lib/utils'
import type { Lesson, LessonReport } from '@/lib/types'

interface Props {
  lesson: Lesson
  onClose: () => void
  /** Passed the just-submitted report so the caller can patch its local lesson list instead of refetching everything (see TeacherLessonsSection). */
  onSubmitted: (report: LessonReport) => void
}

function RatingPicker({ label, value, onChange, disabled }: { label: string; value: number; onChange: (n: number) => void; disabled?: boolean }) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-xs font-medium text-foreground">{label}</span>
      <div className="flex gap-1.5" role="radiogroup" aria-label={label}>
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            role="radio"
            aria-checked={value === n}
            aria-label={String(n)}
            onClick={() => onChange(n)}
            disabled={disabled}
            className={cn(
              'flex h-8 w-8 items-center justify-center rounded-lg border text-xs font-semibold transition-colors disabled:pointer-events-none disabled:opacity-60',
              value === n ? 'border-primary bg-primary text-primary-foreground' : 'border-border text-muted-foreground hover:bg-muted',
            )}
          >
            {n}
          </button>
        ))}
      </div>
    </div>
  )
}

const fieldClass =
  'w-full resize-none rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:opacity-60'

/**
 * The teacher's required last step after a lesson (see LessonReport in
 * lib/types.ts) — this is what starts the confirmation window that
 * ultimately releases the held payment (see submitLessonReport in
 * lessons.service.ts). Only ever shown for `status === 'completed' &&
 * !report` lessons (see TeacherLessonsSection).
 */
export function LessonReportModal({ lesson, onClose, onSubmitted }: Props) {
  const [topic, setTopic] = useState(lesson.topic)
  const [progressRating, setProgressRating] = useState(4)
  const [engagementRating, setEngagementRating] = useState(4)
  const [homework, setHomework] = useState('')
  const [tutorNote, setTutorNote] = useState('')
  const [nextTopic, setNextTopic] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit() {
    if (!topic.trim()) {
      setError('Uzupełnij temat lekcji.')
      return
    }
    setSubmitting(true)
    setError(null)
    try {
      const report: LessonReport = {
        topic: topic.trim(),
        progressRating,
        engagementRating,
        homework: homework.trim() || undefined,
        tutorNote: tutorNote.trim() || undefined,
        nextTopic: nextTopic.trim() || undefined,
      }
      await submitLessonReport(lesson, report)
      onSubmitted(report)
    } catch {
      setError('Nie udało się zapisać raportu. Spróbuj ponownie.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open onOpenChange={(open) => { if (!open && !submitting) onClose() }}>
      <DialogContent showClose={!submitting} className="max-w-md">
        <DialogHeader>
          <DialogTitle>Raport z lekcji</DialogTitle>
          <DialogDescription>z {lesson.studentName} · {lesson.date}</DialogDescription>
        </DialogHeader>

        <DialogBody>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="reportTopic" className="text-xs font-medium text-foreground">Co przerobiliście na lekcji</label>
            <textarea
              id="reportTopic"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              rows={2}
              disabled={submitting}
              className={fieldClass}
            />
          </div>

          <RatingPicker label="Ocena postępu ucznia" value={progressRating} onChange={setProgressRating} disabled={submitting} />
          <RatingPicker label="Zaangażowanie ucznia" value={engagementRating} onChange={setEngagementRating} disabled={submitting} />

          <div className="flex flex-col gap-1.5">
            <label htmlFor="reportHomework" className="text-xs font-medium text-foreground">Zadanie domowe / co ćwiczyć (opcjonalnie)</label>
            <textarea
              id="reportHomework"
              value={homework}
              onChange={(e) => setHomework(e.target.value)}
              rows={2}
              placeholder="np. Przećwiczyć programowanie sterownika PLC..."
              disabled={submitting}
              className={fieldClass}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="reportNote" className="text-xs font-medium text-foreground">Notatka dla rodzica/ucznia (opcjonalnie)</label>
            <textarea
              id="reportNote"
              value={tutorNote}
              onChange={(e) => setTutorNote(e.target.value)}
              rows={2}
              disabled={submitting}
              className={fieldClass}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="reportNextTopic" className="text-xs font-medium text-foreground">Planowany temat kolejnej lekcji (opcjonalnie)</label>
            <input
              id="reportNextTopic"
              value={nextTopic}
              onChange={(e) => setNextTopic(e.target.value)}
              disabled={submitting}
              className={cn(fieldClass, 'resize-auto')}
            />
          </div>

          <FormError>{error}</FormError>
        </DialogBody>

        <DialogFooter className="flex-col items-stretch gap-2">
          <Button onClick={handleSubmit} disabled={submitting} className="w-full font-semibold">
            {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Wyślij raport
          </Button>
          <p className="text-center text-[11px] text-muted-foreground">
            Płatność zostanie zwolniona po potwierdzeniu raportu (automatycznie po 24h, jeśli nikt nie zareaguje).
          </p>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
