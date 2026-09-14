import { deprecatedCategoryIds } from '@/data/categories.data'
import type { Teacher } from '@/lib/types'

const deprecatedCategoryIdSet = new Set(deprecatedCategoryIds)

export function normalizeTeacherCategoryIds(categoryId?: string, categoryIds?: string[]): string[] {
  const result: string[] = []
  for (const id of [...(categoryIds ?? []), categoryId]) {
    if (id && !deprecatedCategoryIdSet.has(id) && !result.includes(id)) result.push(id)
  }
  return result
}

export function getTeacherCategoryIds(teacher: Pick<Teacher, 'categoryId' | 'categoryIds'>): string[] {
  return normalizeTeacherCategoryIds(teacher.categoryId, teacher.categoryIds)
}

export function teacherMatchesCategory(teacher: Pick<Teacher, 'categoryId' | 'categoryIds'>, categoryId: string): boolean {
  return getTeacherCategoryIds(teacher).includes(categoryId)
}

export function normalizeTeacherCustomSubjects(subjects?: string[]): string[] {
  const result: string[] = []
  for (const subject of subjects ?? []) {
    const normalized = subject.trim().replace(/\s+/g, ' ')
    if (normalized && !result.some((item) => item.toLowerCase() === normalized.toLowerCase())) result.push(normalized)
  }
  return result
}

export function getTeacherCustomSubjects(teacher: Pick<Teacher, 'customSubjects'>): string[] {
  return normalizeTeacherCustomSubjects(teacher.customSubjects)
}
