import { getTeacherCategoryIds } from '@/lib/teacher-categories'
import type { Teacher } from '@/lib/types'

export function teacherIsPublicMarketplaceVisible(teacher: Pick<Teacher, 'status' | 'categoryId' | 'categoryIds'>): boolean {
  return (teacher.status ?? 'approved') === 'approved' && getTeacherCategoryIds(teacher).length > 0
}
