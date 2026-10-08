import type { LessonPackageFirstBookingStatus, LessonPackagePurchaseMode, LessonPackageSize } from '@/lib/types'

export function normalizeLessonPackagePurchaseMode(value: unknown): LessonPackagePurchaseMode {
  return value === 'package_and_book' ? 'package_and_book' : 'package_only'
}

export function creditsAfterPackagePurchase(input: {
  packageSize: LessonPackageSize
  purchaseMode: LessonPackagePurchaseMode
  firstBookingStatus?: LessonPackageFirstBookingStatus
}): { remainingCredits: number; reservedCredits: number } {
  if (input.purchaseMode === 'package_and_book' && input.firstBookingStatus === 'booked') {
    return { remainingCredits: input.packageSize - 1, reservedCredits: 1 }
  }
  return { remainingCredits: input.packageSize, reservedCredits: 0 }
}
