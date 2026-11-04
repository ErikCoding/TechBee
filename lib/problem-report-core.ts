// Zgłoszenia problemów (profil, lekcja, treść, bezpieczeństwo dziecka).
// Trafiają do tej samej skrzynki co formularz kontaktowy (Admin → Wiadomości),
// z kategorią i wskazaniem, czego dotyczą.

export const PROBLEM_CATEGORIES = [
  { id: 'child_safety', label: 'Bezpieczeństwo dziecka (pilne)', priority: true },
  { id: 'illegal_content', label: 'Nielegalna lub nieodpowiednia treść' },
  { id: 'conduct', label: 'Niewłaściwe zachowanie nauczyciela lub ucznia' },
  { id: 'lesson_or_payment', label: 'Problem z lekcją lub płatnością' },
  { id: 'other', label: 'Inne' },
] as const

export type ProblemCategoryId = (typeof PROBLEM_CATEGORIES)[number]['id']

export function isProblemCategory(value: unknown): value is ProblemCategoryId {
  return PROBLEM_CATEGORIES.some((c) => c.id === value)
}

export function problemCategoryLabel(id: string): string {
  return PROBLEM_CATEGORIES.find((c) => c.id === id)?.label ?? id
}

/** Link do formularza z wypełnionym celem zgłoszenia (np. kind=profile, id=teacherId). */
export function reportProblemHref(target: { kind: 'profile' | 'lesson'; id: string; name?: string }): string {
  const params = new URLSearchParams({ typ: target.kind, id: target.id })
  if (target.name) params.set('nazwa', target.name.slice(0, 80))
  return `/zglos-problem?${params.toString()}`
}
