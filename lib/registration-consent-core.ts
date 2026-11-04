// ─────────────────────────────────────────────────────────────
// Rejestracja: akceptacja Regulaminu i oświadczenie o wieku.
// Najprostsze rozwiązanie na obecny etap (szkic do weryfikacji przez prawnika):
//  • nauczyciel i rodzic oświadczają, że mają co najmniej 18 lat,
//  • uczeń wybiera przedział wieku; poniżej 18 lat oświadcza, że rodzic
//    lub opiekun zna konto i zgadza się na korzystanie z Runbee
//    (poniżej 16 lat — jest to zgoda rodzica na założenie konta),
//  • zapis (wersja, data, przedział wieku) trafia do profilu użytkownika.
// Płatności za lekcje małoletniego wykonuje rodzic/opiekun (konto rodzica
// powiązane z uczniem) albo uczeń kartą rodzica za jego zgodą.
// ─────────────────────────────────────────────────────────────

export const REGISTRATION_CONSENT_VERSION = 'v1-2026-11'

export type AgeBand = 'adult' | 'teen_16_17' | 'child_under_16'

export const AGE_BAND_OPTIONS: { value: AgeBand; label: string }[] = [
  { value: 'adult', label: 'Mam co najmniej 18 lat' },
  { value: 'teen_16_17', label: 'Mam 16–17 lat i mam zgodę rodzica lub opiekuna' },
  { value: 'child_under_16', label: 'Mam mniej niż 16 lat i mam zgodę rodzica lub opiekuna na założenie konta' },
]

export type RegistrationConsent = {
  termsAcceptedAt: number
  termsVersion: string
  ageBand: AgeBand
}

export function isAgeBand(value: unknown): value is AgeBand {
  return value === 'adult' || value === 'teen_16_17' || value === 'child_under_16'
}

/** Zwraca komunikat błędu albo null, gdy zgody są poprawne. Konta nauczyciela i rodzica wymagają pełnoletności. */
export function validateRegistrationConsent(input: { role: string; acceptTerms?: boolean; ageBand?: unknown }): string | null {
  if (input.acceptTerms !== true) return 'Zaakceptuj Regulamin i Politykę prywatności, aby założyć konto.'
  if (!isAgeBand(input.ageBand)) return 'Potwierdź swój wiek.'
  if (input.role !== 'student' && input.ageBand !== 'adult') return 'Konto nauczyciela lub rodzica mogą założyć tylko osoby pełnoletnie.'
  return null
}

export function buildRegistrationConsent(ageBand: AgeBand, now = Date.now()): RegistrationConsent {
  return { termsAcceptedAt: now, termsVersion: REGISTRATION_CONSENT_VERSION, ageBand }
}
