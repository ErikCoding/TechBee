'use client'

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { BOOKING_WINDOW_DAYS, buildAvailability, type AvailabilityDay } from '@/lib/availability'
import { LESSON_DURATION_OPTIONS, normalizeLessonDurations } from '@/lib/lesson-durations'
import { zonedDateTimeToMs } from '@/lib/lesson-time'
import { fromGrosze, toGrosze } from '@/lib/stripe-config'
import { buildStudentPaymentBreakdown, type StudentPaymentBreakdown } from '@/lib/service-fees'
import { resolveTeacherTrialLessonConfig } from '@/lib/trial-lessons'
import { normalizeOfferedLessonPackageSizes, packageSubjectKey } from '@/lib/lesson-packages-core'
import {
  BOOKING_STEP_SLUGS,
  applyBookingSelectionPatch,
  bookingWizardSummaryKind,
  isBookingStepValid,
  resolveBookingStepGuard,
  sanitizeStoredBookingSelections,
  type BookingSelections,
  type BookingWizardStep,
} from '@/lib/booking-wizard-core'
import { useAuth } from '@/lib/auth-context'
import { isFirebaseConfigured } from '@/lib/firebase'
import { createBooking, getTeacherBookedLessonSlots } from '@/services/lessons.service'
import { startLessonCheckout, startLessonPackageCheckout } from '@/services/stripe.service'
import { bookLessonWithPackageCredit, getStudentLessonPackagesForTeacher } from '@/services/lesson-packages.service'
import type { BookedLessonSlot, LessonPackage, Teacher } from '@/lib/types'

export interface BookingSubject { id: string; name: string; custom?: boolean }
export interface BookingForStudent { id: string; name: string }

const STORAGE_VERSION = 1
const STORAGE_TTL_MS = 2 * 60 * 60 * 1000

export function pln(grosze: number): string {
  return `${fromGrosze(grosze).toLocaleString('pl-PL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} zł`
}

interface BookingFlowValue {
  teacher: Teacher
  subjects: BookingSubject[]
  bookingFor?: BookingForStudent
  selections: BookingSelections
  update: (patch: Partial<BookingSelections>) => void
  /** Selections restored (or defaulted) and slot/package data loaded — safe to validate and guard. */
  ready: boolean
  loadingSlots: boolean
  days: AvailabilityDay[]
  selectedDay?: AvailabilityDay
  selectedSubject: BookingSubject
  durationOptions: { minutes: number; label: string }[]
  offeredPackageSizes: number[]
  trialConfig: ReturnType<typeof resolveTeacherTrialLessonConfig>
  bookingDuration: number
  singlePayment: StudentPaymentBreakdown
  packagePayment: StudentPaymentBreakdown
  firstRegularPayment: StudentPaymentBreakdown
  firstRegularDuration: number
  trialPayment: StudentPaymentBreakdown | null
  /** Subtotal of one lesson in grosze (trial or regular at the chosen duration). */
  lessonSubtotalGrosze: number
  matchingPackages: LessonPackage[]
  matchingPackage?: LessonPackage
  canBuyPackages: boolean
  recurringCount: number
  recurringMax: number
  summaryKind: ReturnType<typeof bookingWizardSummaryKind>
  hasTerm: boolean
  stepValid: (step: BookingWizardStep) => boolean
  /** The step a visitor may actually see for a requested step (never skips an incomplete earlier one). */
  guardedStep: (requested: BookingWizardStep) => BookingWizardStep
  stepHref: (step: BookingWizardStep) => string
  submitting: boolean
  error: string | null
  clearError: () => void
  completed: { lessonId: string; count: number } | null
  confirm: () => Promise<void>
}

const BookingFlowContext = createContext<BookingFlowValue | null>(null)

export function useBookingFlow(): BookingFlowValue {
  const value = useContext(BookingFlowContext)
  if (!value) throw new Error('useBookingFlow must be used inside <BookingFlowProvider>')
  return value
}

export function BookingFlowProvider({ teacher, subjects, children }: { teacher: Teacher; subjects: BookingSubject[]; children: ReactNode }) {
  const { user } = useAuth()
  const normalizedSubjects = useMemo(
    () => (subjects.length ? subjects : [{ id: teacher.categoryId, name: teacher.specialty }]),
    [subjects, teacher.categoryId, teacher.specialty],
  )
  const offeredDurations = useMemo(() => normalizeLessonDurations(teacher.lessonDurations), [teacher.lessonDurations])
  const offeredPackageSizes = useMemo(() => normalizeOfferedLessonPackageSizes(teacher.lessonPackageSizes), [teacher.lessonPackageSizes])
  const trialConfig = useMemo(() => resolveTeacherTrialLessonConfig(teacher), [teacher])
  const durationOptions = useMemo(
    () => LESSON_DURATION_OPTIONS.filter((option) => offeredDurations.includes(option.minutes)),
    [offeredDurations],
  )

  const defaults = useMemo<BookingSelections>(() => ({
    subjectId: normalizedSubjects[0]?.id ?? teacher.categoryId,
    lessonKind: 'regular',
    duration: offeredDurations[0] ?? 60,
    dayIso: null,
    slot: null,
    topic: '',
    paymentChoice: 'single',
    packageSize: ((offeredPackageSizes[0] as 5 | 10 | undefined) ?? 5),
    packageMode: 'package_only',
    recurringEnabled: false,
    recurringCount: 2,
  }), [normalizedSubjects, offeredDurations, offeredPackageSizes, teacher.categoryId])

  const limits = useMemo(() => ({
    subjectIds: normalizedSubjects.map((s) => s.id),
    durations: offeredDurations,
    packageSizes: offeredPackageSizes,
    trialEnabled: trialConfig.enabled,
  }), [normalizedSubjects, offeredDurations, offeredPackageSizes, trialConfig.enabled])

  const [selections, setSelections] = useState<BookingSelections>(defaults)
  const [bookingFor, setBookingFor] = useState<BookingForStudent | undefined>(undefined)
  const [hydrated, setHydrated] = useState(false)
  const [bookedSlots, setBookedSlots] = useState<BookedLessonSlot[]>([])
  const [lessonPackages, setLessonPackages] = useState<LessonPackage[]>([])
  const [loadingSlots, setLoadingSlots] = useState(true)
  const [loadingPackages, setLoadingPackages] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [completed, setCompleted] = useState<{ lessonId: string; count: number } | null>(null)
  const submittingRef = useRef(false)
  const packageBookingRequestIdRef = useRef<string | null>(null)

  const storageKey = `runbee:booking:${teacher.id}:${bookingFor?.id ?? 'self'}`

  // 1) Read the bookingFor query (set by the parent flow) once, 2) restore
  // saved selections for that exact teacher+student. Done in an effect, not
  // useSearchParams, so the layout stays statically renderable.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const forId = params.get('bookingForId')
    const forName = params.get('bookingForName')
    const resolvedFor = forId && forName ? { id: forId, name: forName } : undefined
    setBookingFor(resolvedFor)
    try {
      const raw = window.sessionStorage.getItem(`runbee:booking:${teacher.id}:${resolvedFor?.id ?? 'self'}`)
      if (raw) {
        const parsed = JSON.parse(raw) as { v?: number; savedAt?: number; selections?: unknown }
        if (parsed.v === STORAGE_VERSION && typeof parsed.savedAt === 'number' && Date.now() - parsed.savedAt < STORAGE_TTL_MS) {
          setSelections(sanitizeStoredBookingSelections(parsed.selections, defaults, limits))
        }
      }
    } catch {
      // Storage unavailable or corrupt — start from defaults.
    }
    setHydrated(true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [teacher.id])

  useEffect(() => {
    if (!hydrated || completed) return
    try {
      window.sessionStorage.setItem(storageKey, JSON.stringify({ v: STORAGE_VERSION, savedAt: Date.now(), selections }))
    } catch {
      // Best effort only.
    }
  }, [hydrated, selections, storageKey, completed])

  useEffect(() => {
    let cancelled = false
    setLoadingSlots(true)
    getTeacherBookedLessonSlots(teacher.id)
      .then((slots) => { if (!cancelled) setBookedSlots(slots) })
      .finally(() => { if (!cancelled) setLoadingSlots(false) })
    return () => { cancelled = true }
  }, [teacher.id])

  const studentId = bookingFor?.id ?? user?.id
  useEffect(() => {
    if (!hydrated) return
    if (!studentId || !isFirebaseConfigured) {
      setLessonPackages([])
      setLoadingPackages(false)
      return
    }
    let cancelled = false
    setLoadingPackages(true)
    getStudentLessonPackagesForTeacher(studentId, teacher.id)
      .then((packages) => { if (!cancelled) setLessonPackages(packages) })
      .catch(() => { if (!cancelled) setLessonPackages([]) })
      .finally(() => { if (!cancelled) setLoadingPackages(false) })
    return () => { cancelled = true }
  }, [hydrated, studentId, teacher.id])

  const bookingDuration = selections.lessonKind === 'trial' && trialConfig.enabled ? trialConfig.duration : selections.duration
  const lessonSubtotalGrosze = selections.lessonKind === 'trial' && trialConfig.enabled
    ? trialConfig.priceGrosze
    : toGrosze(Math.round((teacher.hourlyRate / 60) * selections.duration))
  const singlePayment = buildStudentPaymentBreakdown(lessonSubtotalGrosze)
  const packagePayment = buildStudentPaymentBreakdown(lessonSubtotalGrosze * selections.packageSize)
  const firstRegularDuration = offeredDurations[0] ?? 60
  const firstRegularPayment = buildStudentPaymentBreakdown(toGrosze(Math.round((teacher.hourlyRate / 60) * firstRegularDuration)))
  const trialPayment = trialConfig.enabled ? buildStudentPaymentBreakdown(trialConfig.priceGrosze) : null

  const days = useMemo(
    () => buildAvailability(
      teacher.availability,
      { start: teacher.availabilityStart ?? '09:00', end: teacher.availabilityEnd ?? '17:00' },
      BOOKING_WINDOW_DAYS,
      { duration: bookingDuration, bookedLessons: bookedSlots, availabilityHours: teacher.availabilityHours },
    ),
    [teacher.availability, teacher.availabilityStart, teacher.availabilityEnd, teacher.availabilityHours, bookingDuration, bookedSlots],
  )
  const selectedDay = selections.dayIso ? days.find((d) => d.isoDate === selections.dayIso) : undefined
  const termAvailable = Boolean(
    selectedDay && selections.slot && selectedDay.slots.some((slot) => slot.time === selections.slot && slot.status === 'available'),
  )
  const hasTerm = Boolean(selections.dayIso && selections.slot) && termAvailable

  const selectedSubject = normalizedSubjects.find((s) => s.id === selections.subjectId) ?? normalizedSubjects[0]
  const selectedSubjectCategoryId = selectedSubject?.custom ? undefined : selectedSubject?.id
  const selectedPackageSubjectKey = packageSubjectKey({
    subjectCategoryId: selectedSubjectCategoryId,
    specialty: selectedSubject?.name ?? teacher.specialty,
  })
  const matchingPackages = selections.lessonKind === 'regular'
    ? lessonPackages.filter((pkg) => (
        pkg.status === 'active' &&
        pkg.remainingCredits > 0 &&
        pkg.duration === bookingDuration &&
        pkg.subjectKey === selectedPackageSubjectKey
      ))
    : []
  const matchingPackage = matchingPackages[0]
  const canBuyPackages = selections.lessonKind === 'regular' && offeredPackageSizes.length > 0
  const recurringMax = matchingPackage?.remainingCredits ?? 1
  const recurringCount = selections.recurringEnabled && matchingPackage
    ? Math.min(Math.max(selections.recurringCount, 2), recurringMax)
    : 1

  const ready = hydrated && !loadingSlots && !loadingPackages

  // Drop choices that stopped being valid once real data is known
  // (slot taken in the meantime, package used up, ...). Only after ready,
  // so a refresh never wipes a restored choice before data arrives.
  useEffect(() => {
    if (!ready) return
    const patch: Partial<BookingSelections> = {}
    if (selections.slot && !termAvailable) { patch.slot = null; patch.dayIso = selections.dayIso && selectedDay ? selections.dayIso : null }
    if (selections.paymentChoice === 'existing_package' && !matchingPackage) patch.paymentChoice = 'single'
    if (selections.paymentChoice === 'buy_package' && !canBuyPackages) patch.paymentChoice = 'single'
    if (selections.recurringEnabled && (!matchingPackage || matchingPackage.remainingCredits < 2)) patch.recurringEnabled = false
    if (Object.keys(patch).length) setSelections((prev) => applyBookingSelectionPatch(prev, patch))
  }, [ready, selections, termAvailable, selectedDay, matchingPackage, canBuyPackages])

  // A new idempotency key for package bookings whenever anything the server
  // would see changes; the same key is reused on a retry of the same intent.
  useEffect(() => {
    packageBookingRequestIdRef.current = null
  }, [matchingPackage?.id, selections, bookingFor?.id])

  const update = useCallback((patch: Partial<BookingSelections>) => {
    setError(null)
    setSelections((prev) => applyBookingSelectionPatch(prev, patch))
  }, [])

  const ctx = useMemo(() => ({ termAvailable, canBuyPackages, hasMatchingPackage: Boolean(matchingPackage) }), [termAvailable, canBuyPackages, matchingPackage])
  const stepValid = useCallback((step: BookingWizardStep) => isBookingStepValid(step, selections, ctx), [selections, ctx])
  const guardedStep = useCallback((requested: BookingWizardStep) => resolveBookingStepGuard({
    requested,
    step1Valid: isBookingStepValid(1, selections, ctx),
    step2Valid: isBookingStepValid(2, selections, ctx),
  }), [selections, ctx])

  const stepHref = useCallback((step: BookingWizardStep) => {
    const qs = bookingFor ? `?${new URLSearchParams({ bookingForId: bookingFor.id, bookingForName: bookingFor.name }).toString()}` : ''
    return `/teacher/${teacher.id}/book/${BOOKING_STEP_SLUGS[step]}${qs}`
  }, [bookingFor, teacher.id])

  const summaryKind = bookingWizardSummaryKind({ paymentChoice: selections.paymentChoice, packageMode: selections.packageMode })

  // Final action. Checkout / booking is only ever started from here (step 3).
  // Server routes re-validate and recompute prices; nothing below is trusted
  // for money. `submittingRef` blocks double clicks before React re-renders.
  const confirm = useCallback(async () => {
    if (submittingRef.current) return
    if (!user || !selectedSubject) return
    if (!stepValid(1) || !stepValid(2)) return
    const day = selectedDay
    const slot = selections.slot
    const topic = selections.topic.trim()
    const needsFirstLesson = selections.paymentChoice !== 'buy_package' || selections.packageMode === 'package_and_book'
    if (needsFirstLesson && (!day || !slot || !topic)) return

    const startAt = day && slot ? zonedDateTimeToMs(day.isoDate, slot) ?? undefined : undefined
    const payer = bookingFor ? { id: user.id, role: 'parent' as const } : undefined
    const forId = bookingFor?.id ?? user.id
    const forName = bookingFor?.name ?? user.name
    const specialty = selectedSubject.name ?? teacher.specialty
    if (!packageBookingRequestIdRef.current) {
      packageBookingRequestIdRef.current = globalThis.crypto?.randomUUID?.() ?? `pkg-${Date.now()}-${Math.random()}`
    }
    const requestId = packageBookingRequestIdRef.current

    submittingRef.current = true
    setSubmitting(true)
    setError(null)
    let redirected = false
    try {
      if (isFirebaseConfigured) {
        if (selections.paymentChoice === 'existing_package' && matchingPackage && day && slot) {
          const booked = await bookLessonWithPackageCredit({
            packageId: matchingPackage.id,
            teacherId: teacher.id,
            teacherName: teacher.name,
            teacherInitials: teacher.initials,
            teacherColor: teacher.avatarColor,
            teacherPhotoUrl: teacher.photoUrl,
            subjectCategoryId: selectedSubjectCategoryId,
            specialty,
            studentId: forId,
            studentName: forName,
            date: day.dayLabel,
            dateIso: day.isoDate,
            time: slot,
            scheduledStartAt: startAt,
            duration: bookingDuration,
            topic,
            payer,
            occurrenceCount: recurringCount,
            bookingRequestId: requestId,
          })
          setCompleted({ lessonId: booked.lessonId, count: booked.lessonIds?.length ?? recurringCount })
          return
        }
        if (selections.paymentChoice === 'buy_package') {
          const url = await startLessonPackageCheckout({
            teacherId: teacher.id,
            packageSize: selections.packageSize,
            duration: bookingDuration,
            subjectCategoryId: selectedSubjectCategoryId,
            specialty,
            studentId: forId,
            studentName: forName,
            payer,
            purchaseMode: selections.packageMode,
            ...(selections.packageMode === 'package_and_book' && day && slot ? {
              booking: { date: day.dayLabel, dateIso: day.isoDate, time: slot, scheduledStartAt: startAt, topic, bookingRequestId: requestId },
            } : {}),
          })
          redirected = true
          window.location.href = url
          return
        }
        if (!day || !slot) return
        const url = await startLessonCheckout({
          teacherId: teacher.id,
          date: day.dayLabel,
          dateIso: day.isoDate,
          time: slot,
          duration: bookingDuration,
          lessonKind: selections.lessonKind,
          topic,
          subjectCategoryId: selectedSubjectCategoryId,
          specialty,
          studentId: forId,
          studentName: forName,
          payer,
        })
        redirected = true
        window.location.href = url
        return
      }
      if (!day || !slot) return
      const lesson = await createBooking({
        teacherId: teacher.id,
        teacherName: teacher.name,
        teacherInitials: teacher.initials,
        teacherColor: teacher.avatarColor,
        teacherPhotoUrl: teacher.photoUrl,
        subjectCategoryId: selectedSubjectCategoryId,
        specialty,
        studentId: forId,
        studentName: forName,
        date: day.dayLabel,
        dateIso: day.isoDate,
        time: slot,
        scheduledStartAt: startAt,
        duration: bookingDuration,
        lessonKind: selections.lessonKind,
        price: fromGrosze(lessonSubtotalGrosze),
        topic,
        payer,
      })
      setCompleted({ lessonId: lesson.id, count: 1 })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Nie udało się rozpocząć płatności. Spróbuj ponownie.')
    } finally {
      if (!redirected) {
        submittingRef.current = false
        setSubmitting(false)
      }
    }
  }, [
    user, selectedSubject, stepValid, selectedDay, selections, bookingFor, teacher, matchingPackage,
    selectedSubjectCategoryId, bookingDuration, recurringCount, lessonSubtotalGrosze,
  ])

  // A finished in-app booking (package credit / mock mode) must not leave a
  // stale draft behind for the next visit.
  useEffect(() => {
    if (!completed) return
    try { window.sessionStorage.removeItem(storageKey) } catch { /* ignore */ }
  }, [completed, storageKey])

  const value: BookingFlowValue = {
    teacher, subjects: normalizedSubjects, bookingFor, selections, update, ready, loadingSlots, days, selectedDay,
    selectedSubject: selectedSubject!, durationOptions, offeredPackageSizes, trialConfig, bookingDuration,
    singlePayment, packagePayment, firstRegularPayment, firstRegularDuration, trialPayment, lessonSubtotalGrosze,
    matchingPackages, matchingPackage, canBuyPackages, recurringCount, recurringMax, summaryKind, hasTerm,
    stepValid, guardedStep, stepHref, submitting, error, clearError: () => setError(null), completed, confirm,
  }
  return <BookingFlowContext.Provider value={value}>{children}</BookingFlowContext.Provider>
}
