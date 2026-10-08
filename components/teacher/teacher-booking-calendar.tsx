'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { CalendarRange, Check, CheckCircle2, Info, Loader2, Lock, MessageSquare, PackageCheck } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Dialog, DialogBody, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { BOOKING_WINDOW_DAYS, buildAvailability } from '@/lib/availability'
import { LESSON_DURATION_OPTIONS, normalizeLessonDurations } from '@/lib/lesson-durations'
import { buildWeeklyLessonOccurrences, LESSON_BUFFER_MINUTES, timeToMinutes, zonedDateTimeToMs } from '@/lib/lesson-time'
import { fromGrosze, toGrosze } from '@/lib/stripe-config'
import { buildStudentPaymentBreakdown, type StudentPaymentBreakdown } from '@/lib/service-fees'
import { resolveTeacherTrialLessonConfig } from '@/lib/trial-lessons'
import { normalizeOfferedLessonPackageSizes, packageSubjectKey } from '@/lib/lesson-packages-core'
import { bookingWizardSummaryKind, canContinueBookingWizard, canSubmitBookingWizard } from '@/lib/booking-wizard-core'
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

type PaymentChoice = 'single' | 'existing_package' | 'buy_package'
type PackagePurchaseMode = 'package_only' | 'package_and_book'
type WizardStep = 1 | 2 | 3

function remainingLessonsText(count: number): string {
  if (count === 1) return '1 lekcja pozostała'
  if (count >= 2 && count <= 4) return `${count} lekcje pozostały`
  return `${count} lekcji pozostało`
}

function pln(grosze: number): string {
  return `${fromGrosze(grosze).toLocaleString('pl-PL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} zł`
}

const SERVICE_FEE_INFO = 'Opłata serwisowa Runbee wynosi 3% wartości zakupu, minimum 2,99 zł. Jest naliczana jednorazowo przy zakupie i nie jest pobierana ponownie przy rezerwacji lekcji z wcześniej zakupionego pakietu'

function FeeInfoButton() {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Wyjaśnij opłatę serwisową"
        className="inline-flex h-5 w-5 items-center justify-center rounded-full text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60"
      >
        <Info className="h-3.5 w-3.5" aria-hidden="true" />
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Opłata serwisowa</DialogTitle>
          </DialogHeader>
          <DialogBody>
            <p className="text-sm leading-relaxed text-muted-foreground">{SERVICE_FEE_INFO}.</p>
          </DialogBody>
          <DialogFooter className="justify-end">
            <Button type="button" onClick={() => setOpen(false)} className="font-semibold">
              Rozumiem
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

function PriceBreakdown({ payment, subtotalLabel = 'Cena lekcji' }: { payment: StudentPaymentBreakdown; subtotalLabel?: string }) {
  return (
    <dl className="mt-3 space-y-1.5 text-xs">
      <div className="flex items-center justify-between gap-3">
        <dt className="text-muted-foreground">{subtotalLabel}</dt>
        <dd className="font-medium text-foreground">{pln(payment.subtotalGrosze)}</dd>
      </div>
      <div className="flex items-center justify-between gap-3">
        <dt className="flex items-center gap-1.5 text-muted-foreground">
          Opłata serwisowa
          <FeeInfoButton />
        </dt>
        <dd className="font-medium text-foreground">{pln(payment.studentServiceFeeGrosze)}</dd>
      </div>
      <div className="flex items-center justify-between gap-3 border-t border-border/70 pt-1.5">
        <dt className="font-semibold text-foreground">Łącznie do zapłaty</dt>
        <dd className="font-bold text-foreground">{pln(payment.studentTotalGrosze)}</dd>
      </div>
    </dl>
  )
}

function LessonPackageInfoDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Jak działają pakiety?</DialogTitle>
          <DialogDescription>Najważniejsze zasady rezerwacji z pakietu lekcji.</DialogDescription>
        </DialogHeader>
        <DialogBody>
          <p className="text-sm leading-relaxed text-muted-foreground">
            Pakiet pozwala opłacić z góry 5 lub 10 lekcji u wybranego nauczyciela.
          </p>
          <ul className="space-y-2 text-sm leading-relaxed text-muted-foreground">
            <li>• Pakiet jest przypisany do konkretnego nauczyciela, przedmiotu i długości lekcji.</li>
            <li>• Przy kolejnej rezerwacji wybierz „Użyj lekcji z pakietu” — nie musisz ponownie płacić za tę lekcję.</li>
            <li>• Liczbę pozostałych lekcji sprawdzisz w sekcji „Moje pakiety” w swoim panelu.</li>
          </ul>
          <div className="rounded-xl border border-border bg-muted/30 p-3">
            <p className="text-xs font-semibold text-foreground">Anulowanie</p>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
              Jeśli nauczyciel odrzuci prośbę o rezerwację lub zaakceptowane zostanie odwołanie kwalifikującej się lekcji, niewykorzystana lekcja wróci do Twojego pakietu.
            </p>
          </div>
        </DialogBody>
        <DialogFooter className="justify-end">
          <Button type="button" onClick={() => onOpenChange(false)} className="font-semibold">
            Rozumiem
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function WizardStepper({ currentStep }: { currentStep: WizardStep }) {
  const steps: { step: WizardStep; label: string }[] = [
    { step: 1, label: 'Termin' },
    { step: 2, label: 'Płatność' },
    { step: 3, label: 'Podsumowanie' },
  ]
  return (
    <div className="px-4 py-4 sm:px-6">
      <div className="grid grid-cols-[1fr_auto_1fr_auto_1fr] items-center gap-2 sm:gap-3">
        {steps.map((item, index) => {
          const active = item.step === currentStep
          const complete = item.step < currentStep
          return (
            <div key={item.step} className={cn('contents', index === steps.length - 1 && '[&>.wizard-line]:hidden')}>
              <div className="flex min-w-0 flex-col items-center gap-1.5 text-center">
                <span
                  className={cn(
                    'flex h-9 w-9 items-center justify-center rounded-full border text-sm font-bold transition-all duration-200 motion-reduce:transition-none',
                    active && 'border-primary bg-primary text-primary-foreground shadow-[0_0_0_4px_rgba(244,180,0,0.16)]',
                    complete && 'border-primary bg-primary text-primary-foreground',
                    !active && !complete && 'border-border bg-background text-muted-foreground',
                  )}
                >
                  {complete ? <Check className="h-4 w-4" aria-hidden="true" /> : item.step}
                </span>
                <span className={cn('truncate text-[11px] font-semibold sm:text-xs', active || complete ? 'text-foreground' : 'text-muted-foreground')}>
                  {item.label}
                </span>
              </div>
              {index < steps.length - 1 && (
                <div className="wizard-line h-0.5 min-w-0 overflow-hidden rounded-full bg-border">
                  <div
                    className={cn(
                      'h-full rounded-full bg-primary transition-all duration-300 motion-reduce:transition-none',
                      currentStep > item.step ? 'w-full' : 'w-0',
                    )}
                  />
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
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
  const [paymentChoice, setPaymentChoice] = useState<PaymentChoice>('single')
  const [selectedPackageSize, setSelectedPackageSize] = useState<5 | 10>((offeredPackageSizes[0] as 5 | 10 | undefined) ?? 5)
  const [packagePurchaseMode, setPackagePurchaseMode] = useState<PackagePurchaseMode>('package_only')
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
  const [packageInfoOpen, setPackageInfoOpen] = useState(false)
  const [currentStep, setCurrentStep] = useState<WizardStep>(1)
  const wizardTopRef = useRef<HTMLDivElement | null>(null)
  const packageBookingRequestIdRef = useRef<string | null>(null)
  const submittingRef = useRef(false)
  const bookingDuration = lessonKind === 'trial' && trialConfig.enabled ? trialConfig.duration : duration
  const price = lessonKind === 'trial' && trialConfig.enabled
    ? fromGrosze(trialConfig.priceGrosze)
    : Math.round((teacher.hourlyRate / 60) * duration)
  const subtotalGrosze = lessonKind === 'trial' && trialConfig.enabled ? trialConfig.priceGrosze : toGrosze(price)
  const singlePayment = buildStudentPaymentBreakdown(subtotalGrosze)
  const firstRegularDuration = offeredDurations[0] ?? 60
  const firstRegularSubtotalGrosze = toGrosze(Math.round((teacher.hourlyRate / 60) * firstRegularDuration))
  const firstRegularPayment = buildStudentPaymentBreakdown(firstRegularSubtotalGrosze)
  const trialPayment = trialConfig.enabled ? buildStudentPaymentBreakdown(trialConfig.priceGrosze) : null
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
  const matchingPackages = lessonKind === 'regular'
    ? lessonPackages.filter((pkg) => (
        pkg.status === 'active' &&
        pkg.remainingCredits > 0 &&
        pkg.duration === bookingDuration &&
        pkg.subjectKey === selectedPackageSubjectKey
      ))
    : []
  const matchingPackage = matchingPackages[0]
  const showPackagePaymentSection = true
  const canBuyPackages = lessonKind === 'regular' && offeredPackageSizes.length > 0
  const selectedPackagePayment = buildStudentPaymentBreakdown(subtotalGrosze * selectedPackageSize)
  const maxRecurringCount = matchingPackage?.remainingCredits ?? 1
  const selectedRecurringCount = recurringEnabled && matchingPackage
    ? Math.min(Math.max(recurringCount, 2), maxRecurringCount)
    : 1
  const recurringPreview = recurringEnabled && matchingPackage && selectedDay && selectedSlot
    ? buildWeeklyLessonOccurrences({ firstDateIso: selectedDay.isoDate, time: selectedSlot, count: selectedRecurringCount }) ?? []
    : []

  useEffect(() => {
    if (paymentChoice === 'existing_package' && !matchingPackage) setPaymentChoice('single')
    if (paymentChoice === 'buy_package' && !canBuyPackages) setPaymentChoice('single')
  }, [canBuyPackages, matchingPackage, paymentChoice])

  useEffect(() => {
    if (paymentChoice !== 'existing_package' || !matchingPackage || matchingPackage.remainingCredits < 2) {
      setRecurringEnabled(false)
    }
    if (matchingPackage) {
      setRecurringCount((count) => Math.min(Math.max(count, 2), Math.max(2, matchingPackage.remainingCredits)))
    }
  }, [matchingPackage, paymentChoice])

  useEffect(() => {
    if (!offeredPackageSizes.includes(selectedPackageSize)) {
      setSelectedPackageSize((offeredPackageSizes[0] as 5 | 10 | undefined) ?? 5)
    }
  }, [offeredPackageSizes, selectedPackageSize])

  useEffect(() => {
    if (!selectedSlot && packagePurchaseMode === 'package_and_book') setPackagePurchaseMode('package_only')
  }, [packagePurchaseMode, selectedSlot])

  useEffect(() => {
    packageBookingRequestIdRef.current = null
  }, [matchingPackage?.id, selectedDay?.isoDate, selectedSlot, bookingDuration, selectedSubjectCategoryId, selectedSubject?.name, topic, recurringEnabled, recurringCount, selectedPackageSize, packagePurchaseMode])

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

  const needsFirstLessonDetails = paymentChoice !== 'buy_package' || packagePurchaseMode === 'package_and_book'
  const canContinueCurrentStep = canContinueBookingWizard({
    step: currentStep,
    hasSlot: Boolean(selectedSlot),
    hasTopic: Boolean(topic.trim()),
    loadingSlots,
    paymentChoice,
    hasMatchingPackage: Boolean(matchingPackage),
    canBuyPackages,
  })
  const canSubmit = canSubmitBookingWizard({
    step: currentStep,
    userSignedIn: Boolean(user),
    submitting,
    loadingSlots,
    paymentChoice,
    packageMode: packagePurchaseMode,
    hasSlot: Boolean(selectedSlot),
    hasTopic: Boolean(topic.trim()),
    hasMatchingPackage: Boolean(matchingPackage),
    canBuyPackages,
  })
  const summaryKind = bookingWizardSummaryKind({ paymentChoice, packageMode: packagePurchaseMode })
  const ctaLabel = paymentChoice === 'existing_package' && matchingPackage
    ? 'Zarezerwuj z pakietu'
    : paymentChoice === 'buy_package'
      ? packagePurchaseMode === 'package_and_book'
        ? 'Kup pakiet i zarezerwuj'
        : 'Kup pakiet na później'
      : isFirebaseConfigured
        ? 'Zapłać i zarezerwuj'
        : 'Wyślij prośbę o rezerwację'

  useEffect(() => {
    const prefersReducedMotion = typeof window !== 'undefined'
      && window.matchMedia('(prefers-reduced-motion: reduce)').matches
    wizardTopRef.current?.scrollIntoView({ behavior: prefersReducedMotion ? 'auto' : 'smooth', block: 'start' })
  }, [currentStep])

  function goNext() {
    if (!canContinueCurrentStep) return
    setError(null)
    setCurrentStep((step) => (step === 1 ? 2 : step === 2 ? 3 : step))
  }

  function goBack() {
    setError(null)
    setCurrentStep((step) => (step === 3 ? 2 : step === 2 ? 1 : step))
  }

  // Real (Firebase-configured) mode: payment happens now, via a real
  // Stripe Checkout redirect — the lesson itself isn't created until
  // Stripe confirms the payment actually succeeded (see the webhook at
  // app/api/stripe/webhook/route.ts), so there's no "book now, pay
  // later" gap and no way to book without paying. Mock mode keeps the
  // old instant local demo booking (no real payment processor either
  // way in that mode).
  async function handleConfirm() {
    if (currentStep !== 3 || submittingRef.current) return
    const needsFirstLesson = paymentChoice !== 'buy_package' || packagePurchaseMode === 'package_and_book'
    if (!user || !selectedDay) return
    if (needsFirstLesson && (!selectedSlot || !topic.trim())) return
    submittingRef.current = true
    setSubmitting(true)
    setError(null)
    let redirected = false
    try {
      if (isFirebaseConfigured) {
        if (paymentChoice === 'existing_package' && matchingPackage && selectedSlot) {
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
        if (paymentChoice === 'buy_package') {
          const url = await startLessonPackageCheckout({
            teacherId: teacher.id,
            packageSize: selectedPackageSize,
            duration: bookingDuration,
            subjectCategoryId: selectedSubjectCategoryId,
            specialty: selectedSubject?.name ?? teacher.specialty,
            studentId: bookingFor?.id ?? user.id,
            studentName: bookingFor?.name ?? user.name,
            payer: bookingFor ? { id: user.id, role: 'parent' } : undefined,
            purchaseMode: packagePurchaseMode,
            ...(packagePurchaseMode === 'package_and_book' && selectedSlot ? {
              booking: {
                date: selectedDay.dayLabel,
                dateIso: selectedDay.isoDate,
                time: selectedSlot,
                scheduledStartAt: selectedStartAt(),
                topic: topic.trim(),
                bookingRequestId: nextPackageBookingRequestId(),
              },
            } : {}),
          })
          redirected = true
          window.location.href = url
          return
        }
        if (!selectedSlot || !topic.trim()) return
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
        redirected = true
        window.location.href = url
        return
      }
      if (!selectedSlot || !topic.trim()) return
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
      if (!redirected) {
        submittingRef.current = false
        setSubmitting(false)
      }
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
          {bookedLessonCount > 1 ? `${bookedLessonCount} lekcje co tydzień od ` : ''}{selectedDay.dayLabel} o {selectedSlot} z {teacher.name} · {selectedSubject?.name ?? teacher.specialty} · {lessonKindLabel} · {bookingDuration} min · {paymentChoice === 'existing_package' ? 'z pakietu' : pln(singlePayment.studentTotalGrosze)}
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
    <div ref={wizardTopRef} className="mx-auto flex w-full max-w-4xl flex-col gap-4">
      <div className="animate-fade-in-up overflow-hidden rounded-2xl border border-border bg-card shadow-[0_24px_80px_-60px_rgba(0,0,0,0.9)]">
        <div className="border-b border-border bg-muted/30 px-5 py-4 sm:px-6">
          <div className="flex items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent text-accent-foreground">
              <CalendarRange className="h-4 w-4" aria-hidden="true" />
            </span>
            <div>
              <p className="text-sm font-semibold text-foreground">Rezerwacja do {BOOKING_WINDOW_DAYS} dni do przodu</p>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                Godziny uwzględniają długość lekcji, zajęte terminy i {LESSON_BUFFER_MINUTES} min zapasu po spotkaniu.
              </p>
            </div>
          </div>
        </div>

        <WizardStepper currentStep={currentStep} />

        <div
          key={currentStep}
          className="min-h-[34rem] border-t border-border px-5 py-6 motion-safe:animate-[fade-in-up_220ms_ease-out] sm:px-6"
        >
          {currentStep === 1 && (
            <div className="space-y-6">
              <div>
                <p className="text-xs font-semibold uppercase text-primary">Krok 1</p>
                <h2 className="mt-1 text-2xl font-bold text-foreground">Termin</h2>
                <p className="mt-1 text-sm text-muted-foreground">Wybierz przedmiot, typ lekcji, długość, godzinę i temat spotkania.</p>
              </div>

              {normalizedSubjects.length > 1 && (
                <section className="rounded-2xl border border-border bg-background/60 p-4">
                  <h3 className="text-sm font-semibold text-foreground">Przedmiot</h3>
                  <div className="mt-3 grid gap-2 sm:grid-cols-2">
                    {normalizedSubjects.map((subject) => {
                      const active = selectedSubjectId === subject.id
                      return (
                        <button
                          key={subject.id}
                          type="button"
                          onClick={() => setSelectedSubjectId(subject.id)}
                          aria-pressed={active}
                          className={cn(
                            'flex min-h-12 items-center justify-between gap-2 rounded-xl border px-3 py-2 text-left text-sm transition-all hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60 motion-reduce:transition-none motion-reduce:hover:translate-y-0',
                            active
                              ? 'border-primary bg-accent font-semibold text-accent-foreground'
                              : 'border-border bg-card text-muted-foreground hover:text-foreground',
                          )}
                        >
                          <span>{subject.name}</span>
                          {active && <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden="true" />}
                        </button>
                      )
                    })}
                  </div>
                </section>
              )}

              {hasTrialOption && (
                <section className="rounded-2xl border border-border bg-background/60 p-4">
                  <h3 className="text-sm font-semibold text-foreground">Rodzaj lekcji</h3>
                  <div className="mt-3 grid gap-2 sm:grid-cols-2">
                    <button
                      type="button"
                      onClick={() => { setLessonKind('regular'); setSelectedSlot(null) }}
                      aria-pressed={lessonKind === 'regular'}
                      className={cn(
                        'flex min-h-20 flex-col items-start justify-center rounded-xl border px-4 py-3 text-left text-sm transition-all hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60 motion-reduce:transition-none motion-reduce:hover:translate-y-0',
                        lessonKind === 'regular'
                          ? 'border-primary bg-accent font-semibold text-accent-foreground'
                          : 'border-border bg-card text-muted-foreground hover:text-foreground',
                      )}
                    >
                      <span>Lekcja standardowa</span>
                      <span className="text-xs font-normal opacity-90">od {pln(firstRegularPayment.subtotalGrosze)} / {firstRegularDuration} min</span>
                    </button>
                    {trialPayment && (
                      <button
                        type="button"
                        onClick={() => { setLessonKind('trial'); setSelectedSlot(null) }}
                        aria-pressed={lessonKind === 'trial'}
                        className={cn(
                          'flex min-h-20 flex-col items-start justify-center rounded-xl border px-4 py-3 text-left text-sm transition-all hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60 motion-reduce:transition-none motion-reduce:hover:translate-y-0',
                          lessonKind === 'trial'
                            ? 'border-primary bg-accent font-semibold text-accent-foreground'
                            : 'border-border bg-card text-muted-foreground hover:text-foreground',
                        )}
                      >
                        <span>Lekcja próbna</span>
                        <span className="text-xs font-normal opacity-90">{trialConfig.duration} min · {pln(trialPayment.subtotalGrosze)}</span>
                      </button>
                    )}
                  </div>
                </section>
              )}

              <section className="rounded-2xl border border-border bg-background/60 p-4">
                <h3 className="text-sm font-semibold text-foreground">Długość</h3>
                {lessonKind === 'trial' && trialConfig.enabled ? (
                  <p className="mt-3 inline-flex rounded-xl border border-primary/30 bg-accent px-4 py-2 text-sm font-semibold text-accent-foreground">
                    Lekcja próbna: {trialConfig.duration} min
                  </p>
                ) : (
                  <div className="mt-3 grid gap-2 sm:grid-cols-3">
                    {durationOptions.map((d) => (
                      <button
                        key={d.minutes}
                        type="button"
                        onClick={() => { setDuration(d.minutes); setSelectedSlot(null) }}
                        className={cn(
                          'min-h-11 rounded-xl border px-4 py-2 text-sm font-medium transition-all hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60 motion-reduce:transition-none motion-reduce:hover:translate-y-0',
                          duration === d.minutes
                            ? 'border-primary bg-primary text-primary-foreground'
                            : 'border-border bg-card text-foreground hover:bg-muted',
                        )}
                      >
                        {d.label}
                      </button>
                    ))}
                  </div>
                )}
              </section>

              <section className="rounded-2xl border border-border bg-background/60 p-4">
                <h3 className="text-sm font-semibold text-foreground">Dzień</h3>
                <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7">
                  {days.map((day, i) => (
                    <button
                      key={day.isoDate}
                      type="button"
                      onClick={() => { setSelectedDayIndex(i); setSelectedSlot(null) }}
                      className={cn(
                        'flex min-h-14 flex-col items-center justify-center gap-0.5 rounded-xl border px-2 py-2 text-xs font-medium transition-all hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60 motion-reduce:transition-none motion-reduce:hover:translate-y-0',
                        i === selectedDayIndex
                          ? 'border-primary bg-accent text-accent-foreground'
                          : 'border-border bg-card text-muted-foreground hover:bg-muted hover:text-foreground',
                      )}
                    >
                      <span>{day.weekdayLabel}</span>
                      <span className="text-[11px] opacity-80">{day.dayLabel.split(', ')[1]}</span>
                    </button>
                  ))}
                </div>
              </section>

              <section className="rounded-2xl border border-border bg-background/60 p-4">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-semibold text-foreground">Godzina — {selectedDay.dayLabel}</h3>
                  {loadingSlots && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" aria-hidden="true" />}
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-6">
                  {selectedDay.slots.map((slot) => {
                    const disabled = slot.status !== 'available'
                    return (
                      <button
                        key={slot.time}
                        type="button"
                        disabled={disabled}
                        onClick={() => setSelectedSlot(slot.time)}
                        className={cn(
                          'inline-flex min-h-11 items-center justify-center gap-1.5 rounded-xl border px-3 text-sm font-semibold transition-all disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60 motion-reduce:transition-none',
                          selectedSlot === slot.time
                            ? 'border-primary bg-primary text-primary-foreground shadow-sm'
                            : disabled
                              ? 'border-border bg-muted/70 text-muted-foreground'
                              : 'border-border bg-card text-foreground hover:-translate-y-0.5 hover:border-primary/40 hover:bg-accent/60 motion-reduce:hover:translate-y-0',
                        )}
                      >
                        {slot.status === 'booked' && <Lock className="h-3 w-3" aria-hidden="true" />}
                        {slot.time}
                      </button>
                    )
                  })}
                </div>
                {selectedDay.slots.every((slot) => slot.status !== 'available') && (
                  <p className="mt-3 text-xs text-muted-foreground">
                    Brak wolnych godzin dla lekcji {bookingDuration} min.
                  </p>
                )}
              </section>

              <section className="rounded-2xl border border-border bg-background/60 p-4">
                <h3 className="text-sm font-semibold text-foreground">Temat lekcji</h3>
                <Textarea
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  placeholder="np. Konfiguracja bloków funkcyjnych w TIA Portal, przygotowanie do egzaminu certyfikacyjnego..."
                  rows={3}
                  className="mt-3"
                />
              </section>
            </div>
          )}

          {currentStep === 2 && (
            <div className="space-y-6">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase text-primary">Krok 2</p>
                  <h2 className="mt-1 text-2xl font-bold text-foreground">Płatność</h2>
                  <p className="mt-1 text-sm text-muted-foreground">Wybierz sposób opłacenia tej rezerwacji lub pakietu.</p>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setPackageInfoOpen(true)}
                  className="w-fit text-xs text-muted-foreground hover:text-foreground"
                >
                  <Info className="h-3.5 w-3.5" aria-hidden="true" />
                  Jak działają pakiety?
                </Button>
              </div>

              {matchingPackage && (
                <div className="rounded-2xl border border-primary/30 bg-accent px-4 py-3 text-sm text-accent-foreground">
                  <div className="flex items-start gap-2.5">
                    <PackageCheck className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                    <div>
                      <p className="font-semibold">Masz aktywny pakiet</p>
                      <p className="mt-0.5 text-xs leading-relaxed opacity-90">
                        {remainingLessonsText(matchingPackage.remainingCredits)} dla {selectedSubject?.name ?? teacher.specialty} · {bookingDuration} min.
                        {matchingPackages.length > 1 ? ' Użyjemy najstarszego pasującego pakietu.' : ''}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              <div className="grid gap-3 md:grid-cols-3">
                <button
                  type="button"
                  onClick={() => setPaymentChoice('single')}
                  aria-pressed={paymentChoice === 'single'}
                  className={cn(
                    'flex min-h-28 flex-col items-start justify-between rounded-2xl border p-4 text-left transition-all hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60 motion-reduce:transition-none motion-reduce:hover:translate-y-0',
                    paymentChoice === 'single'
                      ? 'border-primary bg-accent text-accent-foreground'
                      : 'border-border bg-background/70 text-muted-foreground hover:text-foreground',
                  )}
                >
                  <span className="text-sm font-semibold">Jedna lekcja</span>
                  <span className="text-xs opacity-85">Cena lekcji {pln(singlePayment.subtotalGrosze)}</span>
                  <span className="text-[11px] opacity-75">Opłata {pln(singlePayment.studentServiceFeeGrosze)}</span>
                </button>
                <button
                  type="button"
                  onClick={() => matchingPackage && setPaymentChoice('existing_package')}
                  disabled={!matchingPackage}
                  aria-pressed={paymentChoice === 'existing_package'}
                  className={cn(
                    'flex min-h-28 flex-col items-start justify-between rounded-2xl border p-4 text-left transition-all disabled:cursor-not-allowed disabled:opacity-50 hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60 motion-reduce:transition-none motion-reduce:hover:translate-y-0',
                    paymentChoice === 'existing_package'
                      ? 'border-primary bg-accent text-accent-foreground'
                      : 'border-border bg-background/70 text-muted-foreground hover:text-foreground',
                  )}
                >
                  <span className="text-sm font-semibold">Wykorzystaj posiadany pakiet</span>
                  <span className="text-xs opacity-85">{matchingPackage ? `${matchingPackage.remainingCredits} dostępne` : 'Brak pasującego pakietu'}</span>
                  <span className="text-[11px] opacity-75">Bez nowej opłaty serwisowej</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setPaymentChoice('buy_package')
                    setPackagePurchaseMode(selectedSlot ? 'package_and_book' : 'package_only')
                  }}
                  disabled={!canBuyPackages}
                  aria-pressed={paymentChoice === 'buy_package'}
                  className={cn(
                    'flex min-h-28 flex-col items-start justify-between rounded-2xl border p-4 text-left transition-all disabled:cursor-not-allowed disabled:opacity-50 hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60 motion-reduce:transition-none motion-reduce:hover:translate-y-0',
                    paymentChoice === 'buy_package'
                      ? 'border-primary bg-accent text-accent-foreground'
                      : 'border-border bg-background/70 text-muted-foreground hover:text-foreground',
                  )}
                >
                  <span className="text-sm font-semibold">Kup pakiet lekcji</span>
                  <span className="text-xs opacity-85">{canBuyPackages ? '5 lub 10 lekcji u tego nauczyciela' : 'Niedostępne dla tego wyboru'}</span>
                  <span className="text-[11px] opacity-75">Opłata naliczana raz</span>
                </button>
              </div>

              {paymentChoice === 'existing_package' && matchingPackage && (
                <section className="rounded-2xl border border-border bg-background/60 p-4">
                  <label className="flex items-start gap-3 text-sm font-medium text-foreground">
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
                    <div className="mt-4 grid gap-3 sm:grid-cols-[180px_minmax(0,1fr)]">
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
                </section>
              )}

              {paymentChoice === 'buy_package' && (
                <section className="space-y-4 rounded-2xl border border-primary/30 bg-background/70 p-4">
                  <div className="grid gap-2 sm:grid-cols-2">
                    {offeredPackageSizes.map((packageSize) => {
                      const packagePayment = buildStudentPaymentBreakdown(subtotalGrosze * packageSize)
                      const active = selectedPackageSize === packageSize
                      return (
                        <button
                          key={packageSize}
                          type="button"
                          onClick={() => setSelectedPackageSize(packageSize)}
                          aria-pressed={active}
                          className={cn(
                            'flex min-h-20 flex-col items-start justify-center rounded-xl border px-4 py-3 text-left text-sm transition-all hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60 motion-reduce:transition-none motion-reduce:hover:translate-y-0',
                            active
                              ? 'border-primary bg-accent font-semibold text-accent-foreground'
                              : 'border-border bg-card text-muted-foreground hover:text-foreground',
                          )}
                        >
                          <span>Pakiet {packageSize} lekcji</span>
                          <span className="text-xs font-normal opacity-90">Cena pakietu {pln(packagePayment.subtotalGrosze)}</span>
                          <span className="text-[11px] font-normal opacity-75">Łącznie {pln(packagePayment.studentTotalGrosze)}</span>
                        </button>
                      )
                    })}
                  </div>
                  <div className="grid gap-2 sm:grid-cols-2">
                    <button
                      type="button"
                      disabled={!selectedSlot}
                      onClick={() => selectedSlot && setPackagePurchaseMode('package_and_book')}
                      aria-pressed={packagePurchaseMode === 'package_and_book'}
                      className={cn(
                        'rounded-xl border px-4 py-3 text-left text-sm transition-all disabled:cursor-not-allowed disabled:opacity-50 hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60 motion-reduce:transition-none motion-reduce:hover:translate-y-0',
                        packagePurchaseMode === 'package_and_book'
                          ? 'border-primary bg-accent font-semibold text-accent-foreground'
                          : 'border-border bg-card text-muted-foreground hover:text-foreground',
                      )}
                    >
                      <span className="block">Kup i zarezerwuj pierwszą lekcję</span>
                      <span className="mt-1 block text-xs font-normal opacity-80">Po sukcesie zostanie {selectedPackageSize - 1}/{selectedPackageSize} lekcji.</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setPackagePurchaseMode('package_only')}
                      aria-pressed={packagePurchaseMode === 'package_only'}
                      className={cn(
                        'rounded-xl border px-4 py-3 text-left text-sm transition-all hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60 motion-reduce:transition-none motion-reduce:hover:translate-y-0',
                        packagePurchaseMode === 'package_only'
                          ? 'border-primary bg-accent font-semibold text-accent-foreground'
                          : 'border-border bg-card text-muted-foreground hover:text-foreground',
                      )}
                    >
                      <span className="block">Kup sam pakiet na później</span>
                      <span className="mt-1 block text-xs font-normal opacity-80">Otrzymasz pełne {selectedPackageSize}/{selectedPackageSize} lekcji.</span>
                    </button>
                  </div>
                  <p className="rounded-xl border border-warning/30 bg-warning-surface px-3 py-2 text-xs leading-relaxed text-muted-foreground">
                    {packagePurchaseMode === 'package_and_book'
                      ? `Zakup pakietu nie gwarantuje dostępności terminu przed zakończeniem płatności. Jeśli termin zajmie ktoś inny, zachowasz pełne ${selectedPackageSize}/${selectedPackageSize} lekcji.`
                      : 'Kupujesz pakiet na później. Wybrany w kroku Termin slot nie zostanie zarezerwowany ani wysłany do nauczyciela.'}
                  </p>
                </section>
              )}
            </div>
          )}

          {currentStep === 3 && (
            <div className="space-y-6">
              <div>
                <p className="text-xs font-semibold uppercase text-primary">Krok 3</p>
                <h2 className="mt-1 text-2xl font-bold text-foreground">Podsumowanie</h2>
                <p className="mt-1 text-sm text-muted-foreground">Sprawdź szczegóły przed finalną akcją. Checkout startuje dopiero tutaj.</p>
              </div>

              <section className="grid gap-3 rounded-2xl border border-border bg-background/60 p-4 sm:grid-cols-2">
                <div>
                  <p className="text-xs text-muted-foreground">Nauczyciel</p>
                  <p className="mt-1 font-semibold text-foreground">{teacher.name}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Przedmiot</p>
                  <p className="mt-1 font-semibold text-foreground">{selectedSubject?.name ?? teacher.specialty}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Lekcja</p>
                  <p className="mt-1 font-semibold text-foreground">{lessonKindLabel} · {bookingDuration} min</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Termin</p>
                  <p className="mt-1 font-semibold text-foreground">
                    {summaryKind === 'package_only'
                      ? 'Nie rezerwujemy terminu przy zakupie pakietu na później'
                      : `${selectedDay.dayLabel} · ${selectedSlot}`}
                  </p>
                </div>
              </section>

              <section className="rounded-2xl border border-border bg-background/60 p-4">
                <p className="text-xs text-muted-foreground">Sposób płatności</p>
                <p className="mt-1 text-lg font-bold text-foreground">
                  {summaryKind === 'existing_package'
                    ? 'Lekcja z posiadanego pakietu'
                    : summaryKind === 'package_only'
                      ? `Pakiet ${selectedPackageSize} lekcji na później`
                      : summaryKind === 'package_and_book'
                        ? `Pakiet ${selectedPackageSize} lekcji + pierwsza rezerwacja`
                        : 'Pojedyncza lekcja'}
                </p>
                {summaryKind === 'existing_package' && matchingPackage ? (
                  <p className="mt-2 text-sm text-muted-foreground">Ta rezerwacja nie nalicza nowej opłaty serwisowej. Po rezerwacji pozostanie {matchingPackage.remainingCredits - selectedRecurringCount}/{matchingPackage.packageSize} lekcji dostępnych i {selectedRecurringCount} zarezerwowane.</p>
                ) : null}
                {summaryKind === 'package_only' && (
                  <p className="mt-2 text-sm text-muted-foreground">Wybrany termin z kroku 1 nie zostanie użyty. Pakiet pojawi się w panelu ucznia z pełną pulą {selectedPackageSize}/{selectedPackageSize} lekcji.</p>
                )}
                {summaryKind === 'package_and_book' && (
                  <p className="mt-2 text-sm text-muted-foreground">Po płatności spróbujemy wysłać pierwszą rezerwację jako oczekującą. Jeśli termin będzie zajęty, zachowasz pełne {selectedPackageSize}/{selectedPackageSize} lekcji.</p>
                )}
                {summaryKind === 'existing_package' && matchingPackage ? (
                  <div className="mt-4 rounded-xl border border-primary/30 bg-accent p-4 text-accent-foreground">
                    <p className="text-2xl font-bold">Z pakietu</p>
                    <p className="mt-1 text-xs opacity-85">Bez płatności Stripe i bez nowej opłaty serwisowej.</p>
                  </div>
                ) : summaryKind === 'package_only' || summaryKind === 'package_and_book' ? (
                  <PriceBreakdown payment={selectedPackagePayment} subtotalLabel={`Pakiet ${selectedPackageSize} lekcji`} />
                ) : (
                  <PriceBreakdown payment={singlePayment} />
                )}
              </section>

              {topic.trim() && summaryKind !== 'package_only' && (
                <section className="rounded-2xl border border-border bg-background/60 p-4">
                  <p className="text-xs text-muted-foreground">Temat</p>
                  <p className="mt-1 text-sm text-foreground">{topic.trim()}</p>
                </section>
              )}
            </div>
          )}
        </div>

        <div className="flex flex-col gap-3 border-t border-border bg-muted/30 p-5 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <Button
            type="button"
            variant="outline"
            onClick={goBack}
            disabled={currentStep === 1 || submitting}
            className="font-semibold sm:w-auto"
          >
            Wstecz
          </Button>
          {currentStep < 3 ? (
            <Button
              type="button"
              onClick={goNext}
              disabled={!canContinueCurrentStep}
              className="font-semibold transition-transform hover:-translate-y-0.5 disabled:hover:translate-y-0 motion-reduce:transition-none motion-reduce:hover:translate-y-0 sm:w-auto"
            >
              Dalej
            </Button>
          ) : (
            <Button
              type="button"
              onClick={handleConfirm}
              disabled={!canSubmit}
              className="font-semibold transition-transform hover:-translate-y-0.5 disabled:hover:translate-y-0 motion-reduce:transition-none motion-reduce:hover:translate-y-0 sm:w-auto"
            >
              {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {ctaLabel}
            </Button>
          )}
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

      <LessonPackageInfoDialog open={packageInfoOpen} onOpenChange={setPackageInfoOpen} />
    </div>
  )
}
