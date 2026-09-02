'use client'

import { useEffect, useState } from 'react'
import { Loader2, Star, Info } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogBody, DialogFooter } from '@/components/ui/dialog'
import { FormError } from '@/components/ui/form-error'
import { Spinner } from '@/components/ui/spinner'
import { useAuth } from '@/lib/auth-context'
import { submitLessonReview } from '@/services/lessons.service'
import { getStudentReviewForTeacher } from '@/services/teachers.service'
import { cn } from '@/lib/utils'
import type { Lesson } from '@/lib/types'

interface Props {
  lesson: Lesson
  onClose: () => void
  onSubmitted: () => void
}

/**
 * A student's single opinion about a teacher — created here the first
 * time, edited here afterwards.
 *
 * This used to be a per-lesson review form: every completed lesson
 * invited another independent review, so one student could contribute
 * many entries to the same teacher's average. It now loads whatever
 * review that student already holds for this teacher and pre-fills it,
 * so submitting updates their existing opinion rather than adding a
 * second one. The dialog says which of the two is happening, because
 * "your review will replace the previous one" is not something a user
 * should have to infer.
 */
export function LessonReviewModal({ lesson, onClose, onSubmitted }: Props) {
  const { user } = useAuth()
  const [rating, setRating] = useState(5)
  const [hoverRating, setHoverRating] = useState(0)
  const [comment, setComment] = useState('')
  const [loading, setLoading] = useState(true)
  const [isEditing, setIsEditing] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Pre-fill from the student's current review of this teacher, if any.
  useEffect(() => {
    if (!user) return
    let cancelled = false
    getStudentReviewForTeacher(lesson.teacherId, user.id)
      .then((existing) => {
        if (cancelled || !existing) return
        setRating(existing.rating)
        setComment(existing.comment)
        setIsEditing(true)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => { cancelled = true }
  }, [user, lesson.teacherId])

  async function handleSubmit() {
    if (!user) return
    if (!comment.trim()) {
      setError('Napisz kilka słów o lekcjach z tym nauczycielem.')
      return
    }
    setSubmitting(true)
    setError(null)
    try {
      await submitLessonReview(lesson, rating, comment.trim(), {
        id: user.id,
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
    <Dialog open onOpenChange={(open) => { if (!open && !submitting) onClose() }}>
      <DialogContent showClose={!submitting}>
        <DialogHeader>
          <DialogTitle>{isEditing ? 'Edytuj swoją opinię' : `Oceń nauczyciela`}</DialogTitle>
          <DialogDescription>
            {lesson.teacherName} · po lekcji „{lesson.topic}"
          </DialogDescription>
        </DialogHeader>

        <DialogBody>
          {loading ? (
            <div className="flex justify-center py-8">
              <Spinner className="text-muted-foreground" />
            </div>
          ) : (
            <>
              {/* One opinion per teacher — stated up front, not discovered after submitting. */}
              <p className="flex items-start gap-2 rounded-lg bg-muted/60 px-3 py-2 text-[11px] leading-relaxed text-muted-foreground">
                <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                {isEditing
                  ? 'Masz już opinię o tym nauczycielu. Zapisanie zmian zaktualizuje ją — nie powstanie druga opinia.'
                  : 'To Twoja jedna opinia o tym nauczycielu. Zawsze możesz ją później zmienić, także po kolejnych lekcjach.'}
              </p>

              <div className="flex items-center justify-center gap-1" role="radiogroup" aria-label="Ocena w gwiazdkach">
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
                    disabled={submitting}
                    className="p-0.5"
                  >
                    <Star
                      className={cn(
                        'h-7 w-7 transition-colors',
                        (hoverRating || rating) >= n ? 'fill-primary stroke-none' : 'fill-none stroke-muted-foreground',
                      )}
                    />
                  </button>
                ))}
              </div>

              <div className="flex flex-col gap-1.5">
                <label htmlFor="reviewComment" className="text-xs font-medium text-foreground">Twoja opinia</label>
                <textarea
                  id="reviewComment"
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  placeholder="Jak oceniasz współpracę z tym nauczycielem?"
                  rows={3}
                  disabled={submitting}
                  className="w-full resize-none rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:opacity-60"
                />
              </div>

              <FormError>{error}</FormError>
            </>
          )}
        </DialogBody>

        <DialogFooter>
          <Button onClick={handleSubmit} disabled={submitting || loading} className="w-full font-semibold">
            {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            {isEditing ? 'Zapisz zmiany' : 'Wyślij opinię'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
