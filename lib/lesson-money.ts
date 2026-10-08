import type { Lesson } from '@/lib/types'

export function lessonStudentTotalGrosze(lesson: Lesson): number | null {
  if (typeof lesson.studentTotalGrosze === 'number' && Number.isFinite(lesson.studentTotalGrosze)) {
    return lesson.studentTotalGrosze
  }
  if (typeof lesson.priceGrosze === 'number' && Number.isFinite(lesson.priceGrosze)) {
    return lesson.priceGrosze + (lesson.studentServiceFeeGrosze ?? 0)
  }
  if (typeof lesson.price === 'number' && Number.isFinite(lesson.price)) {
    return Math.round(lesson.price * 100)
  }
  return null
}

export function formatLessonStudentTotal(lesson: Lesson): string {
  const total = lessonStudentTotalGrosze(lesson)
  if (total === null) return '—'
  return `${(total / 100).toLocaleString('pl-PL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} zł`
}
