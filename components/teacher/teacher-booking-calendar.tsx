'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { CalendarRange, CheckCircle2, Loader2, Lock, MessageSquare } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { BOOKING_WINDOW_DAYS, buildAvailability } from '@/lib/availability'
import { LESSON_DURATION_OPTIONS, normalizeLessonDurations } from '@/lib/lesson-durations'
import { LESSON_BUFFER_MINUTES, timeToMinutes, zonedDateTimeToMs } from '@/lib/lesson-time'
import { useAuth } from '@/lib/auth-context'
import { isFirebaseConfigured } from '@/lib/firebase'
import { createBooking, getTeacherBookedLessonSlots } from '@/services/lessons.service'
import { startLessonCheckout } from '@/services/stripe.service'
import { cn, dashboardPathForRole } from '@/lib/utils'
import type { BookedLessonSlot, Teacher } from '@/lib/types'

interface Props {
  teacher: Teacher
  subjects: { id: string; name: string; custom?: boolean }[]
  /** Set when a parent is booking on behalf of a linked student (see app/teacher/[id]/book/page.tsx) — the student is charged the lesson, the parent pays for it. */
  bookingFor?: { id: string; name: string }
}

export function TeacherBookingCalendar({ teacher, subjects, bookingFor }: Props) {
  const { user } = useAuth()
  const router = useRouter()
  const normalizedSubjects = subjects.length ? subjects : [{ id: teacher.categoryId, name: teacher.specialty }]
  const offeredDurations = useMemo(() => normalizeLessonDurations(teacher.lessonDurations), [teacher.lessonDurations])
  const durationOptions = useMemo(
    () => LESSON_DURATION_OPTIONS.filter((option) => offeredDurations.includes(option.minutes)),
    [offeredDurations],
  )

  const [selectedDayIndex, setSelectedDayIndex] = useState(0)
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null)
  const [selectedSubjectId, setSelectedSubjectId] = useState(normalizedSubjects[0]?.id ?? teacher.categoryId)
  const [duration, setDuration] = useState(offeredDurations[0] ?? 60)
  const [topic, setTopic] = useState('')
  const [bookedSlots, setBookedSlots] = useState<BookedLessonSlot[]>([])
  const [loadingSlots, setLoadingSlots] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [bookedLessonId, setBookedLessonId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoadingSlots(true)
    getTeacherBookedLessonSlots(teacher.id)
      .then((slots) => {
        if (!cancelled) setBookedSlots(slots)
      })
      .finally(() => {
        if (!cancelled) setLoadingSlots(false)
      })
    return () => {
      cancelled = true
    }
  }, [teacher.id])

  const days = useMemo(
    () => buildAvailability(
      teacher.availability,
      { start: teacher.availabilityStart ?? '09:00', end: teacher.availabilityEnd ?? '17:00' },
      BOOKING_WINDOW_DAYS,
      { duration, bookedLessons: bookedSlots, availabilityHours: teacher.availabilityHours },
    ),
    [teacher.availability, teacher.availabilityStart, teacher.availabilityEnd, teacher.availabilityHours, duration, bookedSlots],
  )

  useEffect(() => {
    if (!selectedSlot) return
    const selected = days[selectedDayIndex]?.slots.find((slot) => slot.time === selectedSlot)
    if (!selected || selected.status !== 'available') setSelectedSlot(null)
  }, [days, selectedDayIndex, selectedSlot])

  useEffect(() => {
    if (offeredDurations.includes(duration)) return
    setDuration(offeredDurations[0] ?? 60)
    setSelectedSlot(null)
  }, [duration, offeredDurations])

  const selectedDay = days[selectedDayIndex]
  const selectedSubject = normalizedSubjects.find((subject) => subject.id === selectedSubjectId) ?? normalizedSubjects[0]
  const selectedSubjectCategoryId = selectedSubject?.custom ? undefined : selectedSubject?.id
  const price = Math.round((teacher.hourlyRate / 60) * duration)

  function selectedStartAt(): number | undefined {
    if (!selectedDay || !selectedSlot) return undefined
    return zonedDateTimeToMs(selectedDay.isoDate, selectedSlot) ?? undefined
  }

  // Real (Firebase-configured) mode: payment happens now, via a real
  // Stripe Checkout redirect — the lesson itself isn't created until
  // Stripe confirms the payment actually succeeded (see the webhook at
  // app/api/stripe/webhook/route.ts), so there's no "book now, pay
  // later" gap and no way to book without paying. Mock mode keeps the
  // old instant local demo booking (no real payment processor either
  // way in that mode).
  async function handleConfirm() {
    if (!user || !selectedDay || !selectedSlot || !topic.trim()) return
    setSubmitting(true)
    setError(null)
    try {
      if (isFirebaseConfigured) {
        const url = await startLessonCheckout({
          teacherId: teacher.id,
          date: selectedDay.dayLabel,
          dateIso: selectedDay.isoDate,
          time: selectedSlot,
          duration,
          topic: topic.trim(),
          subjectCategoryId: selectedSubjectCategoryId,
          specialty: selectedSubject?.name ?? teacher.specialty,
          studentId: bookingFor?.id ?? user.id,
          studentName: bookingFor?.name ?? user.name,
          payer: bookingFor ? { id: user.id, role: 'parent' } : undefined,
        })
        window.location.href = url
        return
      }
      const lesson = await createBooking({
        teacherId: teacher.id,
        teacherName: teacher.name,
        teacherInitials: teacher.initials,
        teacherColor: teacher.avatarColor,
        teacherPhotoUrl: teacher.photoUrl,
        subjectCategoryId: selectedSubjectCategoryId,
        specialty: selectedSubject?.name ?? teacher.specialty,
        studentId: bookingFor?.id ?? user.id,
        studentName: bookingFor?.name ?? user.name,
        date: selectedDay.dayLabel,
        dateIso: selectedDay.isoDate,
        time: selectedSlot,
        scheduledStartAt: selectedStartAt(),
        duration,
        price,
        topic: topic.trim(),
        payer: bookingFor ? { id: user.id, role: 'parent' } : undefined,
      })
      setBookedLessonId(lesson.id)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Nie udało się rozpocząć płatności. Spróbuj ponownie.')
    } finally {
      setSubmitting(false)
    }
  }

  if (days.length === 0) {
    return (
      <div className="rounded-2xl border border-border bg-card p-8 text-center">
        <p className="text-sm text-muted-foreground">Ten nauczyciel nie ma obecnie dostępnych terminów. Napisz do niego wiadomość, aby zapytać o dostępność.</p>
      </div>
    )
  }

  if (bookedLessonId) {
    return (
      <div className="animate-fade-in-up rounded-2xl border border-success/30 bg-success-surface p-8 text-center">
        <CheckCircle2 className="mx-auto h-10 w-10 text-success-on-surface" aria-hidden="true" />
        <h2 className="mt-3 text-lg font-semibold text-foreground">Prośba o rezerwację wysłana!</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {selectedDay.dayLabel} o {selectedSlot} z {teacher.name} · {selectedSubject?.name ?? teacher.specialty} · {duration} min · {price} zł
          {bookingFor ? ` · dla ${bookingFor.name}` : ''}
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          {bookingFor ? `Środki zostały zablokowane w Twoim portfelu. Lekcja` : 'Lekcja'} pojawi się w panelu, gdy {teacher.name} potwierdzi termin.
        </p>
        <div className="mt-6 flex flex-col justify-center gap-2 sm:flex-row">
          <Button onClick={() => router.push(dashboardPathForRole(user?.role))} className="font-semibold">
            Przejdź do panelu
          </Button>
          <Link href={`/teacher/${teacher.id}`}>
            <Button variant="outline">Wróć do profilu nauczyciela</Button>
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Wizard card — every step lives inside one panel instead of loose stacked blocks */}
      <div className="animate-fade-in-up overflow-hidden rounded-2xl border border-border bg-card">
        <div className="flex flex-col divide-y divide-border">
          <div className="border-b border-border bg-muted/30 px-5 py-4">
            <div className="flex items-start gap-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-accent text-accent-foreground">
                <CalendarRange className="h-4 w-4" aria-hidden="true" />
              </span>
              <div>
                <p className="text-sm font-semibold text-foreground">Rezerwacja do {BOOKING_WINDOW_DAYS} dni do przodu</p>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                  Godziny poniżej uwzględniają długość lekcji, zajęte terminy i {LESSON_BUFFER_MINUTES} min zapasu po spotkaniu.
                </p>
              </div>
            </div>
          </div>

          {/* Step 1 — Subject picker */}
          {normalizedSubjects.length > 1 && (
            <div className="px-5 py-5">
              <div className="mb-3 flex items-center gap-2.5">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-[11px] font-bold text-primary-foreground">1</span>
                <h2 className="text-sm font-semibold text-foreground">Wybierz przedmiot</h2>
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                {normalizedSubjects.map((subject) => {
                  const active = selectedSubjectId === subject.id
                  return (
                    <button
                      key={subject.id}
                      type="button"
                      onClick={() => setSelectedSubjectId(subject.id)}
                      aria-pressed={active}
                      className={cn(
                        'flex min-h-11 items-center justify-between gap-2 rounded-xl border px-3 py-2 text-left text-sm transition-colors',
                        active
                          ? 'border-primary bg-accent font-semibold text-accent-foreground'
                          : 'border-border bg-background text-muted-foreground hover:text-foreground',
                      )}
                    >
                      <span>{subject.name}</span>
                      {active && <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden="true" />}
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {/* Step 2 — Date picker */}
          <div className="px-5 py-5">
            <div className="mb-3 flex items-center gap-2.5">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-[11px] font-bold text-primary-foreground">{normalizedSubjects.length > 1 ? 2 : 1}</span>
              <h2 className="text-sm font-semibold text-foreground">Wybierz dzień</h2>
            </div>
            <div className="flex gap-2 overflow-x-auto pb-1">
              {days.map((day, i) => (
                <button
                  key={day.isoDate}
                  type="button"
                  onClick={() => { setSelectedDayIndex(i); setSelectedSlot(null) }}
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
          </div>

          {/* Step 3 — Time slots */}
          <div className="px-5 py-5">
            <div className="mb-3 flex items-center gap-2.5">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-[11px] font-bold text-primary-foreground">{normalizedSubjects.length > 1 ? 3 : 2}</span>
              <h2 className="text-sm font-semibold text-foreground">Wybierz godzinę — {selectedDay.dayLabel}</h2>
              {loadingSlots && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" aria-hidden="true" />}
            </div>
            <div className="flex flex-wrap gap-2">
              {selectedDay.slots.map((slot) => {
                const disabled = slot.status !== 'available'
                return (
                  <button
                    key={slot.time}
                    type="button"
                    disabled={disabled}
                    onClick={() => setSelectedSlot(slot.time)}
                    className={cn(
                      'inline-flex h-10 min-w-[5.5rem] items-center justify-center gap-1.5 rounded-lg border px-3 text-sm font-semibold transition-all disabled:cursor-not-allowed',
                      selectedSlot === slot.time
                        ? 'border-primary bg-primary text-primary-foreground shadow-sm'
                        : disabled
                          ? 'border-border bg-muted/70 text-muted-foreground'
                          : 'border-border bg-background text-foreground hover:-translate-y-0.5 hover:border-primary/40 hover:bg-accent/60',
                    )}
                    title={slot.status === 'booked' ? 'Ten termin jest już zajęty' : slot.status === 'outside' ? 'Za mało czasu na całą lekcję' : undefined}
                  >
                    {slot.status === 'booked' && <Lock className="h-3 w-3" aria-hidden="true" />}
                    {slot.time}
                    {slot.status === 'booked' && <span className="text-[10px]">zajęte</span>}
                  </button>
                )
              })}
            </div>
            {selectedDay.slots.every((slot) => slot.status !== 'available') && (
              <p className="mt-3 text-xs text-muted-foreground">
                Brak wolnych godzin dla lekcji {duration} min. Zapas po spotkaniu blokuje tylko terminy nachodzące na inne rezerwacje.
              </p>
            )}
          </div>

          {/* Step 4 — Duration */}
          <div className="px-5 py-5">
            <div className="mb-3 flex items-center gap-2.5">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-[11px] font-bold text-primary-foreground">{normalizedSubjects.length > 1 ? 4 : 3}</span>
              <h2 className="text-sm font-semibold text-foreground">Długość lekcji</h2>
            </div>
            <div className="flex gap-2">
              {durationOptions.map((d) => (
                <button
                  key={d.minutes}
                  type="button"
                  onClick={() => { setDuration(d.minutes); setSelectedSlot(null) }}
                  className={cn(
                    'rounded-lg border px-4 py-2 text-sm font-medium transition-all',
                    duration === d.minutes
                      ? 'border-primary bg-primary text-primary-foreground'
                      : 'border-border text-foreground hover:-translate-y-0.5 hover:bg-muted',
                  )}
                >
                  {d.label}
                </button>
              ))}
            </div>
          </div>

          {/* Step 5 — Topic */}
          <div className="px-5 py-5">
            <div className="mb-3 flex items-center gap-2.5">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-[11px] font-bold text-primary-foreground">{normalizedSubjects.length > 1 ? 5 : 4}</span>
              <h2 className="text-sm font-semibold text-foreground">Czego dotyczy lekcja?</h2>
            </div>
            <Textarea
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="np. Konfiguracja bloków funkcyjnych w TIA Portal, przygotowanie do egzaminu certyfikacyjnego..."
              rows={3}
            />
          </div>
        </div>

        {/* Summary + confirm — attached footer bar, not a floating box */}
        <div className="flex flex-col gap-3 border-t border-border bg-muted/30 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs text-muted-foreground">
              {isFirebaseConfigured ? 'Cena lekcji — płatność przez Stripe' : 'Cena lekcji'}
            </p>
            <p className="text-2xl font-bold text-foreground">{price} zł</p>
          </div>
          <Button
            onClick={handleConfirm}
            disabled={!selectedSlot || !topic.trim() || submitting || loadingSlots}
            className="font-semibold transition-transform hover:-translate-y-0.5 disabled:hover:translate-y-0"
          >
            {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            {isFirebaseConfigured ? 'Zapłać i zarezerwuj' : 'Wyślij prośbę o rezerwację'}
          </Button>
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
          {error}
        </div>
      )}

      <Link href={`/teacher/${teacher.id}`} className="inline-flex w-fit items-center gap-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground">
        <MessageSquare className="h-3.5 w-3.5" aria-hidden="true" />
        Wolisz najpierw zapytać? Napisz wiadomość z profilu nauczyciela.
      </Link>
    </div>
  )
}
