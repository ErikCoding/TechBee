'use client'

import { useState } from 'react'
import { X, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { submitLessonReport } from '@/services/lessons.service'
import { cn } from '@/lib/utils'
import type { Lesson } from '@/lib/types'

interface Props {
  lesson: Lesson
  onClose: () => void
  onSubmitted: () => void
}

function RatingPicker({ label, value, onChange }: { label: string; value: number; onChange: (n: number) => void }) {
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
            className={cn(
              'flex h-8 w-8 items-center justify-center rounded-lg border text-xs font-semibold transition-colors',
              value === n ? 'border-[#F4B400] bg-[#F4B400] text-[#0A0A0A]' : 'border-border text-muted-foreground hover:bg-muted',
            )}
          >
            {n}
          </button>
        ))}
      </div>
    </div>
  )
}

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
      await submitLessonReport(lesson, {
        topic: topic.trim(),
        progressRating,
        engagementRating,
        homework: homework.trim() || undefined,
        tutorNote: tutorNote.trim() || undefined,
        nextTopic: nextTopic.trim() || undefined,
      })
      onSubmitted()
    } catch {
      setError('Nie udało się zapisać raportu. Spróbuj ponownie.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={() => !submitting && onClose()} aria-hidden="true" />
      <div className="relative flex max-h-[90vh] w-full max-w-md flex-col rounded-2xl border border-border bg-card shadow-xl animate-fade-in-up">
        <div className="flex items-center justify-between border-b border-border p-5">
          <div>
            <h3 className="text-sm font-semibold text-foreground">Raport z lekcji</h3>
            <p className="mt-0.5 text-xs text-muted-foreground">z {lesson.studentName} · {lesson.date}</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg p-1 text-muted-foreground hover:bg-muted" aria-label="Zamknij">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex flex-col gap-4 overflow-y-auto p-5">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="reportTopic" className="text-xs font-medium text-foreground">Co przerobiliście na lekcji</label>
            <textarea
              id="reportTopic"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              rows={2}
              className="w-full resize-none rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#F4B400]"
            />
          </div>

          <RatingPicker label="Ocena postępu ucznia" value={progressRating} onChange={setProgressRating} />
          <RatingPicker label="Zaangażowanie ucznia" value={engagementRating} onChange={setEngagementRating} />

          <div className="flex flex-col gap-1.5">
            <label htmlFor="reportHomework" className="text-xs font-medium text-foreground">Zadanie domowe / co ćwiczyć (opcjonalnie)</label>
            <textarea
              id="reportHomework"
              value={homework}
              onChange={(e) => setHomework(e.target.value)}
              rows={2}
              placeholder="np. Przećwiczyć programowanie sterownika PLC..."
              className="w-full resize-none rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#F4B400]"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="reportNote" className="text-xs font-medium text-foreground">Notatka dla rodzica/ucznia (opcjonalnie)</label>
            <textarea
              id="reportNote"
              value={tutorNote}
              onChange={(e) => setTutorNote(e.target.value)}
              rows={2}
              className="w-full resize-none rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#F4B400]"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="reportNextTopic" className="text-xs font-medium text-foreground">Planowany temat kolejnej lekcji (opcjonalnie)</label>
            <input
              id="reportNextTopic"
              value={nextTopic}
              onChange={(e) => setNextTopic(e.target.value)}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#F4B400]"
            />
          </div>

          {error && <p className="text-xs text-destructive">{error}</p>}
        </div>

        <div className="border-t border-border p-5">
          <Button onClick={handleSubmit} disabled={submitting} className="w-full bg-[#F4B400] text-[#0A0A0A] hover:bg-[#FBBF24] font-semibold">
            {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Wyślij raport
          </Button>
          <p className="mt-2 text-center text-[11px] text-muted-foreground">
            Płatność zostanie zwolniona po potwierdzeniu raportu (automatycznie po 24h, jeśli nikt nie zareaguje).
          </p>
        </div>
      </div>
    </div>
  )
}
