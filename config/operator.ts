// ─────────────────────────────────────────────────────────────
// Dane operatora serwisu — JEDNO miejsce. Stopka, Regulamin, Polityka
// prywatności i e-maile czytają stąd. Przy przejściu na sp. z o.o.
// zmień tylko ten plik (oraz `legalForm`) i zaktualizuj dokumenty.
//
// Działalność nierejestrowana: nie podajemy NIP/REGON/KRS i nie
// używamy określeń „firma” ani „sp. z o.o.”.
// ─────────────────────────────────────────────────────────────

export const operatorConfig = {
  /** 'unregistered' = działalność nierejestrowana (osoba fizyczna). Po zmianie formy ustaw 'company' i uzupełnij pola firmowe. */
  legalForm: 'unregistered' as 'unregistered' | 'company',
  /** Imię i nazwisko osoby prowadzącej serwis (albo nazwa spółki po przejściu na 'company'). */
  name: 'Bartosz Prokop',
  /** Adres do korespondencji. UZUPEŁNIJ przed publikacją. */
  correspondenceAddress: 'ul. Szczecińska 18/25, 84-230 Rumia',
  email: 'kontakt@runbee.pl',
  /** Pola używane dopiero po rejestracji firmy; dla działalności nierejestrowanej muszą zostać puste. */
  nip: '',
  regon: '',
  krs: '',
  /** Osoba odpowiedzialna za standardy ochrony małoletnich i punkt kontaktowy DSA (na razie ten sam e-mail). */
  safeguardingContactEmail: 'kontakt@runbee.pl',
  dsaContactEmail: 'kontakt@runbee.pl',
  /** Limit przychodu działalności nierejestrowanej na kwartał (2026), w zł. */
  quarterlyRevenueLimitPln: 10813.5,
} as const

export type OperatorConfig = typeof operatorConfig

/** Czy adres został uzupełniony — dokumenty prawne pokazują ostrzeżenie, dopóki tego nie zrobisz. */
export function operatorAddressIsPlaceholder(): boolean {
  return operatorConfig.correspondenceAddress.startsWith('[')
}

/** Jedna linia do stopki i dokumentów. */
export function operatorIdentityLine(): string {
  return `${operatorConfig.name}, ${operatorConfig.correspondenceAddress}, ${operatorConfig.email}`
}
