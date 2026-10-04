import type { Category } from '@/lib/types'

export function normalizeTeacherApplicationCategoryIds(
  cats: Pick<Category, 'id'>[],
  primaryId: string,
  ids?: string[],
): string[] {
  const availableIds = new Set(cats.map((cat) => cat.id))
  return [...new Set([...(ids ?? []), primaryId].filter((id) => availableIds.has(id)))]
}
