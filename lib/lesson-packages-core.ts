import type { CommissionSource, LessonPackageStatus } from './types'

export type LessonPackageSize = 5 | 10
export type PackagePaymentSource = 'stripe_checkout' | 'package'
export type PackageCreditState = 'reserved' | 'used' | 'returned'

export type LessonPackageCore = {
  teacherId: string
  studentId: string
  packageSize: LessonPackageSize
  remainingCredits: number
  reservedCredits: number
  usedCredits: number
  subjectKey: string
  duration: number
  status: LessonPackageStatus
}

export type LessonPackageTerms = {
  packageSize: LessonPackageSize
  totalPriceGrosze: number
  perLessonGrossGrosze: number
  platformFeePerLessonGrosze: number
  teacherAmountPerLessonGrosze: number
  effectiveCommissionPercent: number
  commissionSource: CommissionSource
}

export function normalizeLessonPackageSize(value: unknown): LessonPackageSize | null {
  return value === 5 || value === 10 ? value : null
}

export function normalizeOfferedLessonPackageSizes(value?: unknown[] | null): LessonPackageSize[] {
  const result: LessonPackageSize[] = []
  for (const item of value ?? []) {
    const size = normalizeLessonPackageSize(item)
    if (size && !result.includes(size)) result.push(size)
  }
  return result
}

export function teacherOffersLessonPackageSize(
  teacher: { lessonPackageSizes?: unknown[] | null } | null | undefined,
  packageSize: LessonPackageSize,
): boolean {
  return normalizeOfferedLessonPackageSizes(teacher?.lessonPackageSizes).includes(packageSize)
}

export function normalizePackageCreditLessonKind(value: unknown): 'regular' | null {
  if (value === undefined || value === null || value === 'regular') return 'regular'
  return null
}

export function packageSubjectKey(input: { subjectCategoryId?: string | null; specialty?: string | null }): string | null {
  const subjectCategoryId = input.subjectCategoryId?.trim()
  if (subjectCategoryId) return `category:${subjectCategoryId}`
  const specialty = input.specialty?.trim().toLowerCase()
  if (specialty) return `custom:${specialty}`
  return null
}

export function existingLessonPackageIdForCheckout(docs: { id: string }[]): string | null {
  return docs[0]?.id ?? null
}

export function calculateLessonPackageTerms({
  packageSize,
  perLessonGrossGrosze,
  platformFeePerLessonGrosze,
  teacherAmountPerLessonGrosze,
  effectiveCommissionPercent,
  commissionSource,
}: {
  packageSize: LessonPackageSize
  perLessonGrossGrosze: number
  platformFeePerLessonGrosze: number
  teacherAmountPerLessonGrosze: number
  effectiveCommissionPercent: number
  commissionSource: CommissionSource
}): LessonPackageTerms {
  return {
    packageSize,
    totalPriceGrosze: perLessonGrossGrosze * packageSize,
    perLessonGrossGrosze,
    platformFeePerLessonGrosze,
    teacherAmountPerLessonGrosze,
    effectiveCommissionPercent,
    commissionSource,
  }
}

export function lessonPackageStatusForCredits(input: Pick<LessonPackageCore, 'remainingCredits' | 'reservedCredits' | 'status'>): LessonPackageStatus {
  if (input.status === 'cancelled' || input.status === 'refunded' || input.status === 'refund_review') return input.status
  return input.remainingCredits <= 0 && input.reservedCredits <= 0 ? 'exhausted' : 'active'
}

export type PackageBookingValidationError =
  | 'package_not_active'
  | 'ownership_mismatch'
  | 'teacher_mismatch'
  | 'subject_mismatch'
  | 'duration_mismatch'
  | 'no_credits'

export function validatePackageForBooking(
  pkg: LessonPackageCore,
  expected: { teacherId: string; studentId: string; subjectKey: string; duration: number },
): PackageBookingValidationError | null {
  if (pkg.status !== 'active') return 'package_not_active'
  if (pkg.studentId !== expected.studentId) return 'ownership_mismatch'
  if (pkg.teacherId !== expected.teacherId) return 'teacher_mismatch'
  if (pkg.subjectKey !== expected.subjectKey) return 'subject_mismatch'
  if (pkg.duration !== expected.duration) return 'duration_mismatch'
  if (pkg.remainingCredits <= 0) return 'no_credits'
  return null
}

export function reservePackageCredit<T extends Pick<LessonPackageCore, 'remainingCredits' | 'reservedCredits' | 'usedCredits' | 'status'>>(pkg: T): T {
  if (pkg.status !== 'active' || pkg.remainingCredits <= 0) return pkg
  return {
    ...pkg,
    remainingCredits: pkg.remainingCredits - 1,
    reservedCredits: pkg.reservedCredits + 1,
    status: lessonPackageStatusForCredits({
      ...pkg,
      remainingCredits: pkg.remainingCredits - 1,
      reservedCredits: pkg.reservedCredits + 1,
    }),
  }
}

export function reservePackageCredits<T extends Pick<LessonPackageCore, 'remainingCredits' | 'reservedCredits' | 'usedCredits' | 'status'>>(
  pkg: T,
  count: number,
): T {
  if (pkg.status !== 'active' || !Number.isInteger(count) || count < 1 || pkg.remainingCredits < count) return pkg
  return {
    ...pkg,
    remainingCredits: pkg.remainingCredits - count,
    reservedCredits: pkg.reservedCredits + count,
    status: lessonPackageStatusForCredits({
      ...pkg,
      remainingCredits: pkg.remainingCredits - count,
      reservedCredits: pkg.reservedCredits + count,
    }),
  }
}

export function completeReservedPackageCredit<T extends Pick<LessonPackageCore, 'remainingCredits' | 'reservedCredits' | 'usedCredits' | 'status'>>(
  pkg: T,
  creditState?: PackageCreditState,
): T {
  if (creditState === 'used') return pkg
  if (creditState !== 'reserved' || pkg.reservedCredits <= 0) return pkg
  return {
    ...pkg,
    reservedCredits: pkg.reservedCredits - 1,
    usedCredits: pkg.usedCredits + 1,
    status: lessonPackageStatusForCredits({
      ...pkg,
      reservedCredits: pkg.reservedCredits - 1,
    }),
  }
}

export function returnReservedPackageCredit<T extends Pick<LessonPackageCore, 'remainingCredits' | 'reservedCredits' | 'usedCredits' | 'status'>>(
  pkg: T,
  creditState?: PackageCreditState,
): T {
  if (creditState === 'returned') return pkg
  if (creditState !== 'reserved' || pkg.reservedCredits <= 0) return pkg
  return {
    ...pkg,
    remainingCredits: pkg.remainingCredits + 1,
    reservedCredits: pkg.reservedCredits - 1,
    status: lessonPackageStatusForCredits({
      ...pkg,
      remainingCredits: pkg.remainingCredits + 1,
      reservedCredits: pkg.reservedCredits - 1,
    }),
  }
}
