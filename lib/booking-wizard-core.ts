export type BookingWizardStep = 1 | 2 | 3
export type BookingWizardPaymentChoice = 'single' | 'existing_package' | 'buy_package'
export type BookingWizardPackageMode = 'package_only' | 'package_and_book'

export function canContinueBookingWizard(input: {
  step: BookingWizardStep
  hasSlot: boolean
  hasTopic: boolean
  loadingSlots?: boolean
  paymentChoice: BookingWizardPaymentChoice
  hasMatchingPackage?: boolean
  canBuyPackages?: boolean
}): boolean {
  if (input.step === 1) return input.hasSlot && input.hasTopic && !input.loadingSlots
  if (input.step === 2) {
    if (input.paymentChoice === 'existing_package') return Boolean(input.hasMatchingPackage)
    if (input.paymentChoice === 'buy_package') return Boolean(input.canBuyPackages)
    return true
  }
  return false
}

export function canSubmitBookingWizard(input: {
  step: BookingWizardStep
  userSignedIn: boolean
  submitting: boolean
  loadingSlots?: boolean
  paymentChoice: BookingWizardPaymentChoice
  packageMode: BookingWizardPackageMode
  hasSlot: boolean
  hasTopic: boolean
  hasMatchingPackage?: boolean
  canBuyPackages?: boolean
}): boolean {
  if (input.step !== 3 || !input.userSignedIn || input.submitting || input.loadingSlots) return false
  const needsFirstLessonDetails = input.paymentChoice !== 'buy_package' || input.packageMode === 'package_and_book'
  if (needsFirstLessonDetails && (!input.hasSlot || !input.hasTopic)) return false
  if (input.paymentChoice === 'existing_package' && !input.hasMatchingPackage) return false
  if (input.paymentChoice === 'buy_package' && !input.canBuyPackages) return false
  return true
}

export function nextBookingWizardStep(step: BookingWizardStep, canContinue: boolean): BookingWizardStep {
  if (!canContinue) return step
  if (step === 1) return 2
  if (step === 2) return 3
  return 3
}

export function previousBookingWizardStep(step: BookingWizardStep): BookingWizardStep {
  if (step === 3) return 2
  if (step === 2) return 1
  return 1
}

export function bookingWizardSummaryKind(input: {
  paymentChoice: BookingWizardPaymentChoice
  packageMode: BookingWizardPackageMode
}): 'single_lesson' | 'existing_package' | 'package_only' | 'package_and_book' {
  if (input.paymentChoice === 'existing_package') return 'existing_package'
  if (input.paymentChoice === 'buy_package') return input.packageMode
  return 'single_lesson'
}

// ─────────────────────────────────────────────────────────────
// Three-page booking flow (/teacher/[id]/book/termin → platnosc →
// podsumowanie). Selections live in one client provider (so they
// survive client-side navigation, Back/Forward) and are mirrored to
// sessionStorage (so they survive refresh). Only non-sensitive choices
// are stored — never tokens, prices or payment data. The server
// re-validates and recomputes everything at checkout regardless.
// ─────────────────────────────────────────────────────────────

export const BOOKING_STEP_SLUGS = { 1: 'termin', 2: 'platnosc', 3: 'podsumowanie' } as const

export function bookingStepFromSlug(slug: string): BookingWizardStep | null {
  if (slug === 'termin') return 1
  if (slug === 'platnosc') return 2
  if (slug === 'podsumowanie') return 3
  return null
}

export type BookingLessonKind = 'regular' | 'trial'
export type BookingPackageSize = 5 | 10

export interface BookingSelections {
  subjectId: string
  lessonKind: BookingLessonKind
  duration: number
  dayIso: string | null
  slot: string | null
  topic: string
  paymentChoice: BookingWizardPaymentChoice
  packageSize: BookingPackageSize
  packageMode: BookingWizardPackageMode
  recurringEnabled: boolean
  recurringCount: number
}

export interface BookingSelectionLimits {
  subjectIds: string[]
  durations: number[]
  packageSizes: number[]
  trialEnabled: boolean
}

/** Applies a patch and drops every later choice the patch makes invalid (changing subject, lesson kind or duration clears the chosen slot, etc.). */
export function applyBookingSelectionPatch(prev: BookingSelections, patch: Partial<BookingSelections>): BookingSelections {
  const next: BookingSelections = { ...prev, ...patch }
  const slotAffecting = patch.subjectId !== undefined && patch.subjectId !== prev.subjectId
    || patch.lessonKind !== undefined && patch.lessonKind !== prev.lessonKind
    || patch.duration !== undefined && patch.duration !== prev.duration
  if (slotAffecting && patch.slot === undefined) next.slot = null
  if (next.lessonKind === 'trial') {
    next.paymentChoice = 'single'
    next.recurringEnabled = false
  }
  if (!next.slot && next.packageMode === 'package_and_book') next.packageMode = 'package_only'
  if (next.paymentChoice !== 'existing_package') next.recurringEnabled = false
  return next
}

/** Validates data read back from sessionStorage — anything unknown or out of range falls back to the default instead of being trusted. */
export function sanitizeStoredBookingSelections(
  raw: unknown,
  defaults: BookingSelections,
  limits: BookingSelectionLimits,
): BookingSelections {
  if (!raw || typeof raw !== 'object') return defaults
  const r = raw as Record<string, unknown>
  const str = (v: unknown) => (typeof v === 'string' ? v : null)
  const subjectId = limits.subjectIds.includes(str(r.subjectId) ?? '') ? (r.subjectId as string) : defaults.subjectId
  const lessonKind: BookingLessonKind = r.lessonKind === 'trial' && limits.trialEnabled ? 'trial' : 'regular'
  const duration = typeof r.duration === 'number' && limits.durations.includes(r.duration) ? r.duration : defaults.duration
  const dayIso = typeof r.dayIso === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(r.dayIso) ? r.dayIso : null
  const slot = typeof r.slot === 'string' && /^\d{2}:\d{2}$/.test(r.slot) ? r.slot : null
  const topic = (str(r.topic) ?? '').slice(0, 500)
  const paymentChoice: BookingWizardPaymentChoice =
    r.paymentChoice === 'existing_package' || r.paymentChoice === 'buy_package' ? r.paymentChoice : 'single'
  const packageSize = (typeof r.packageSize === 'number' && limits.packageSizes.includes(r.packageSize) ? r.packageSize : defaults.packageSize) as BookingPackageSize
  const packageMode: BookingWizardPackageMode = r.packageMode === 'package_and_book' ? 'package_and_book' : 'package_only'
  const recurringEnabled = r.recurringEnabled === true
  const recurringCount = typeof r.recurringCount === 'number' && r.recurringCount >= 2 && r.recurringCount <= 20 ? Math.floor(r.recurringCount) : defaults.recurringCount
  return applyBookingSelectionPatch(defaults, {
    subjectId, lessonKind, duration, dayIso, slot: dayIso ? slot : null, topic, paymentChoice, packageSize, packageMode, recurringEnabled, recurringCount,
  })
}

/** Which step a visitor may actually see: deep links / refresh can never skip an incomplete earlier step. */
export function resolveBookingStepGuard(input: {
  requested: BookingWizardStep
  step1Valid: boolean
  step2Valid: boolean
}): BookingWizardStep {
  if (input.requested === 1) return 1
  if (!input.step1Valid) return 1
  if (input.requested === 3 && !input.step2Valid) return 2
  return input.requested
}

export interface BookingStepValidityContext {
  /** The chosen day+slot still exists and is bookable for the current duration. */
  termAvailable: boolean
  canBuyPackages: boolean
  hasMatchingPackage: boolean
}

/**
 * Per-step validity for the three-page flow. A term is optional at step 1
 * (package_only needs none) but a slot without a topic, or a trial without
 * a term, is never valid. Step 2 then decides whether the chosen payment
 * option has everything it needs.
 */
export function isBookingStepValid(step: BookingWizardStep, s: BookingSelections, ctx: BookingStepValidityContext): boolean {
  const hasTerm = Boolean(s.dayIso && s.slot) && ctx.termAvailable
  const hasTopic = s.topic.trim().length > 0
  const termOk = hasTerm && hasTopic
  if (s.slot && !hasTerm) return false
  if (s.slot && !hasTopic) return false
  if (step === 1) return s.lessonKind === 'trial' ? termOk : true
  if (s.lessonKind === 'trial') return termOk
  if (s.paymentChoice === 'single') return termOk
  if (s.paymentChoice === 'existing_package') return ctx.hasMatchingPackage && termOk
  return ctx.canBuyPackages && (s.packageMode === 'package_and_book' ? termOk : true)
}

export function bookingCtaLabel(kind: ReturnType<typeof bookingWizardSummaryKind>): string {
  if (kind === 'existing_package') return 'Zarezerwuj z pakietu'
  if (kind === 'package_and_book') return 'Kup pakiet i zarezerwuj'
  if (kind === 'package_only') return 'Kup pakiet'
  return 'Zapłać i zarezerwuj'
}
