// Zgoda na statystyki (Vercel Analytics). Niezbędne mechanizmy (logowanie, sesja
// rezerwacji, płatności) działają bez zgody. Wybór zapisujemy w localStorage,
// a użytkownik może go zmienić przyciskiem „Ustawienia cookies” w stopce.
// SZKIC do weryfikacji przez prawnika (pytanie: czy statystyki bez cookies wymagają zgody).

export const COOKIE_CONSENT_KEY = 'runbee:cookie-consent'
export const COOKIE_CONSENT_VERSION = 'v1'
export const COOKIE_CONSENT_EVENT = 'runbee:cookie-consent-change'
export const COOKIE_SETTINGS_EVENT = 'runbee:cookie-settings-open'

export type CookieChoice = 'accepted' | 'necessary' | null

export function parseCookieChoice(raw: string | null): CookieChoice {
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw) as { choice?: unknown; version?: unknown }
    if (parsed.version !== COOKIE_CONSENT_VERSION) return null
    return parsed.choice === 'accepted' || parsed.choice === 'necessary' ? parsed.choice : null
  } catch {
    return null
  }
}

export function readCookieChoice(): CookieChoice {
  try {
    return parseCookieChoice(window.localStorage.getItem(COOKIE_CONSENT_KEY))
  } catch {
    return null
  }
}

export function writeCookieChoice(choice: Exclude<CookieChoice, null>): void {
  try {
    window.localStorage.setItem(COOKIE_CONSENT_KEY, JSON.stringify({ choice, version: COOKIE_CONSENT_VERSION, at: Date.now() }))
  } catch {
    // brak dostępu do pamięci przeglądarki: wybór obowiązuje do końca wizyty
  }
  window.dispatchEvent(new Event(COOKIE_CONSENT_EVENT))
}
