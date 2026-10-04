import type { Lesson, LessonPackage, PlatformWalletEntry } from '@/lib/types'

export function classifyLessonFinanceEntry(lesson: Pick<Lesson, 'lessonKind' | 'paymentSource'>): PlatformWalletEntry['transactionType'] {
  if (lesson.paymentSource === 'package') return 'package_lesson'
  if (lesson.lessonKind === 'trial') return 'trial_lesson'
  return 'single_lesson'
}

export function classifyPackageFinanceEntry(pkg: Pick<LessonPackage, 'packageSize'>): PlatformWalletEntry['transactionType'] {
  return pkg.packageSize === 5 || pkg.packageSize === 10 ? 'package_purchase' : 'package_purchase'
}
