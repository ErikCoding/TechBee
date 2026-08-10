'use client'

import { useState } from 'react'
import { X, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/lib/auth-context'
import { disputeLessonReport } from '@/services/lessons.service'
import { cn } from '@/lib/utils'
import type { Lesson, LessonDisputeReason } from '@/lib/types'

interface Props {
  lesson: Lesson
  onClose: () => void
  onSubmitted: () => void
}

const reasonOptions: { value: LessonDisputeReason; label: string }[] = [
  { value: 'tutor_no_show', label: 'Nauczyciel się nie pojawił' },
  { value: 'not_as_described', label: 'Lekcja przebiegła inaczej niż opisano' },
  { value: 'quality_issue', label: 'Problem z jakością lekcji' },
  { value: 'other', label: 'Inny powód' },
]

/**
 * The confirming party (student or their linked parent — see
 * Lesson.confirmingPartyId) rejects a report instead of confirming it.
 * Parks the held payment until an admin resolves the dispute (see
 * resolveDispute in lessons.service.ts + app/admin/disputes).
 */
export function LessonDisputeModal({ lesson, onClose, onSubmitted }: Props) {
  const { user } = useAuth()
  const [reason, setReason] = useState<LessonDisputeReason>('not_as_described')
  const [note, setNote] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit() {
    if (!user) return
    if (!note.trim()) {
      setError('Opisz krótko, co się stało.')
      return
    }
    setSubmitting(true)
    setError(null)
    try {
      await disputeLessonReport(lesson, reason, note.trim(), user.role === 'parent' ? 'parent' : 'student', user.id)
      onSubmitted()
    } catch {
      setError('Nie udało się zgłosić sporu. Spróbuj ponownie.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={() => !submitting && onClose()} aria-hidden="true" />
      <div className="relative w-full max-w-sm rounded-2xl border border-border bg-card p-6 shadow-xl animate-fade-in-up">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-foreground">Zgłoś spór</h3>
          <button type="button" onClick={onClose} className="rounded-lg p-1 text-muted-foreground hover:bg-muted" aria-label="Zamknij">
            <X className="h-4 w-4" />
          </button>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          „{lesson.topic}" z {lesson.teacherName} · {lesson.date}. Support Techbee skontaktuje się z nauczycielem i rozstrzygnie sprawę w ciągu 3 dni roboczych.
        </p>

        <div className="mt-4 flex flex-col gap-1.5">
          <span className="text-xs font-medium text-foreground">Powód</span>
          <div className="flex flex-col gap-1.5">
            {reasonOptions.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setReason(opt.value)}
                className={cn(
                  'rounded-lg border px-3 py-2 text-left text-xs font-medium transition-colors',
                  reason === opt.value ? 'border-[#F4B400] bg-[#FEF3C7] text-[#78350F] dark:bg-[#3B2800] dark:text-[#FBBF24]' : 'border-border text-foreground hover:bg-muted',
                )}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-4 flex flex-col gap-1.5">
          <label htmlFor="disputeNote" className="text-xs font-medium text-foreground">Opisz sytuację</label>
          <textarea
            id="disputeNote"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Co dokładnie się wydarzyło?"
            rows={3}
            className="w-full resize-none rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#F4B400]"
          />
        </div>

        {error && <p className="mt-3 text-xs text-destructive">{error}</p>}

        <Button onClick={handleSubmit} disabled={submitting} variant="destructive" className="mt-4 w-full">
          {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
          Zgłoś spór
        </Button>
      </div>
    </div>
  )
}
