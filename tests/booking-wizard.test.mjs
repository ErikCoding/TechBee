import assert from 'node:assert/strict'
import test from 'node:test'
import {
  bookingWizardSummaryKind,
  canContinueBookingWizard,
  canSubmitBookingWizard,
  nextBookingWizardStep,
  previousBookingWizardStep,
} from '../lib/booking-wizard-core.ts'

test('booking wizard navigation validates each step', () => {
  assert.equal(canContinueBookingWizard({
    step: 1,
    hasSlot: false,
    hasTopic: true,
    paymentChoice: 'single',
  }), false)
  assert.equal(canContinueBookingWizard({
    step: 1,
    hasSlot: true,
    hasTopic: true,
    paymentChoice: 'single',
  }), true)
  assert.equal(canContinueBookingWizard({
    step: 2,
    hasSlot: true,
    hasTopic: true,
    paymentChoice: 'existing_package',
    hasMatchingPackage: false,
  }), false)
  assert.equal(canContinueBookingWizard({
    step: 2,
    hasSlot: true,
    hasTopic: true,
    paymentChoice: 'buy_package',
    canBuyPackages: true,
  }), true)
})

test('booking wizard preserves state when moving back and blocks skipped steps', () => {
  const state = { subject: 'Automatyka', slot: '15:00', topic: 'Sterowniki PLC' }
  const step2 = nextBookingWizardStep(1, true)
  const step1 = previousBookingWizardStep(step2)

  assert.equal(step2, 2)
  assert.equal(step1, 1)
  assert.deepEqual(state, { subject: 'Automatyka', slot: '15:00', topic: 'Sterowniki PLC' })
  assert.equal(nextBookingWizardStep(1, false), 1)
  assert.equal(nextBookingWizardStep(2, false), 2)
})

test('booking wizard allows final submit only on summary and prevents double submit', () => {
  const base = {
    userSignedIn: true,
    submitting: false,
    paymentChoice: 'single',
    packageMode: 'package_only',
    hasSlot: true,
    hasTopic: true,
  }
  assert.equal(canSubmitBookingWizard({ ...base, step: 1 }), false)
  assert.equal(canSubmitBookingWizard({ ...base, step: 2 }), false)
  assert.equal(canSubmitBookingWizard({ ...base, step: 3 }), true)
  assert.equal(canSubmitBookingWizard({ ...base, step: 3, submitting: true }), false)
})

test('booking wizard summary differentiates all payment modes', () => {
  assert.equal(bookingWizardSummaryKind({ paymentChoice: 'single', packageMode: 'package_only' }), 'single_lesson')
  assert.equal(bookingWizardSummaryKind({ paymentChoice: 'existing_package', packageMode: 'package_only' }), 'existing_package')
  assert.equal(bookingWizardSummaryKind({ paymentChoice: 'buy_package', packageMode: 'package_only' }), 'package_only')
  assert.equal(bookingWizardSummaryKind({ paymentChoice: 'buy_package', packageMode: 'package_and_book' }), 'package_and_book')
})

test('booking wizard package-only does not require a first lesson at submit time', () => {
  assert.equal(canSubmitBookingWizard({
    step: 3,
    userSignedIn: true,
    submitting: false,
    paymentChoice: 'buy_package',
    packageMode: 'package_only',
    hasSlot: false,
    hasTopic: false,
    canBuyPackages: true,
  }), true)
  assert.equal(canSubmitBookingWizard({
    step: 3,
    userSignedIn: true,
    submitting: false,
    paymentChoice: 'buy_package',
    packageMode: 'package_and_book',
    hasSlot: false,
    hasTopic: true,
    canBuyPackages: true,
  }), false)
})

import {
  applyBookingSelectionPatch,
  bookingStepFromSlug,
  resolveBookingStepGuard,
  sanitizeStoredBookingSelections,
} from '../lib/booking-wizard-core.ts'

const defaultsSel = {
  subjectId: 'math', lessonKind: 'regular', duration: 60, dayIso: null, slot: null, topic: '',
  paymentChoice: 'single', packageSize: 5, packageMode: 'package_only', recurringEnabled: false, recurringCount: 2,
}
const limits = { subjectIds: ['math', 'phys'], durations: [60, 90], packageSizes: [5, 10], trialEnabled: true }

test('booking steps map to three distinct URL slugs', () => {
  assert.equal(bookingStepFromSlug('termin'), 1)
  assert.equal(bookingStepFromSlug('platnosc'), 2)
  assert.equal(bookingStepFromSlug('podsumowanie'), 3)
  assert.equal(bookingStepFromSlug('x'), null)
})

test('direct entry to a later step is redirected to the first incomplete one', () => {
  assert.equal(resolveBookingStepGuard({ requested: 3, step1Valid: false, step2Valid: true }), 1)
  assert.equal(resolveBookingStepGuard({ requested: 2, step1Valid: false, step2Valid: true }), 1)
  assert.equal(resolveBookingStepGuard({ requested: 3, step1Valid: true, step2Valid: false }), 2)
  assert.equal(resolveBookingStepGuard({ requested: 3, step1Valid: true, step2Valid: true }), 3)
  assert.equal(resolveBookingStepGuard({ requested: 1, step1Valid: false, step2Valid: false }), 1)
})

test('changing subject, duration or lesson kind invalidates the chosen slot and incompatible payment', () => {
  const base = { ...defaultsSel, dayIso: '2026-10-12', slot: '10:00', packageMode: 'package_and_book', paymentChoice: 'buy_package' }
  assert.equal(applyBookingSelectionPatch(base, { duration: 90 }).slot, null)
  assert.equal(applyBookingSelectionPatch(base, { duration: 90 }).packageMode, 'package_only')
  assert.equal(applyBookingSelectionPatch(base, { subjectId: 'phys' }).slot, null)
  assert.equal(applyBookingSelectionPatch(base, { topic: 'x' }).slot, '10:00')
  const trial = applyBookingSelectionPatch(base, { lessonKind: 'trial' })
  assert.equal(trial.paymentChoice, 'single')
  assert.equal(trial.slot, null)
})

test('stored selections are sanitized and never trusted blindly', () => {
  const out = sanitizeStoredBookingSelections(
    { subjectId: 'hacker', duration: 7, dayIso: 'nope', slot: '99', paymentChoice: 'free', packageSize: 3, lessonKind: 'trial', topic: 'a'.repeat(900) },
    defaultsSel, { ...limits, trialEnabled: false },
  )
  assert.equal(out.subjectId, 'math')
  assert.equal(out.duration, 60)
  assert.equal(out.dayIso, null)
  assert.equal(out.slot, null)
  assert.equal(out.paymentChoice, 'single')
  assert.equal(out.packageSize, 5)
  assert.equal(out.lessonKind, 'regular')
  assert.equal(out.topic.length, 500)
  assert.deepEqual(sanitizeStoredBookingSelections(null, defaultsSel, limits), defaultsSel)
})

test('package_only does not need a slot but package_and_book falls back without one', () => {
  const s = applyBookingSelectionPatch(defaultsSel, { paymentChoice: 'buy_package', packageMode: 'package_and_book' })
  assert.equal(s.packageMode, 'package_only')
})

import { isBookingStepValid, bookingCtaLabel } from '../lib/booking-wizard-core.ts'

const okCtx = { termAvailable: true, canBuyPackages: true, hasMatchingPackage: true }

test('step validity: package_only needs no term, single/existing/trial do', () => {
  const none = { ...defaultsSel }
  assert.equal(isBookingStepValid(1, none, okCtx), true)
  assert.equal(isBookingStepValid(2, none, okCtx), false) // single without term
  assert.equal(isBookingStepValid(2, { ...none, paymentChoice: 'buy_package' }, okCtx), true)
  assert.equal(isBookingStepValid(2, { ...none, paymentChoice: 'buy_package', packageMode: 'package_and_book' }, okCtx), false)
  assert.equal(isBookingStepValid(1, { ...none, lessonKind: 'trial' }, okCtx), false)
  const term = { ...none, dayIso: '2026-10-12', slot: '10:00', topic: 'PLC' }
  assert.equal(isBookingStepValid(2, term, okCtx), true)
  assert.equal(isBookingStepValid(2, { ...term, paymentChoice: 'existing_package' }, { ...okCtx, hasMatchingPackage: false }), false)
  assert.equal(isBookingStepValid(1, { ...term, topic: ' ' }, okCtx), false)
  assert.equal(isBookingStepValid(1, term, { ...okCtx, termAvailable: false }), false)
})

test('CTA labels match the four purchase kinds', () => {
  assert.equal(bookingCtaLabel('single_lesson'), 'Zapłać i zarezerwuj')
  assert.equal(bookingCtaLabel('existing_package'), 'Zarezerwuj z pakietu')
  assert.equal(bookingCtaLabel('package_and_book'), 'Kup pakiet i zarezerwuj')
  assert.equal(bookingCtaLabel('package_only'), 'Kup pakiet')
})
