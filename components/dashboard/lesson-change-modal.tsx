'use client'

import { useState } from 'react'
import { X, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { requestLessonChange } from '@/services/lessons.service'
import { cn } from '@/lib/utils'
import type { Lesson } from '@/lib/types'

interface Props {
  lesson: Lesson
  requestedBy: 'student' | 'teacher'
  onClose: () => void
  onRequested: () => void
}

/**
 * Lets the signed-in party ask to cancel or reschedule a confirmed
 * lesson — this doesn't change anything by itself, it just sends a
 * real notification to the *other* party, who has to accept or
 * reject it (see respondToLessonChange in services/lessons.service.ts).
 */
export function LessonChangeModal({ lesson, requestedBy, onClose, onRequested }: Props) {
  const [tab, setTab] = useState<'cancel' | 'reschedule'>('cancel')
  const [newDate, setNewDate] = useState('')
  const [newTime, setNewTime] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const otherParty = requestedBy === 'student' ? lesson.teacherName : lesson.studentName

  async function handleSubmit() {
    if (tab === 'reschedule' && (!newDate.trim() || !newTime.trim())) {
      setError('Podaj proponowany dzień i godzinę.')
      return
    }
    setSubmitting(true)
    setError(null)
    try {
      await requestLessonChange(lesson, requestedBy, {
        type: tab,
        ...(tab === 'reschedule' ? { newDate: newDate.trim(), newTime: newTime.trim() } : {}),
      })
      onRequested()
    } catch {
      setError('Nie udało się wysłać prośby. Spróbuj ponownie.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={() => !submitting && onClose()} aria-hidden="true" />
      <div className="relative w-full max-w-sm rounded-2xl border border-border bg-card p-6 shadow-xl animate-fade-in-up">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-foreground">Zarządzaj lekcją</h3>
          <button type="button" onClick={onClose} className="rounded-lg p-1 text-muted-foreground hover:bg-muted" aria-label="Zamknij">
            <X className="h-4 w-4" />
          </button>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          „{lesson.topic}" z {otherParty} · {lesson.date} o {lesson.time}
        </p>

        <div className="mt-4 flex gap-1.5 rounded-lg bg-muted p-1">
          <button
            type="button"
            onClick={() => setTab('cancel')}
            className={cn('flex-1 rounded-md px-3 py-1.5 text-xs font-semibold transition-colors', tab === 'cancel' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground')}
          >
            Odwołaj
          </button>
          <button
            type="button"
            onClick={() => setTab('reschedule')}
            className={cn('flex-1 rounded-md px-3 py-1.5 text-xs font-semibold transition-colors', tab === 'reschedule' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground')}
          >
            Przełóż
          </button>
        </div>

        {tab === 'cancel' ? (
          <p className="mt-4 text-sm text-muted-foreground">
            Wyślemy prośbę o odwołanie do {otherParty}. Lekcja zostanie odwołana dopiero po jej potwierdzeniu.
          </p>
        ) : (
          <div className="mt-4 flex flex-col gap-3">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="newDate" className="text-xs font-medium text-foreground">Proponowany dzień</label>
              <Input id="newDate" value={newDate} onChange={(e) => setNewDate(e.target.value)} placeholder="np. Śr, 20 sie" />
            </div>
            <div className="flex flex-col gap-1.5">
              <label htmlFor="newTime" className="text-xs font-medium text-foreground">Proponowana godzina</label>
              <Input id="newTime" value={newTime} onChange={(e) => setNewTime(e.target.value)} placeholder="np. 16:00" />
            </div>
          </div>
        )}

        {error && <p className="mt-3 text-xs text-destructive">{error}</p>}

        <Button onClick={handleSubmit} disabled={submitting} className="mt-4 w-full bg-[#F4B400] text-[#0A0A0A] hover:bg-[#FBBF24] font-semibold">
          {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
          Wyślij prośbę
        </Button>
      </div>
    </div>
  )
}
