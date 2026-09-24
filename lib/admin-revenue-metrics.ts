const MONTH_LABELS_PL = ['Sty', 'Lut', 'Mar', 'Kwi', 'Maj', 'Cze', 'Lip', 'Sie', 'Wrz', 'Paź', 'Lis', 'Gru']

export type AdminRevenueLessonRow = {
  status?: 'pending' | 'upcoming' | 'completed' | 'cancelled'
  paymentStatus?: 'paid' | 'refunded' | 'failed' | 'pending' | 'unpaid'
  price?: number
  priceGrosze?: number
  platformFeeGrosze?: number
  teacherAmountGrosze?: number
  stripeFeeGrosze?: number
  livemode?: boolean
  createdAt?: number
  completedAt?: number
  scheduledStartAt?: number
  duration?: number
}

function isSameMonth(ts: number, ref: Date): boolean {
  const d = new Date(ts)
  return d.getFullYear() === ref.getFullYear() && d.getMonth() === ref.getMonth()
}

function lessonGrossPln(lesson: AdminRevenueLessonRow): number {
  return typeof lesson.priceGrosze === 'number' ? lesson.priceGrosze / 100 : (lesson.price ?? 0)
}

function isLivePaidLesson(lesson: AdminRevenueLessonRow): boolean {
  return lesson.paymentStatus === 'paid' && lesson.livemode === true
}

/** Admin financial KPIs count only unambiguously production Stripe payments. */
export function computeAdminPlatformRevenue(lessons: AdminRevenueLessonRow[], now = new Date()) {
  const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1)
  const livePaidLessons = lessons.filter(isLivePaidLesson)
  const currentMonthPaid = livePaidLessons.filter((l) => l.createdAt && isSameMonth(l.createdAt, now))
  const currentMonthFeesComplete = currentMonthPaid.every((l) => Number.isFinite(l.stripeFeeGrosze))

  const monthlyRevenue = currentMonthPaid.reduce((sum, l) => sum + lessonGrossPln(l), 0)
  const monthlyNetRevenue = currentMonthFeesComplete
    ? currentMonthPaid.reduce((sum, l) => sum + ((l.platformFeeGrosze ?? 0) - (l.stripeFeeGrosze ?? 0)) / 100, 0)
    : null

  const lastMonthRevenue = livePaidLessons
    .filter((l) => l.createdAt && isSameMonth(l.createdAt, lastMonth))
    .reduce((sum, l) => sum + lessonGrossPln(l), 0)

  const revenueChange = lastMonthRevenue > 0
    ? Math.round(((monthlyRevenue - lastMonthRevenue) / lastMonthRevenue) * 1000) / 10
    : (monthlyRevenue > 0 ? 100 : 0)

  const revenueChart = Array.from({ length: 6 }, (_, i) => {
    const monthDate = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1)
    const scoped = livePaidLessons.filter((l) => l.createdAt && isSameMonth(l.createdAt, monthDate))
    const amount = scoped.reduce((sum, l) => sum + lessonGrossPln(l), 0)
    const platformFee = scoped.reduce((sum, l) => sum + ((l.platformFeeGrosze ?? 0) / 100), 0)
    const teacherAmount = scoped.reduce((sum, l) => sum + ((l.teacherAmountGrosze ?? 0) / 100), 0)
    const netPlatformRevenueComplete = scoped.every((l) => Number.isFinite(l.stripeFeeGrosze))
    const netPlatformRevenue = netPlatformRevenueComplete
      ? scoped.reduce((sum, l) => sum + ((l.platformFeeGrosze ?? 0) - (l.stripeFeeGrosze ?? 0)) / 100, 0)
      : null
    return { month: MONTH_LABELS_PL[monthDate.getMonth()], amount, platformFee, teacherAmount, netPlatformRevenue, netPlatformRevenueComplete }
  })

  const nowMs = now.getTime()
  const activeLessonsToday = lessons.filter((l) => (
    l.status === 'upcoming' &&
    Boolean(l.scheduledStartAt) &&
    nowMs >= l.scheduledStartAt! &&
    nowMs <= l.scheduledStartAt! + ((l.duration ?? 60) + 15) * 60 * 1000
  )).length

  return { monthlyRevenue, monthlyNetRevenue, monthlyNetRevenueComplete: currentMonthFeesComplete, revenueChange, revenueChart, activeLessonsToday }
}
