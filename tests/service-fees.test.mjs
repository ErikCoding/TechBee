import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { calculateLessonPackageTerms } from '../lib/lesson-packages-core.ts'
import { buildStudentPaymentBreakdown, calculateStudentServiceFeeGrosze } from '../lib/service-fees.ts'
import { splitPayment } from '../lib/stripe-config.ts'
import { resolveCheckoutLessonTermsWithOptions } from '../lib/trial-lessons-core.ts'

const lessonCheckoutSource = readFileSync(new URL('../app/api/stripe/checkout/create-session/route.ts', import.meta.url), 'utf8')
const packageCheckoutSource = readFileSync(new URL('../app/api/stripe/packages/create-session/route.ts', import.meta.url), 'utf8')
const packageCreditBookingSource = readFileSync(new URL('../lib/lesson-package-booking.server.ts', import.meta.url), 'utf8')

test('student service fee uses 2.99 PLN minimum for low subtotals', () => {
  assert.equal(calculateStudentServiceFeeGrosze(5000), 299)
})

test('student service fee uses rounded 3 percent above the minimum', () => {
  assert.equal(calculateStudentServiceFeeGrosze(12345), 370)
})

test('student service fee is zero for zero or invalid subtotal', () => {
  assert.equal(calculateStudentServiceFeeGrosze(0), 0)
  assert.equal(calculateStudentServiceFeeGrosze(-1000), 0)
  assert.equal(calculateStudentServiceFeeGrosze(Number.NaN), 0)
})

test('student payment breakdown keeps teacher subtotal separate from student total', () => {
  assert.deepEqual(buildStudentPaymentBreakdown(10000), {
    subtotalGrosze: 10000,
    studentServiceFeeGrosze: 300,
    studentTotalGrosze: 10300,
  })
})

test('regular and trial checkout amounts use the same service fee contract', () => {
  const regularTerms = resolveCheckoutLessonTermsWithOptions({
    lessonKind: 'regular',
    requestedDuration: 90,
    regularPriceGrosze: 12000,
    teacher: { trialLessonEnabled: true, trialLessonDuration: 30, trialLessonPriceGrosze: 4900 },
    allowedDurations: [30, 60, 90],
  })
  const trialTerms = resolveCheckoutLessonTermsWithOptions({
    lessonKind: 'trial',
    requestedDuration: 30,
    regularPriceGrosze: 12000,
    teacher: { trialLessonEnabled: true, trialLessonDuration: 30, trialLessonPriceGrosze: 4900 },
    allowedDurations: [30, 60, 90],
  })

  assert.deepEqual(regularTerms, { ok: true, lessonKind: 'regular', duration: 90, priceGrosze: 12000 })
  assert.deepEqual(buildStudentPaymentBreakdown(regularTerms.priceGrosze), {
    subtotalGrosze: 12000,
    studentServiceFeeGrosze: 360,
    studentTotalGrosze: 12360,
  })
  assert.deepEqual(trialTerms, { ok: true, lessonKind: 'trial', duration: 30, priceGrosze: 4900 })
  assert.deepEqual(buildStudentPaymentBreakdown(trialTerms.priceGrosze), {
    subtotalGrosze: 4900,
    studentServiceFeeGrosze: 299,
    studentTotalGrosze: 5199,
  })
})

test('package purchase fee is calculated once on package subtotal and teacher amount ignores student service fee', () => {
  const split = splitPayment(8000, 8)
  const terms = calculateLessonPackageTerms({
    packageSize: 5,
    perLessonGrossGrosze: 8000,
    platformFeePerLessonGrosze: split.platformFeeGrosze,
    teacherAmountPerLessonGrosze: split.teacherAmountGrosze,
    effectiveCommissionPercent: 8,
    commissionSource: 'standard',
  })
  const payment = buildStudentPaymentBreakdown(terms.totalPriceGrosze)

  assert.deepEqual(terms, {
    packageSize: 5,
    totalPriceGrosze: 40000,
    perLessonGrossGrosze: 8000,
    platformFeePerLessonGrosze: 640,
    teacherAmountPerLessonGrosze: 7360,
    effectiveCommissionPercent: 8,
    commissionSource: 'standard',
  })
  assert.deepEqual(payment, {
    subtotalGrosze: 40000,
    studentServiceFeeGrosze: 1200,
    studentTotalGrosze: 41200,
  })
  assert.equal(terms.teacherAmountPerLessonGrosze, terms.perLessonGrossGrosze - terms.platformFeePerLessonGrosze)
  assert.notEqual(terms.teacherAmountPerLessonGrosze, payment.studentTotalGrosze - terms.platformFeePerLessonGrosze)
})

test('Stripe checkout creates separate lesson and Runbee service fee line items', () => {
  assert.equal(lessonCheckoutSource.includes("name: 'Opłata serwisowa Runbee'"), true)
  assert.equal(lessonCheckoutSource.includes('paymentBreakdown.subtotalGrosze'), true)
  assert.equal(lessonCheckoutSource.includes('paymentBreakdown.studentServiceFeeGrosze'), true)
  assert.equal(lessonCheckoutSource.includes('studentTotalGrosze: String(paymentBreakdown.studentTotalGrosze)'), true)
})

test('Stripe checkout creates separate package and Runbee service fee line items', () => {
  assert.equal(packageCheckoutSource.includes("name: 'Opłata serwisowa Runbee'"), true)
  assert.equal(packageCheckoutSource.includes('paymentBreakdown.subtotalGrosze'), true)
  assert.equal(packageCheckoutSource.includes('paymentBreakdown.studentServiceFeeGrosze'), true)
  assert.equal(packageCheckoutSource.includes('studentTotalGrosze: paymentBreakdown.studentTotalGrosze'), true)
})

test('booking with existing package credit does not add a new student service fee', () => {
  assert.equal(packageCreditBookingSource.includes('studentServiceFeeGrosze: 0'), true)
  assert.equal(packageCreditBookingSource.includes('startLessonCheckout'), false)
  assert.equal(packageCreditBookingSource.includes('startLessonPackageCheckout'), false)
})
