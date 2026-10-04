'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { CalendarRange, CheckCircle2, Loader2, Lock, MessageSquare } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { BOOKING_WINDOW_DAYS, buildAvailability } from '@/lib/availability'
import { LESSON_DURATION_OPTIONS, normalizeLessonDurations } from '@/lib/lesson-durations'
import { buildWeeklyLessonOccurrences, LESSON_BUFFER_MINUTES, timeToMinutes, zonedDateTimeToMs } from '@/lib/lesson-time'
import { fromGrosze } from '@/lib/stripe-config'
import { resolveTeacherTrialLessonConfig } from '@/lib/trial-lessons'
import { normalizeOfferedLessonPackageSizes, packageSubjectKey } from '@/lib/lesson-packages-core'
import { useAuth } from '@/lib/auth-context'
import { isFirebaseConfigured } from '@/lib/firebase'
import { createBooking, getTeacherBookedLessonSlots } from '@/services/lessons.service'
import { startLessonCheckout, startLessonPackageCheckout } from '@/services/stripe.service'
import { bookLessonWithPackageCredit, getStudentLessonPackagesForTeacher } from '@/services/lesson-packages.service'
import { cn, dashboardPathForRole } from '@/lib/utils'
import type { BookedLessonSlot, LessonKind, LessonPackage, Teacher } from '@/lib/types'

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
  const offeredPackageSizes = useMemo(() => normalizeOfferedLessonPackageSizes(teacher.lessonPackageSizes), [teacher.lessonPackageSizes])
  const trialConfig = useMemo(() => resolveTeacherTrialLessonConfig(teacher), [teacher])
  const durationOptions = useMemo(
    () => LESSON_DURATION_OPTIONS.filter((option) => offeredDurations.includes(option.minutes)),
    [offeredDurations],
  )
  const hasSubjectStep = normalizedSubjects.length > 1
  const hasTrialOption = trialConfig.enabled

  const [selectedDayIndex, setSelectedDayIndex] = useState(0)
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null)
  const [selectedSubjectId, setSelectedSubjectId] = useState(normalizedSubjects[0]?.id ?? teacher.categoryId)
  const [lessonKind, setLessonKind] = useState<LessonKind>('regular')
  const [paymentMode, setPaymentMode] = useState<'single' | 'package'>('single')
  const [recurringEnabled, setRecurringEnabled] = useState(false)
  const [recurringCount, setRecurringCount] = useState(2)
  const [duration, setDuration] = useState(offeredDurations[0] ?? 60)
  const [topic, setTopic] = useState('')
  const [bookedSlots, setBookedSlots] = useState<BookedLessonSlot[]>([])
  const [lessonPackages, setLessonPackages] = useState<LessonPackage[]>([])
  const [loadingSlots, setLoadingSlots] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [bookedLessonId, setBookedLessonId] = useState<string | null>(null)
  const [bookedLessonCount, setBookedLessonCount] = useState(1)
  const [error, setError] = useState<string | null>(null)
  const packageBookingRequestIdRef = useRef<string | null>(null)
  const bookingDuration = lessonKind === 'trial' && trialConfig.enabled ? trialConfig.duration : duration
  const price = lessonKind === 'trial' && trialConfig.enabled
    ? fromGrosze(trialConfig.priceGrosze)
    : Math.round((teacher.hourlyRate / 60) * duration)
  const lessonKindLabel = lessonKind === 'trial' ? 'lekcja próbna' : 'lekcja standardowa'

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

  useEffect(() => {
    const studentId = bookingFor?.id ?? user?.id
    if (!studentId || !isFirebaseConfigured) {
      setLessonPackages([])
      return
    }
    let cancelled = false
    getStudentLessonPackagesForTeacher(studentId, teacher.id)
      .then((packages) => {
        if (!cancelled) setLessonPackages(packages)
      })
      .catch(() => {
        if (!cancelled) setLessonPackages([])
      })
    return () => {
      cancelled = true
    }
  }, [bookingFor?.id, teacher.id, user?.id])

  const days = useMemo(
    () => buildAvailability(
      teacher.availability,
      { start: teacher.availabilityStart ?? '09:00', end: teacher.availabilityEnd ?? '17:00' },
      BOOKING_WINDOW_DAYS,
      { duration: bookingDuration, bookedLessons: bookedSlots, availabilityHours: teacher.availabilityHours },
    ),
    [teacher.availability, teacher.availabilityStart, teacher.availabilityEnd, teacher.availabilityHours, bookingDuration, bookedSlots],
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

  useEffect(() => {
    if (lessonKind === 'trial' && !trialConfig.enabled) {
      setLessonKind('regular')
    }
    setSelectedSlot(null)
  }, [lessonKind, trialConfig.enabled])

  const selectedDay = days[selectedDayIndex]
  const selectedSubject = normalizedSubjects.find((subject) => subject.id === selectedSubjectId) ?? normalizedSubjects[0]
  const selectedSubjectCategoryId = selectedSubject?.custom ? undefined : selectedSubject?.id
  const selectedPackageSubjectKey = packageSubjectKey({
    subjectCategoryId: selectedSubjectCategoryId,
    specialty: selectedSubject?.name ?? teacher.specialty,
  })
  const matchingPackage = lessonKind === 'regular'
    ? lessonPackages.find((pkg) => (
        pkg.status === 'active' &&
        pkg.remainingCredits > 0 &&
        pkg.duration === bookingDuration &&
        pkg.subjectKey === selectedPackageSubjectKey
      ))
    : undefined
  const showPackagePaymentSection = lessonKind === 'regular' && (offeredPackageSizes.length > 0 || Boolean(matchingPackage))
  const maxRecurringCount = matchingPackage?.remainingCredits ?? 1
  const selectedRecurringCount = recurringEnabled && matchingPackage
    ? Math.min(Math.max(recurringCount, 2), maxRecurringCount)
    : 1
  const recurringPreview = recurringEnabled && matchingPackage && selectedDay && selectedSlot
    ? buildWeeklyLessonOccurrences({ firstDateIso: selectedDay.isoDate, time: selectedSlot, count: selectedRecurringCount }) ?? []
    : []
  const payableNow = paymentMode === 'package' && matchingPackage ? 0 : price

  useEffect(() => {
    if (paymentMode === 'package' && !matchingPackage) setPaymentMode('single')
  }, [matchingPackage, paymentMode])

  useEffect(() => {
    if (paymentMode !== 'package' || !matchingPackage || matchingPackage.remainingCredits < 2) {
      setRecurringEnabled(false)
    }
    if (matchingPackage) {
      setRecurringCount((count) => Math.min(Math.max(count, 2), Math.max(2, matchingPackage.remainingCredits)))
    }
  }, [matchingPackage, paymentMode])

  useEffect(() => {
    packageBookingRequestIdRef.current = null
  }, [matchingPackage?.id, selectedDay?.isoDate, selectedSlot, bookingDuration, selectedSubjectCategoryId, selectedSubject?.name, topic, recurringEnabled, recurringCount])

  function nextPackageBookingRequestId(): string {
    if (!packageBookingRequestIdRef.current) {
      packageBookingRequestIdRef.current = globalThis.crypto?.randomUUID?.() ?? `pkg-${Date.now()}-${Math.random()}`
    }
    return packageBookingRequestIdRef.current
  }

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
        if (paymentMode === 'package' && matchingPackage) {
          const booked = await bookLessonWithPackageCredit({
            packageId: matchingPackage.id,
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
            duration: bookingDuration,
            topic: topic.trim(),
            payer: bookingFor ? { id: user.id, role: 'parent' } : undefined,
            occurrenceCount: selectedRecurringCount,
            bookingRequestId: nextPackageBookingRequestId(),
          })
          setBookedLessonId(booked.lessonId)
          setBookedLessonCount(booked.lessonIds?.length ?? selectedRecurringCount)
          return
        }
        const url = await startLessonCheckout({
          teacherId: teacher.id,
          date: selectedDay.dayLabel,
          dateIso: selectedDay.isoDate,
          time: selectedSlot,
          duration: bookingDuration,
          lessonKind,
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
        duration: bookingDuration,
        lessonKind,
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

  async function handlePackagePurchase(packageSize: 5 | 10) {
    if (!user || lessonKind !== 'regular' || !offeredPackageSizes.includes(packageSize)) return
    setSubmitting(true)
    setError(null)
    try {
      const url = await startLessonPackageCheckout({
        teacherId: teacher.id,
        packageSize,
        duration: bookingDuration,
        subjectCategoryId: selectedSubjectCategoryId,
        specialty: selectedSubject?.name ?? teacher.specialty,
        studentId: bookingFor?.id ?? user.id,
        studentName: bookingFor?.name ?? user.name,
        payer: bookingFor ? { id: user.id, role: 'parent' } : undefined,
      })
      window.location.href = url
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Nie udało się rozpocząć płatności za pakiet. Spróbuj ponownie.')
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
          {bookedLessonCount > 1 ? `${bookedLessonCount} lekcje co tydzień od ` : ''}{selectedDay.dayLabel} o {selectedSlot} z {teacher.name} · {selectedSubject?.name ?? teacher.specialty} · {lessonKindLabel} · {bookingDuration} min · {paymentMode === 'package' ? 'z pakietu' : `${price} zł`}
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

          {/* Step 2 — Lesson kind */}
          {hasTrialOption && (
            <div className="px-5 py-5">
              <div className="mb-3 flex items-center gap-2.5">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-[11px] font-bold text-primary-foreground">{hasSubjectStep ? 2 : 1}</span>
                <h2 className="text-sm font-semibold text-foreground">Wybierz rodzaj lekcji</h2>
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={() => { setLessonKind('regular'); setSelectedSlot(null) }}
                  aria-pressed={lessonKind === 'regular'}
                  className={cn(
                    'flex min-h-16 flex-col items-start justify-center rounded-xl border px-3 py-2 text-left text-sm transition-colors',
                    lessonKind === 'regular'
                      ? 'border-primary bg-accent font-semibold text-accent-foreground'
                      : 'border-border bg-background text-muted-foreground hover:text-foreground',
                  )}
                >
                  <span>Lekcja standardowa</span>
                  <span className="text-xs font-normal opacity-80">od {Math.round((teacher.hourlyRate / 60) * (offeredDurations[0] ?? 60))} zł</span>
                </button>
                <button
                  type="button"
                  onClick={() => { setLessonKind('trial'); setSelectedSlot(null) }}
                  aria-pressed={lessonKind === 'trial'}
                  className={cn(
                    'flex min-h-16 flex-col items-start justify-center rounded-xl border px-3 py-2 text-left text-sm transition-colors',
                    lessonKind === 'trial'
                      ? 'border-primary bg-accent font-semibold text-accent-foreground'
                      : 'border-border bg-background text-muted-foreground hover:text-foreground',
                  )}
                >
                  <span>Lekcja próbna</span>
                  <span className="text-xs font-normal opacity-80">{trialConfig.duration} min · {fromGrosze(trialConfig.priceGrosze)} zł</span>
                </button>
              </div>
            </div>
          )}

          {/* Step 3 — Date picker */}
          <div className="px-5 py-5">
            <div className="mb-3 flex items-center gap-2.5">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-[11px] font-bold text-primary-foreground">{(hasSubjectStep ? 2 : 1) + (hasTrialOption ? 1 : 0)}</span>
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

          {/* Step 4 — Time slots */}
          <div className="px-5 py-5">
            <div className="mb-3 flex items-center gap-2.5">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-[11px] font-bold text-primary-foreground">{(hasSubjectStep ? 3 : 2) + (hasTrialOption ? 1 : 0)}</span>
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
                Brak wolnych godzin dla lekcji {bookingDuration} min. Zapas po spotkaniu blokuje tylko terminy nachodzące na inne rezerwacje.
              </p>
            )}
          </div>

          {/* Step 5 — Duration */}
          <div className="px-5 py-5">
            <div className="mb-3 flex items-center gap-2.5">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-[11px] font-bold text-primary-foreground">{(hasSubjectStep ? 4 : 3) + (hasTrialOption ? 1 : 0)}</span>
              <h2 className="text-sm font-semibold text-foreground">Długość lekcji</h2>
            </div>
            {lessonKind === 'trial' && trialConfig.enabled ? (
              <p className="inline-flex rounded-lg border border-primary/30 bg-accent px-4 py-2 text-sm font-semibold text-accent-foreground">
                Lekcja próbna: {trialConfig.duration} min
              </p>
            ) : (
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
            )}
          </div>

          {showPackagePaymentSection && (
            <div className="px-5 py-5">
              <div className="mb-3 flex items-center gap-2.5">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-[11px] font-bold text-primary-foreground">{(hasSubjectStep ? 5 : 4) + (hasTrialOption ? 1 : 0)}</span>
                <h2 className="text-sm font-semibold text-foreground">Wybierz płatność</h2>
              </div>
              <div className="grid gap-2 sm:grid-cols-3">
                <button
                  type="button"
                  onClick={() => setPaymentMode('single')}
                  aria-pressed={paymentMode === 'single'}
                  className={cn(
                    'flex min-h-16 flex-col items-start justify-center rounded-xl border px-3 py-2 text-left text-sm transition-colors',
                    paymentMode === 'single'
                      ? 'border-primary bg-accent font-semibold text-accent-foreground'
                      : 'border-border bg-background text-muted-foreground hover:text-foreground',
                  )}
                >
                  <span>Pojedyncza lekcja</span>
                  <span className="text-xs font-normal opacity-80">{price} zł</span>
                </button>
                <button
                  type="button"
                  onClick={() => matchingPackage && setPaymentMode('package')}
                  disabled={!matchingPackage}
                  aria-pressed={paymentMode === 'package'}
                  className={cn(
                    'flex min-h-16 flex-col items-start justify-center rounded-xl border px-3 py-2 text-left text-sm transition-colors disabled:cursor-not-allowed disabled:opacity-50',
                    paymentMode === 'package'
                      ? 'border-primary bg-accent font-semibold text-accent-foreground'
                      : 'border-border bg-background text-muted-foreground hover:text-foreground',
                  )}
                >
                  <span>Użyj lekcji z pakietu</span>
                  <span className="text-xs font-normal opacity-80">
                    {matchingPackage ? `${matchingPackage.remainingCredits} dostępne` : 'Brak pasującego pakietu'}
                  </span>
                </button>
                {offeredPackageSizes.length > 0 && (
                  <div className="grid grid-cols-2 gap-2 sm:col-span-1">
                    {offeredPackageSizes.map((packageSize) => (
                      <button
                        key={packageSize}
                        type="button"
                        onClick={() => handlePackagePurchase(packageSize)}
                        disabled={submitting}
                        className="rounded-xl border border-border bg-background px-3 py-2 text-left text-sm font-semibold text-foreground transition-colors hover:bg-muted disabled:opacity-50"
                      >
                        Pakiet {packageSize}
                        <span className="block text-xs font-normal text-muted-foreground">{price * packageSize} zł</span>
                      </button>
                    ))}
                  </div>
                )}
                {paymentMode === 'package' && matchingPackage && (
                  <div className="rounded-xl border border-border bg-background/70 p-3 sm:col-span-3">
                    <label className="flex items-start gap-2 text-sm font-medium text-foreground">
                      <input
                        type="checkbox"
                        checked={recurringEnabled}
                        disabled={matchingPackage.remainingCredits < 2}
                        onChange={(event) => setRecurringEnabled(event.target.checked)}
                        className="mt-1 h-4 w-4 rounded border-border"
                      />
                      <span>
                        Rezerwuj co tydzień
                        <span className="block text-xs font-normal text-muted-foreground">
                          {matchingPackage.remainingCredits >= 2
                            ? `Możesz zarezerwować od 2 do ${matchingPackage.remainingCredits} spotkań z tego pakietu.`
                            : 'Ten pakiet ma tylko jedną dostępną lekcję.'}
                        </span>
                      </span>
                    </label>
                    {recurringEnabled && (
                      <div className="mt-3 grid gap-3 sm:grid-cols-[180px_minmax(0,1fr)]">
                        <div className="flex flex-col gap-1.5">
                          <label htmlFor="recurringCount" className="text-xs font-medium text-foreground">Liczba spotkań</label>
                          <select
                            id="recurringCount"
                            value={selectedRecurringCount}
                            onChange={(event) => setRecurringCount(Number(event.target.value))}
                            className="h-10 rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                          >
                            {Array.from({ length: Math.max(0, matchingPackage.remainingCredits - 1) }, (_, index) => index + 2).map((count) => (
                              <option key={count} value={count}>{count} spotkania</option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <p className="text-xs font-medium text-foreground">Terminy</p>
                          <div className="mt-1 flex flex-wrap gap-1.5">
                            {recurringPreview.length > 0 ? recurringPreview.map((occurrence) => (
                              <span key={occurrence.dateIso} className="rounded-lg bg-muted px-2 py-1 text-xs text-muted-foreground">
                                {occurrence.date} · {occurrence.time}
                              </span>
                            )) : (
                              <span className="text-xs text-muted-foreground">Wybierz godzinę, aby zobaczyć daty.</span>
                            )}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Step 6 — Topic */}
          <div className="px-5 py-5">
            <div className="mb-3 flex items-center gap-2.5">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-[11px] font-bold text-primary-foreground">{(hasSubjectStep ? 6 : 5) + (hasTrialOption ? 1 : 0)}</span>
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
            <p className="text-2xl font-bold text-foreground">{paymentMode === 'package' && matchingPackage ? 'Z pakietu' : `${payableNow} zł`}</p>
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
