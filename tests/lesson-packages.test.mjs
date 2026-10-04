import assert from 'node:assert/strict'
import test from 'node:test'
import {
  calculateLessonPackageTerms,
  completeReservedPackageCredit,
  existingLessonPackageIdForCheckout,
  normalizeLessonPackageSize,
  normalizeOfferedLessonPackageSizes,
  normalizePackageCreditLessonKind,
  packageSubjectKey,
  reservePackageCredit,
  reservePackageCredits,
  returnReservedPackageCredit,
  teacherOffersLessonPackageSize,
  validatePackageForBooking,
} from '../lib/lesson-packages-core.ts'

function pkg(patch = {}) {
  return {
    teacherId: 'teacher-1',
    studentId: 'student-1',
    packageSize: 5,
    remainingCredits: 5,
    reservedCredits: 0,
    usedCredits: 0,
    subjectKey: 'category:mathematics',
    duration: 60,
    status: 'active',
    ...patch,
  }
}

test('package size accepts only 5 or 10 lessons', () => {
  assert.equal(normalizeLessonPackageSize(5), 5)
  assert.equal(normalizeLessonPackageSize(10), 10)
  assert.equal(normalizeLessonPackageSize(4), null)
})

test('offered package sizes normalize configured teacher packages', () => {
  assert.deepEqual(normalizeOfferedLessonPackageSizes([10, 5, 5, 7, '10']), [10, 5])
})

test('missing teacher package config rejects package purchases', () => {
  assert.equal(teacherOffersLessonPackageSize({}, 5), false)
  assert.equal(teacherOffersLessonPackageSize({ lessonPackageSizes: undefined }, 10), false)
})

test('teacher offering only package 5 allows 5 and rejects 10', () => {
  const teacher = { lessonPackageSizes: [5] }
  assert.equal(teacherOffersLessonPackageSize(teacher, 5), true)
  assert.equal(teacherOffersLessonPackageSize(teacher, 10), false)
})

test('teacher offering only package 10 allows 10 and rejects 5', () => {
  const teacher = { lessonPackageSizes: [10] }
  assert.equal(teacherOffersLessonPackageSize(teacher, 10), true)
  assert.equal(teacherOffersLessonPackageSize(teacher, 5), false)
})

test('teacher offering packages 5 and 10 allows both package purchases', () => {
  const teacher = { lessonPackageSizes: [5, 10] }
  assert.equal(teacherOffersLessonPackageSize(teacher, 5), true)
  assert.equal(teacherOffersLessonPackageSize(teacher, 10), true)
})

test('legacy teacher docs without lessonPackageSizes do not offer packages', () => {
  assert.equal(teacherOffersLessonPackageSize(null, 5), false)
  assert.equal(teacherOffersLessonPackageSize({ hourlyRate: 120 }, 10), false)
})

test('package credit booking rejects trial lessonKind', () => {
  assert.equal(normalizePackageCreditLessonKind(undefined), 'regular')
  assert.equal(normalizePackageCreditLessonKind('regular'), 'regular')
  assert.equal(normalizePackageCreditLessonKind('trial'), null)
})

test('duplicate package webhook reuses existing package instead of creating another', () => {
  assert.equal(existingLessonPackageIdForCheckout([{ id: 'pkg_existing' }]), 'pkg_existing')
  assert.equal(existingLessonPackageIdForCheckout([]), null)
})

test('package price for 5 lessons uses per-lesson gross price without discount', () => {
  assert.equal(calculateLessonPackageTerms({
    packageSize: 5,
    perLessonGrossGrosze: 12000,
    platformFeePerLessonGrosze: 960,
    teacherAmountPerLessonGrosze: 11040,
    effectiveCommissionPercent: 8,
    commissionSource: 'standard',
  }).totalPriceGrosze, 60000)
})

test('package price for 10 lessons uses per-lesson gross price without discount', () => {
  assert.equal(calculateLessonPackageTerms({
    packageSize: 10,
    perLessonGrossGrosze: 12000,
    platformFeePerLessonGrosze: 960,
    teacherAmountPerLessonGrosze: 11040,
    effectiveCommissionPercent: 8,
    commissionSource: 'standard',
  }).totalPriceGrosze, 120000)
})

test('package stores historical commission snapshot per lesson', () => {
  assert.deepEqual(calculateLessonPackageTerms({
    packageSize: 5,
    perLessonGrossGrosze: 10000,
    platformFeePerLessonGrosze: 500,
    teacherAmountPerLessonGrosze: 9500,
    effectiveCommissionPercent: 5,
    commissionSource: 'founding_teacher',
  }), {
    packageSize: 5,
    totalPriceGrosze: 50000,
    perLessonGrossGrosze: 10000,
    platformFeePerLessonGrosze: 500,
    teacherAmountPerLessonGrosze: 9500,
    effectiveCommissionPercent: 5,
    commissionSource: 'founding_teacher',
  })
})

test('package ownership and matching fields are validated server-side', () => {
  const expected = { teacherId: 'teacher-1', studentId: 'student-1', subjectKey: 'category:mathematics', duration: 60 }

  assert.equal(validatePackageForBooking(pkg(), expected), null)
  assert.equal(validatePackageForBooking(pkg({ studentId: 'student-2' }), expected), 'ownership_mismatch')
  assert.equal(validatePackageForBooking(pkg({ teacherId: 'teacher-2' }), expected), 'teacher_mismatch')
  assert.equal(validatePackageForBooking(pkg({ subjectKey: 'category:english' }), expected), 'subject_mismatch')
  assert.equal(validatePackageForBooking(pkg({ duration: 30 }), expected), 'duration_mismatch')
  assert.equal(validatePackageForBooking(pkg({ remainingCredits: 0 }), expected), 'no_credits')
})

test('package credit reservation decrements remaining and increments reserved once per booking', () => {
  const first = reservePackageCredit(pkg({ remainingCredits: 1 }))
  assert.equal(first.remainingCredits, 0)
  assert.equal(first.reservedCredits, 1)
  assert.equal(first.status, 'active')

  const second = reservePackageCredit(first)
  assert.equal(second.remainingCredits, 0)
  assert.equal(second.reservedCredits, 1)
})

test('recurring package reservation decrements remaining and increments reserved by count', () => {
  const reserved = reservePackageCredits(pkg({ remainingCredits: 5 }), 3)
  assert.equal(reserved.remainingCredits, 2)
  assert.equal(reserved.reservedCredits, 3)
  assert.equal(reserved.status, 'active')
})

test('recurring package reservation rejects insufficient credits without mutation', () => {
  const original = pkg({ remainingCredits: 2, reservedCredits: 1 })
  const reserved = reservePackageCredits(original, 3)
  assert.deepEqual(reserved, original)
})

test('package lesson financial snapshot is release-compatible per one lesson', () => {
  const terms = calculateLessonPackageTerms({
    packageSize: 10,
    perLessonGrossGrosze: 10000,
    platformFeePerLessonGrosze: 800,
    teacherAmountPerLessonGrosze: 9200,
    effectiveCommissionPercent: 8,
    commissionSource: 'standard',
  })
  const lesson = {
    paymentSource: 'package',
    paymentStatus: 'paid',
    priceGrosze: terms.perLessonGrossGrosze,
    platformFeeGrosze: terms.platformFeePerLessonGrosze,
    teacherAmountGrosze: terms.teacherAmountPerLessonGrosze,
    effectiveCommissionPercent: terms.effectiveCommissionPercent,
    commissionSource: terms.commissionSource,
  }
  assert.equal(lesson.teacherAmountGrosze, 9200)
  assert.equal(lesson.paymentStatus, 'paid')
})

test('trial lessons cannot consume package credits', () => {
  assert.notEqual('trial', 'regular')
  const lesson = { lessonKind: 'trial', paymentSource: 'stripe_checkout' }
  assert.notEqual(lesson.paymentSource, 'package')
})

test('subject key is stable for category and custom subjects', () => {
  assert.equal(packageSubjectKey({ subjectCategoryId: 'mathematics', specialty: 'Matematyka' }), 'category:mathematics')
  assert.equal(packageSubjectKey({ specialty: '  English speaking  ' }), 'custom:english speaking')
})

test('duplicate cancel returns exactly one credit', () => {
  const reserved = reservePackageCredit(pkg({ remainingCredits: 2 }))
  const returned = returnReservedPackageCredit(reserved, 'reserved')
  assert.equal(returned.remainingCredits, 2)
  assert.equal(returned.reservedCredits, 0)

  const duplicate = returnReservedPackageCredit(returned, 'returned')
  assert.equal(duplicate.remainingCredits, 2)
  assert.equal(duplicate.reservedCredits, 0)
})

test('completion moves reserved to used exactly once', () => {
  const reserved = reservePackageCredit(pkg({ remainingCredits: 2 }))
  const completed = completeReservedPackageCredit(reserved, 'reserved')
  assert.equal(completed.reservedCredits, 0)
  assert.equal(completed.usedCredits, 1)

  const duplicate = completeReservedPackageCredit(completed, 'used')
  assert.equal(duplicate.reservedCredits, 0)
  assert.equal(duplicate.usedCredits, 1)
})

test('completion of one recurring package lesson changes only one reserved credit', () => {
  const reserved = reservePackageCredits(pkg({ remainingCredits: 5 }), 3)
  const completed = completeReservedPackageCredit(reserved, 'reserved')
  assert.equal(completed.remainingCredits, 2)
  assert.equal(completed.reservedCredits, 2)
  assert.equal(completed.usedCredits, 1)
})

test('cancellation of one recurring package lesson returns only one reserved credit', () => {
  const reserved = reservePackageCredits(pkg({ remainingCredits: 5 }), 3)
  const returned = returnReservedPackageCredit(reserved, 'reserved')
  assert.equal(returned.remainingCredits, 3)
  assert.equal(returned.reservedCredits, 2)
  assert.equal(returned.usedCredits, 0)
})
