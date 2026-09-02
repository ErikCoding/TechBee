'use client'

import { useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { CheckCircle2, Loader2, ShieldCheck, TriangleAlert } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/lib/auth-context'
import { getTeacherApplication } from '@/services/teachers.service'
import { refreshTeacherStripeStatus, startTeacherStripeOnboarding } from '@/services/stripe.service'
import type { TeacherStripeAccount } from '@/lib/types'

interface StripeConnectProps {
  /**
   * `card` keeps the original standalone banner (still used if this is
   * ever mounted on its own). `row` renders the same states without a
   * border of its own so TeacherReadinessPanel can group payout setup
   * together with profile verification instead of stacking two
   * full-width banners above the teacher's actual work.
   *
   * Purely presentational — the Stripe status fetch, the
   * post-onboarding polling and the onboarding redirect below are
   * untouched by it.
   */
  variant?: 'card' | 'row'
  /** Lets the parent skip rendering the whole readiness group once payouts are done. */
  onStatusChange?: (complete: boolean) => void
}

/**
 * "Skonfiguruj wypłaty" — the one place a teacher briefly leaves
 * Runbee's own UI (Stripe-hosted onboarding/KYC, legally required —
 * see app/api/stripe/connect/onboard). Everything else about the
 * teacher's money (balance, history, payouts) stays in Runbee's own
 * UX (see components/wallet/teacher-wallet-client.tsx).
 */
export function TeacherStripeConnectCard({ variant = 'card', onStatusChange }: StripeConnectProps = {}) {
  const { user } = useAuth()
  const searchParams = useSearchParams()
  const [status, setStatus] = useState<TeacherStripeAccount | null>(null)
  const [loading, setLoading] = useState(true)
  const [starting, setStarting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Always show the cached (Firestore) status first so the card renders
  // instantly, then re-check the real Stripe status live in the
  // background — cached data can be stale (e.g. the teacher finished
  // onboarding, closed the tab, and came back later without the
  // ?stripeOnboarding=done param that used to be the only trigger for a
  // live check).
  useEffect(() => {
    if (!user) return
    let cancelled = false
    getTeacherApplication(user.id)
      .then((t) => { if (!cancelled) setStatus(t?.stripe ?? {}) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [user])

  useEffect(() => {
    if (!user) return
    const justReturnedFromOnboarding = Boolean(searchParams.get('stripeOnboarding'))
    let cancelled = false

    async function refreshOnce() {
      try {
        const fresh = await refreshTeacherStripeStatus()
        if (!cancelled) { setStatus(fresh); setError(null) }
        return fresh
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Nie udało się sprawdzić statusu konta Stripe.')
        return null
      }
    }

    ;(async () => {
      if (justReturnedFromOnboarding) setLoading(true)
      const fresh = await refreshOnce()
      if (!cancelled) setLoading(false)
      // Stripe capability activation can lag a few seconds behind the
      // onboarding return redirect, even in Test Mode — if we just came
      // back and it's not complete yet, poll a couple more times instead
      // of leaving the teacher stuck on a stale "not configured" card.
      if (justReturnedFromOnboarding && fresh && !fresh.onboardingComplete) {
        for (const delayMs of [3000, 6000]) {
          await new Promise((resolve) => setTimeout(resolve, delayMs))
          if (cancelled) return
          const retried = await refreshOnce()
          if (retried?.onboardingComplete) break
        }
      }
    })()

    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, searchParams])

  // Lets a parent (TeacherReadinessPanel) drop the whole setup group from
  // the page once payouts are verified, instead of showing a permanent
  // "all good" banner that costs a full-width block forever.
  useEffect(() => {
    if (status) onStatusChange?.(Boolean(status.onboardingComplete))
  }, [status, onStatusChange])

  async function handleStart() {
    setStarting(true)
    setError(null)
    try {
      const url = await startTeacherStripeOnboarding()
      window.location.href = url
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Nie udało się rozpocząć konfiguracji.')
      setStarting(false)
    }
  }

  const isRow = variant === 'row'

  if (loading) {
    return (
      <div
        className={
          isRow
            ? 'flex items-center justify-center px-5 py-4'
            : 'flex items-center justify-center rounded-2xl border border-border bg-card p-5'
        }
      >
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" aria-hidden="true" />
      </div>
    )
  }

  if (status?.onboardingComplete) {
    return (
      <div
        className={
          isRow
            ? 'flex items-center gap-3 px-5 py-3.5'
            : 'flex items-center gap-3 rounded-2xl border border-success/30 bg-success-surface p-5'
        }
      >
        <CheckCircle2 className={isRow ? 'h-4 w-4 shrink-0 text-success' : 'h-5 w-5 shrink-0 text-success'} aria-hidden="true" />
        <div className="min-w-0">
          <p className="text-sm font-semibold text-foreground">Wypłaty skonfigurowane</p>
          <p className="text-xs text-muted-foreground">
            {isRow
              ? 'Konto Stripe zweryfikowane.'
              : 'Twoje konto Stripe jest zweryfikowane i gotowe do przyjmowania płatności.'}
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className={isRow ? 'px-5 py-4' : 'rounded-2xl border border-warning/30 bg-warning-surface p-5'}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <ShieldCheck className="h-5 w-5 shrink-0 text-warning sm:mt-0.5 sm:self-start" aria-hidden="true" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-foreground">Skonfiguruj wypłaty</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {status?.accountId
              ? 'Weryfikacja Stripe jest w toku — dokończ ją, aby zacząć otrzymywać płatności za lekcje.'
              : 'Połącz konto Stripe, aby otrzymywać płatności za lekcje i wypłacać zarobione środki na swoje konto bankowe.'}
          </p>
          {error && (
            <p className="mt-2 flex items-center gap-1.5 text-xs text-destructive">
              <TriangleAlert className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              {error}
            </p>
          )}
        </div>
        <Button onClick={handleStart} disabled={starting} size="sm" className="shrink-0 font-semibold sm:ml-auto">
          {starting ? <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> : null}
          {status?.accountId ? 'Dokończ weryfikację' : 'Skonfiguruj wypłaty'}
        </Button>
      </div>
    </div>
  )
}
