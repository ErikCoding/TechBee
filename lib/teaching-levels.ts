export const teachingLevels = [
  { id: 'primary-school', label: 'Szkoła podstawowa' },
  { id: 'high-school', label: 'Liceum' },
  { id: 'technical-school', label: 'Technikum' },
  { id: 'matura', label: 'Matura' },
  { id: 'university', label: 'Studia' },
  { id: 'adults', label: 'Dorośli' },
] as const

export type TeachingLevelId = (typeof teachingLevels)[number]['id']

const teachingLevelIds = new Set<string>(teachingLevels.map((level) => level.id))
const teachingLevelLabels = new Map<string, string>(teachingLevels.map((level) => [level.id, level.label]))

export function normalizeTeachingLevels(levels?: string[]): TeachingLevelId[] {
  const result: TeachingLevelId[] = []
  for (const level of levels ?? []) {
    if (teachingLevelIds.has(level) && !result.includes(level as TeachingLevelId)) {
      result.push(level as TeachingLevelId)
    }
  }
  return result
}

export function teachingLevelLabel(id: string): string {
  return teachingLevelLabels.get(id) ?? id
}

export function formatTeachingLevels(levels?: string[]): string {
  const normalized = normalizeTeachingLevels(levels)
  return normalized.length ? normalized.map(teachingLevelLabel).join(', ') : 'Nie podano'
}

export function normalizeTeachingLevelFilter(level?: string | null): TeachingLevelId | null {
  return normalizeTeachingLevels(level ? [level] : [])[0] ?? null
}

export function teacherMatchesTeachingLevelFilter(
  teacher: { teachingLevels?: string[] },
  level?: string | null,
): boolean {
  const normalizedLevel = normalizeTeachingLevelFilter(level)
  if (!normalizedLevel) return true
  return normalizeTeachingLevels(teacher.teachingLevels).includes(normalizedLevel)
}
