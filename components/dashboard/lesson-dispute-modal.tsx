'use client'

import { useState } from 'react'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogBody, DialogFooter } from '@/components/ui/dialog'
import { FormError } from '@/components/ui/form-error'
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
    <Dialog open onOpenChange={(open) => { if (!open && !submitting) onClose() }}>
      <DialogContent showClose={!submitting}>
        <DialogHeader>
          <DialogTitle>Zgłoś spór</DialogTitle>
        </DialogHeader>

        <DialogBody>
          <div className="rounded-lg bg-muted/60 px-3 py-2">
            <p className="text-xs font-medium text-foreground">„{lesson.topic}"</p>
            <p className="text-[11px] text-muted-foreground">{lesson.teacherName} · {lesson.date}</p>
          </div>

          <p className="text-xs leading-relaxed text-muted-foreground">
            Zgłoszenie sporu wstrzymuje wypłatę dla nauczyciela — support Runbee sprawdzi zgłoszenie i rozstrzygnie je w ciągu 3 dni roboczych, uwalniając płatność nauczycielowi albo zwracając ją Tobie.
          </p>

          <div className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-foreground">Powód</span>
            <div className="flex flex-col gap-1.5">
              {reasonOptions.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setReason(opt.value)}
                  disabled={submitting}
                  className={cn(
                    'rounded-lg border px-3 py-2 text-left text-xs font-medium transition-colors disabled:pointer-events-none disabled:opacity-60',
                    reason === opt.value ? 'border-primary bg-accent text-accent-foreground' : 'border-border text-foreground hover:bg-muted',
                  )}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="disputeNote" className="text-xs font-medium text-foreground">Opisz sytuację</label>
            <textarea
              id="disputeNote"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Co dokładnie się wydarzyło?"
              rows={3}
              disabled={submitting}
              className="w-full resize-none rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:opacity-60"
            />
          </div>

          <FormError>{error}</FormError>
        </DialogBody>

        <DialogFooter>
          <Button onClick={onClose} disabled={submitting} variant="outline" className="flex-1">
            Anuluj
          </Button>
          <Button onClick={handleSubmit} disabled={submitting || !note.trim()} variant="destructive" className="flex-1">
            {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Zgłoś spór
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
