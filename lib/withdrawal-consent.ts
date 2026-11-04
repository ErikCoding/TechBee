// ─────────────────────────────────────────────────────────────
// Zgoda konsumenta na rozpoczęcie świadczenia usługi przed upływem
// 14 dni na odstąpienie od umowy (ustawa o prawach konsumenta,
// art. 38 pkt 1) oraz potwierdzenie, że wie o utracie tego prawa po
// pełnym wykonaniu usługi. SZKIC — do weryfikacji przez prawnika.
//
// Wersję zmieniaj przy każdej zmianie treści: razem z datą zapisuje
// się ją przy lekcji / pakiecie jako dowód, na co zgodził się klient.
// ─────────────────────────────────────────────────────────────

export const WITHDRAWAL_CONSENT_VERSION = 'v3-2026-11'

export const WITHDRAWAL_CONSENT_TITLE = 'Zgoda na start lekcji'

/** Treść zgody: wyraźne żądanie rozpoczęcia usługi + informacja o utracie prawa odstąpienia po pełnym wykonaniu (art. 38 pkt 1 u.p.k.). */
export const WITHDRAWAL_CONSENT_LABEL =
  'Lekcja ma się odbyć w wybranym terminie, także przed upływem 14 dni na odstąpienie od umowy. Wiem, że po jej przeprowadzeniu prawo odstąpienia wygasa.'

/** Walidacja po stronie serwera: zgoda musi być jawnie `true` w treści żądania. */
export function hasWithdrawalConsent(value: unknown): boolean {
  return value === true
}
