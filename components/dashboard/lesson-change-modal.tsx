'use client'

import { useEffect, useMemo, useState } from 'react'
import { Loader2, Lock } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogBody, DialogFooter } from '@/components/ui/dialog'
import { FormError } from '@/components/ui/form-error'
import { buildAvailability } from '@/lib/availability'
import { getTeacherById } from '@/services/teachers.service'
import { getTeacherBookedLessonSlots, requestLessonChange } from '@/services/lessons.service'
import { cn } from '@/lib/utils'
import type { BookedLessonSlot, Lesson, Teacher } from '@/lib/types'

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
  const [teacher, setTeacher] = useState<Teacher | null>(null)
  const [bookedSlots, setBookedSlots] = useState<BookedLessonSlot[]>([])
  const [selectedDayIndex, setSelectedDayIndex] = useState(0)
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null)
  const [note, setNote] = useState('')
  const [loadingSlots, setLoadingSlots] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const otherParty = requestedBy === 'student' ? lesson.teacherName : lesson.studentName
  const usableBookedSlots = useMemo(() => bookedSlots.filter((slot) => slot.id !== lesson.id), [bookedSlots, lesson.id])
  const days = useMemo(
    () => teacher
      ? buildAvailability(
          teacher.availability,
          { start: teacher.availabilityStart ?? '09:00', end: teacher.availabilityEnd ?? '17:00' },
          14,
          { duration: lesson.duration, bookedLessons: usableBookedSlots, availabilityHours: teacher.availabilityHours },
        )
      : [],
    [teacher, lesson.duration, usableBookedSlots],
  )
  const selectedDay = days[selectedDayIndex]

  useEffect(() => {
    let cancelled = false
    setLoadingSlots(true)
    Promise.all([getTeacherById(lesson.teacherId), getTeacherBookedLessonSlots(lesson.teacherId)])
      .then(([teacherData, slots]) => {
        if (cancelled) return
        setTeacher(teacherData ?? null)
        setBookedSlots(slots)
      })
      .finally(() => {
        if (!cancelled) setLoadingSlots(false)
      })
    return () => {
      cancelled = true
    }
  }, [lesson.teacherId])

  useEffect(() => {
    if (!selectedSlot) return
    const slot = days[selectedDayIndex]?.slots.find((s) => s.time === selectedSlot)
    if (!slot || slot.status !== 'available') setSelectedSlot(null)
  }, [days, selectedDayIndex, selectedSlot])

  async function handleSubmit() {
    if (tab === 'cancel' && note.trim().length < 8) {
      setError('Opisz krótko powód odwołania lekcji.')
      return
    }
    if (tab === 'reschedule' && (!selectedDay || !selectedSlot)) {
      setError('Wybierz proponowany dzień i godzinę.')
      return
    }
    setSubmitting(true)
    setError(null)
    try {
      const change =
        tab === 'reschedule'
          ? { type: tab, note: note.trim() || undefined, newDate: selectedDay!.dayLabel, newDateIso: selectedDay!.isoDate, newTime: selectedSlot! }
          : { type: tab, note: note.trim() }
      await requestLessonChange(lesson, requestedBy, {
        ...change,
      })
      onRequested()
    } catch {
      setError('Nie udało się wysłać prośby. Spróbuj ponownie.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open onOpenChange={(open) => { if (!open && !submitting) onClose() }}>
      <DialogContent showClose={!submitting}>
        <DialogHeader>
          <DialogTitle>Zarządzaj lekcją</DialogTitle>
          <DialogDescription>
            „{lesson.topic}" z {otherParty} · {lesson.date} o {lesson.time}
          </DialogDescription>
        </DialogHeader>

        <DialogBody>
          <div className="flex gap-1.5 rounded-lg bg-muted p-1">
            <button
              type="button"
              onClick={() => setTab('cancel')}
              disabled={submitting}
              className={cn('flex-1 rounded-md px-3 py-1.5 text-xs font-semibold transition-colors', tab === 'cancel' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground')}
            >
              Odwołaj
            </button>
            <button
              type="button"
              onClick={() => setTab('reschedule')}
              disabled={submitting}
              className={cn('flex-1 rounded-md px-3 py-1.5 text-xs font-semibold transition-colors', tab === 'reschedule' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground')}
            >
              Przełóż
            </button>
          </div>

          {tab === 'cancel' ? (
            <div className="flex flex-col gap-2">
              <p className="text-sm text-muted-foreground">
                Wyślemy prośbę o odwołanie do {otherParty}. Lekcja zostanie odwołana dopiero po jej potwierdzeniu.
              </p>
              <div className="flex flex-col gap-1.5">
                <label htmlFor="cancelNote" className="text-xs font-medium text-foreground">Powód odwołania</label>
                <Textarea
                  id="cancelNote"
                  required
                  rows={3}
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Np. awaria sprzętu, choroba, konflikt w grafiku..."
                  disabled={submitting}
                />
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              <p className="text-sm leading-relaxed text-muted-foreground">
                Wybierz nowy termin z dostępności nauczyciela. Zajęte godziny i zbyt krótkie okna są zablokowane.
              </p>
              {loadingSlots ? (
                <div className="flex items-center gap-2 rounded-xl border border-border bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                  Ładowanie wolnych terminów...
                </div>
              ) : days.length === 0 ? (
                <div className="rounded-xl border border-border bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
                  Brak dostępnych terminów dla tego nauczyciela.
                </div>
              ) : (
                <>
                  <div className="flex gap-2 overflow-x-auto pb-1">
                    {days.map((day, i) => (
                      <button
                        key={day.isoDate}
                        type="button"
                        onClick={() => { setSelectedDayIndex(i); setSelectedSlot(null) }}
                        disabled={submitting}
                        className={cn(
                          'flex shrink-0 flex-col items-center gap-0.5 rounded-xl border px-4 py-2.5 text-xs font-medium transition-all',
                          i === selectedDayIndex
                            ? 'border-primary bg-accent text-accent-foreground'
                            : 'border-border text-muted-foreground hover:-translate-y-0.5 hover:bg-muted',
                        )}
                      >
                        <span>{day.weekdayLabel}</span>
                        <span className="text-[11px] opacity-80">{day.dayLabel.split(', ')[1]}</span>
                      </button>
                    ))}
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {selectedDay?.slots.map((slot) => {
                      const disabled = submitting || slot.status !== 'available'
                      return (
                        <button
                          key={slot.time}
                          type="button"
                          disabled={disabled}
                          onClick={() => setSelectedSlot(slot.time)}
                          className={cn(
                            'inline-flex h-9 min-w-[5rem] items-center justify-center gap-1.5 rounded-lg border px-3 text-xs font-semibold transition-all disabled:cursor-not-allowed',
                            selectedSlot === slot.time
                              ? 'border-primary bg-primary text-primary-foreground shadow-sm'
                              : disabled
                                ? 'border-border bg-muted/70 text-muted-foreground'
                                : 'border-border bg-background text-foreground hover:-translate-y-0.5 hover:border-primary/40 hover:bg-accent/60',
                          )}
                        >
                          {slot.status === 'booked' && <Lock className="h-3 w-3" aria-hidden="true" />}
                          {slot.time}
                          {slot.status === 'booked' && <span className="text-[10px]">zajęte</span>}
                        </button>
                      )
                    })}
                  </div>
                </>
              )}

              <div className="flex flex-col gap-1.5">
                <label htmlFor="changeNote" className="text-xs font-medium text-foreground">Wiadomość opcjonalna</label>
                <Textarea
                  id="changeNote"
                  rows={2}
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Dodaj kontekst do prośby, jeśli trzeba."
                  disabled={submitting}
                />
              </div>
            </div>
          )}

          <FormError>{error}</FormError>
        </DialogBody>

        <DialogFooter>
          <Button onClick={handleSubmit} disabled={submitting || (tab === 'reschedule' && loadingSlots)} className="w-full font-semibold">
            {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Wyślij prośbę
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
