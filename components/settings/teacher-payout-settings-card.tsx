'use client'

import { useEffect, useState } from 'react'
import { CheckCircle2, ExternalLink, Landmark, Loader2, RefreshCw, ShieldCheck, TriangleAlert } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { FormError } from '@/components/ui/form-error'
import { StatusBadge } from '@/components/ui/status-badge'
import { useAuth } from '@/lib/auth-context'
import { getTeacherApplication } from '@/services/teachers.service'
import { refreshTeacherStripeStatus, startTeacherStripeDashboard, startTeacherStripeOnboarding } from '@/services/stripe.service'
import type { TeacherStripeAccount } from '@/lib/types'

export function TeacherPayoutSettingsCard() {
  const { user } = useAuth()
  const [status, setStatus] = useState<TeacherStripeAccount | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState<'dashboard' | 'onboarding' | 'refresh' | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function load(refreshStripe = false) {
    if (!user) return
    setError(null)
    try {
      const next = refreshStripe
        ? await refreshTeacherStripeStatus()
        : (await getTeacherApplication(user.id))?.stripe ?? {}
      setStatus(next)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Nie udało się sprawdzić ustawień wypłat.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user])

  async function openDashboard() {
    setBusy('dashboard')
    setError(null)
    try {
      const url = await startTeacherStripeDashboard()
      window.location.href = url
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Nie udało się otworzyć ustawień Stripe.'
      await load(true)
      setError(message)
      setBusy(null)
    }
  }

  async function openOnboarding() {
    setBusy('onboarding')
    setError(null)
    try {
      const url = await startTeacherStripeOnboarding()
      window.location.href = url
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Nie udało się rozpocząć konfiguracji wypłat.')
      setBusy(null)
    }
  }

  async function refreshStatus() {
    setBusy('refresh')
    await load(true)
    setBusy(null)
  }

  if (loading) {
    return <div className="h-44 animate-pulse rounded-2xl border border-border bg-card" />
  }

  const configured = Boolean(status?.onboardingComplete)
  const hasAccount = Boolean(status?.accountId)

  return (
    <section className="overflow-hidden rounded-2xl border border-border bg-card">
      <div className="flex flex-col gap-4 border-b border-border bg-muted/35 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent">
            <Landmark className="h-4 w-4 text-bee-yellow-dark" aria-hidden="true" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-sm font-semibold text-foreground">Wypłaty i konto bankowe</h2>
              <StatusBadge tone={configured ? 'success' : 'warning'} dot={false} className="px-2 py-0.5 text-[10px]">
                {configured ? 'Gotowe' : hasAccount ? 'W trakcie' : 'Do konfiguracji'}
              </StatusBadge>
            </div>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
              Konto bankowe, dane właściciela i weryfikacja wypłat są obsługiwane w Stripe Express.
            </p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={refreshStatus} disabled={busy !== null}>
          {busy === 'refresh' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
          Sprawdź status
        </Button>
      </div>

      <div className="grid gap-4 p-5 lg:grid-cols-[1fr_260px]">
        <div className="rounded-xl border border-border bg-background/45 p-4">
          <div className="flex items-start gap-3">
            {configured ? (
              <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-success" aria-hidden="true" />
            ) : hasAccount ? (
              <TriangleAlert className="mt-0.5 h-5 w-5 shrink-0 text-warning" aria-hidden="true" />
            ) : (
              <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" aria-hidden="true" />
            )}
            <div>
              <p className="text-sm font-semibold text-foreground">
                {configured ? 'Stripe Express jest skonfigurowany' : hasAccount ? 'Konfiguracja Stripe wymaga dokończenia' : 'Skonfiguruj wypłaty Stripe'}
              </p>
              <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                {configured
                  ? 'Aby zmienić konto bankowe albo dane wypłat, przejdź do Stripe Express. Runbee nie przechowuje numeru rachunku bankowego.'
                  : 'Przejdź przez bezpieczny formularz Stripe, aby dodać dane potrzebne do wypłat za lekcje.'}
              </p>
              <FormError className="mt-3">{error}</FormError>
            </div>
          </div>
        </div>

        <div className="flex flex-col justify-center gap-2">
          {configured ? (
            <Button onClick={openDashboard} disabled={busy !== null} className="font-semibold">
              {busy === 'dashboard' ? <Loader2 className="h-4 w-4 animate-spin" /> : <ExternalLink className="h-4 w-4" />}
              Zmień konto bankowe w Stripe
            </Button>
          ) : (
            <Button onClick={openOnboarding} disabled={busy !== null} className="font-semibold">
              {busy === 'onboarding' ? <Loader2 className="h-4 w-4 animate-spin" /> : <ExternalLink className="h-4 w-4" />}
              {hasAccount ? 'Dokończ konfigurację' : 'Skonfiguruj wypłaty'}
            </Button>
          )}
          <p className="text-center text-[11px] leading-relaxed text-muted-foreground">
            Otworzy się bezpieczna strona Stripe.
          </p>
        </div>
      </div>
    </section>
  )
}
