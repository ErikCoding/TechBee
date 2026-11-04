'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { Analytics } from '@vercel/analytics/next'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import {
  COOKIE_CONSENT_EVENT, COOKIE_SETTINGS_EVENT, readCookieChoice, writeCookieChoice, type CookieChoice,
} from '@/lib/cookie-consent'

type View = 'hidden' | 'banner' | 'settings'

/**
 * Baner zgody na statystyki + okno ustawień + ładowanie Vercel Analytics dopiero po zgodzie.
 * Stan czytamy z localStorage dopiero po zamontowaniu (przed tym nic nie renderujemy), więc
 * użytkownik, który już wybrał, nigdy nie widzi błysku banera przy nawigacji ani odświeżeniu.
 * Rozmiary i pozycje są w `style`, bo klasy z wartościami w nawiasach bywają niewygenerowane w trybie dev.
 */
export function CookieConsent() {
  const [choice, setChoice] = useState<CookieChoice | 'unknown'>('unknown')
  const [view, setView] = useState<View>('hidden')
  const [statsOn, setStatsOn] = useState(false)

  // Pierwsze wczytanie wyboru + reakcja na zmiany z innych kart.
  useEffect(() => {
    const sync = () => {
      const stored = readCookieChoice()
      setChoice(stored)
      setView((current) => (stored === null ? 'banner' : current === 'banner' ? 'hidden' : current))
    }
    sync()
    window.addEventListener(COOKIE_CONSENT_EVENT, sync)
    window.addEventListener('storage', sync)
    return () => {
      window.removeEventListener(COOKIE_CONSENT_EVENT, sync)
      window.removeEventListener('storage', sync)
    }
  }, [])

  // „Ustawienia cookies” ze stopki.
  useEffect(() => {
    const open = () => {
      setStatsOn(readCookieChoice() === 'accepted')
      setView('settings')
    }
    window.addEventListener(COOKIE_SETTINGS_EVENT, open)
    return () => window.removeEventListener(COOKIE_SETTINGS_EVENT, open)
  }, [])

  useEffect(() => {
    if (view !== 'settings') return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setView(readCookieChoice() === null ? 'banner' : 'hidden') }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [view])

  const choose = useCallback((next: 'accepted' | 'necessary') => {
    writeCookieChoice(next)
    setChoice(next)
    setView('hidden')
  }, [])

  return (
    <>
      {process.env.NODE_ENV === 'production' && choice === 'accepted' && <Analytics />}

      {view === 'banner' && (
        <div
          role="dialog"
          aria-label="Cookies i statystyki"
          className="rounded-2xl border border-border bg-card p-4 shadow-2xl sm:p-5"
          style={{ position: 'fixed', left: 12, right: 12, bottom: 12, zIndex: 2000, maxWidth: 560, marginInline: 'auto' }}
        >
          <p className="text-sm font-semibold text-foreground">Cookies i statystyki</p>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
            Niezbędne mechanizmy (logowanie, rezerwacja, płatności) działają zawsze. Za Twoją zgodą włączamy też anonimowe statystyki odwiedzin, które pomagają ulepszać serwis. Decyzję zmienisz w każdej chwili w stopce.{' '}
            <Link href="/cookies" className="underline underline-offset-2 hover:text-foreground">Polityka cookies</Link>
          </p>
          <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:justify-end">
            <Button type="button" variant="outline" size="sm" onClick={() => { setStatsOn(false); setView('settings') }}>Ustawienia</Button>
            <Button type="button" variant="outline" size="sm" onClick={() => choose('necessary')}>Tylko niezbędne</Button>
            <Button type="button" size="sm" className="font-semibold" onClick={() => choose('accepted')}>Akceptuję statystyki</Button>
          </div>
        </div>
      )}

      {view === 'settings' && (
        <div
          style={{ position: 'fixed', inset: 0, zIndex: 2100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, background: 'rgba(0,0,0,0.6)' }}
          onClick={(e) => { if (e.target === e.currentTarget) setView(readCookieChoice() === null ? 'banner' : 'hidden') }}
        >
          <div role="dialog" aria-modal="true" aria-label="Ustawienia cookies" className="w-full rounded-2xl border border-border bg-card p-5 shadow-2xl" style={{ maxWidth: 480 }}>
            <h2 className="text-base font-semibold text-foreground">Ustawienia cookies</h2>
            <div className="mt-4 flex flex-col divide-y divide-border rounded-xl border border-border">
              <div className="flex items-start justify-between gap-4 p-4">
                <div>
                  <p className="text-sm font-medium text-foreground">Niezbędne</p>
                  <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">Logowanie, sesja rezerwacji, płatności i bezpieczeństwo. Zawsze włączone.</p>
                </div>
                <span className="shrink-0 rounded-full bg-muted px-2.5 py-1 text-[11px] font-medium text-muted-foreground">Zawsze</span>
              </div>
              <div className="flex items-start justify-between gap-4 p-4">
                <div>
                  <p className="text-sm font-medium text-foreground">Statystyki odwiedzin</p>
                  <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">Anonimowe, zagregowane dane o odwiedzinach (Vercel Analytics).</p>
                </div>
                <Switch checked={statsOn} onCheckedChange={setStatsOn} aria-label="Statystyki odwiedzin" />
              </div>
            </div>
            <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:justify-end">
              <Button type="button" variant="outline" size="sm" onClick={() => setView(readCookieChoice() === null ? 'banner' : 'hidden')}>Anuluj</Button>
              <Button type="button" size="sm" className="font-semibold" onClick={() => choose(statsOn ? 'accepted' : 'necessary')}>Zapisz wybór</Button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
