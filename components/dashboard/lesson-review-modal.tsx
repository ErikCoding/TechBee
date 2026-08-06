'use client'

import { useState } from 'react'
import { X, Loader2, Star } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/lib/auth-context'
import { submitLessonReview } from '@/services/lessons.service'
import { cn } from '@/lib/utils'
import type { Lesson } from '@/lib/types'

interface Props {
  lesson: Lesson
  onClose: () => void
  onSubmitted: () => void
}

/**
 * Lets a student rate + review a teacher right after a completed lesson —
 * a light "as-verification" signal that the lesson actually happened. Only
 * ever shown for `status === 'completed' && !reviewed` lessons (see
 * StudentLessonsSection). Writes a real review onto the teacher's profile
 * and marks the lesson reviewed so this doesn't show again.
 */
export function LessonReviewModal({ lesson, onClose, onSubmitted }: Props) {
  const { user } = useAuth()
  const [rating, setRating] = useState(5)
  const [hoverRating, setHoverRating] = useState(0)
  const [comment, setComment] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit() {
    if (!user) return
    if (!comment.trim()) {
      setError('Napisz kilka słów o lekcji.')
      return
    }
    setSubmitting(true)
    setError(null)
    try {
      await submitLessonReview(lesson, rating, comment.trim(), {
        name: user.name,
        initials: user.initials,
        avatarColor: user.avatarColor,
      })
      onSubmitted()
    } catch {
      setError('Nie udało się zapisać opinii. Spróbuj ponownie.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={() => !submitting && onClose()} aria-hidden="true" />
      <div className="relative w-full max-w-sm rounded-2xl border border-border bg-card p-6 shadow-xl animate-fade-in-up">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-foreground">Oceń lekcję</h3>
          <button type="button" onClick={onClose} className="rounded-lg p-1 text-muted-foreground hover:bg-muted" aria-label="Zamknij">
            <X className="h-4 w-4" />
          </button>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          „{lesson.topic}" z {lesson.teacherName} · {lesson.date}
        </p>

        <div className="mt-4 flex items-center justify-center gap-1" role="radiogroup" aria-label="Ocena w gwiazdkach">
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              type="button"
              role="radio"
              aria-checked={rating === n}
              aria-label={`${n} ${n === 1 ? 'gwiazdka' : 'gwiazdki'}`}
              onClick={() => setRating(n)}
              onMouseEnter={() => setHoverRating(n)}
              onMouseLeave={() => setHoverRating(0)}
              className="p-0.5"
            >
              <Star
                className={cn(
                  'h-7 w-7 transition-colors',
                  (hoverRating || rating) >= n ? 'fill-[#F4B400] stroke-none' : 'fill-none stroke-muted-foreground',
                )}
              />
            </button>
          ))}
        </div>

        <div className="mt-4 flex flex-col gap-1.5">
          <label htmlFor="reviewComment" className="text-xs font-medium text-foreground">Twoja opinia</label>
          <textarea
            id="reviewComment"
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="Jak przebiegła lekcja?"
            rows={3}
            className="w-full resize-none rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#F4B400]"
          />
        </div>

        {error && <p className="mt-3 text-xs text-destructive">{error}</p>}

        <Button onClick={handleSubmit} disabled={submitting} className="mt-4 w-full bg-[#F4B400] text-[#0A0A0A] hover:bg-[#FBBF24] font-semibold">
          {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
          Wyślij opinię
        </Button>
      </div>
    </div>
  )
}
