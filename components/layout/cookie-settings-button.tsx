'use client'

import { COOKIE_SETTINGS_EVENT } from '@/lib/cookie-consent'

export function CookieSettingsButton({ className }: { className?: string }) {
  return (
    <button type="button" className={className} onClick={() => window.dispatchEvent(new Event(COOKIE_SETTINGS_EVENT))}>
      Ustawienia cookies
    </button>
  )
}
