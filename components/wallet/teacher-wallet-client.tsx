'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ArrowDownLeft, ArrowUpRight, CreditCard, Loader2, Receipt, ShieldCheck, TrendingUp, Percent } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogBody, DialogFooter } from '@/components/ui/dialog'
import { FormError } from '@/components/ui/form-error'
import { StatusBadge, type StatusTone } from '@/components/ui/status-badge'
import { EmptyState } from '@/components/ui/empty-state'
import { getTeacherWallet, requestTeacherPayout } from '@/services/stripe.service'
import { getTeacherApplication } from '@/services/teachers.service'
import { useAuth } from '@/lib/auth-context'
import { fromGrosze } from '@/lib/stripe-config'
import type { PayoutRecord, TeacherStripeAccount, TeacherWalletSummary, WalletHistoryEntry } from '@/lib/types'

const payoutStatusConfig: Record<PayoutRecord['status'], { label: string; tone: StatusTone }> = {
  pending: { label: 'Oczekuje', tone: 'warning' },
  in_transit: { label: 'W drodze', tone: 'info' },
  paid: { label: 'Wypłacona', tone: 'success' },
  failed: { label: 'Nieudana', tone: 'error' },
  canceled: { label: 'Anulowana', tone: 'neutral' },
}

function pln(grosze: number): string {
  return `${fromGrosze(grosze).toLocaleString('pl-PL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} zł`
}

/**
 * Teacher-only wallet — every number here comes from Stripe (balance)
 * or from the teacher's own real lesson/payout docs (history), never a
 * Firestore-computed balance. See app/api/stripe/wallet/route.ts +
 * app/api/stripe/payout/route.ts. There is no student wallet anymore
 * (see components/teacher/teacher-booking-calendar.tsx: students pay
 * per-booking via Stripe Checkout instead).
 */
export function TeacherWalletClient() {
  const { user } = useAuth()
  const [stripeStatus, setStripeStatus] = useState<TeacherStripeAccount | null>(null)
  const [summary, setSummary] = useState<TeacherWalletSummary | null>(null)
  const [history, setHistory] = useState<WalletHistoryEntry[]>([])
  const [payouts, setPayouts] = useState<PayoutRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [amount, setAmount] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function load() {
    if (!user) return
    const [application, wallet] = await Promise.all([
      getTeacherApplication(user.id),
      getTeacherWallet().catch(() => null),
    ])
    setStripeStatus(application?.stripe ?? {})
    if (wallet) {
      setSummary(wallet.summary)
      setHistory(wallet.history)
      setPayouts(wallet.payouts)
    }
    setLoading(false)
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user])

  async function handlePayout() {
    const value = Number(amount)
    if (!value || value <= 0) {
      setError('Podaj kwotę większą od zera.')
      return
    }
    setSubmitting(true)
    setError(null)
    try {
      await requestTeacherPayout(Math.round(value * 100))
      setModalOpen(false)
      setAmount('')
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Nie udało się zlecić wypłaty.')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return <div className="mt-6 h-48 animate-pulse rounded-3xl border border-border bg-card" />
  }

  if (!stripeStatus?.onboardingComplete) {
    return (
      <div className="mt-6 flex flex-col items-center gap-3 rounded-3xl border border-warning/30 bg-warning-surface p-10 text-center">
        <ShieldCheck className="h-8 w-8 text-warning-on-surface" aria-hidden="true" />
        <p className="text-sm font-semibold text-foreground">Skonfiguruj wypłaty, aby zobaczyć portfel</p>
        <p className="max-w-sm text-xs text-muted-foreground">
          Połącz konto Stripe w panelu nauczyciela, aby zacząć otrzymywać płatności za lekcje i wypłacać zarobione środki.
        </p>
        <Link href="/dashboard/teacher">
          <Button className="mt-2 font-semibold">Przejdź do panelu nauczyciela</Button>
        </Link>
      </div>
    )
  }

  const available = summary?.availableGrosze ?? 0

  return (
    <>
      {/* Balance card — balance + at-a-glance stats unified in one panel instead of a separate grid below it */}
      <div className="animate-fade-in-up overflow-hidden rounded-2xl bg-primary">
        <div className="flex flex-col gap-6 p-8 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-sm font-semibold text-primary-foreground/70">Dostępne środki</p>
            <p className="mt-1 break-words text-4xl font-bold tracking-tight text-primary-foreground sm:text-5xl">{pln(available)}</p>
            <p className="mt-1 text-sm text-primary-foreground/70">Oczekujące: {pln(summary?.pendingGrosze ?? 0)}</p>
          </div>
          <Button
            onClick={() => { setModalOpen(true); setAmount(''); setError(null) }}
            disabled={available <= 0}
            className="w-fit bg-primary-foreground text-primary hover:bg-primary-foreground/90 font-semibold transition-transform hover:-translate-y-0.5 disabled:opacity-50"
          >
            <CreditCard className="mr-2 h-4 w-4" />
            Wypłać środki
          </Button>
        </div>
        <div className="grid grid-cols-1 divide-y divide-primary-foreground/15 border-t border-primary-foreground/15 sm:grid-cols-2 sm:divide-x sm:divide-y-0">
          {[
            { icon: TrendingUp, label: 'Zarobki w tym miesiącu', value: pln(summary?.monthlyEarningsGrosze ?? 0) },
            { icon: Percent, label: 'Prowizje Runbee w tym miesiącu', value: pln(summary?.platformFeesGrosze ?? 0) },
          ].map((s) => (
            <div key={s.label} className="flex items-center gap-3 px-8 py-4">
              <s.icon className="h-4 w-4 shrink-0 text-primary-foreground/60" aria-hidden="true" />
              <div className="min-w-0">
                <p className="text-sm font-bold text-primary-foreground">{s.value}</p>
                <p className="truncate text-[11px] text-primary-foreground/70">{s.label}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* History */}
      <div className="animate-fade-in-up mt-6 overflow-hidden rounded-2xl border border-border" style={{ animationDelay: '80ms' }}>
        <div className="flex items-center gap-2 bg-muted/40 px-5 py-3.5">
          <Receipt className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
          <h2 className="text-sm font-semibold text-foreground">Ostatnie transakcje</h2>
        </div>
        <div className="flex flex-col divide-y divide-border bg-card">
          {history.map((entry, i) => {
            if (entry.kind === 'lesson') {
              return (
                <div key={`lesson-${entry.lessonId}-${i}`} className="flex items-center gap-4 px-5 py-4 transition-colors hover:bg-muted/40">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-success-surface">
                    <ArrowDownLeft className="h-4 w-4 text-success-on-surface" aria-hidden="true" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-foreground">Lekcja z {entry.studentName}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {entry.topic} · cena {pln(entry.grossGrosze)} · prowizja {pln(entry.platformFeeGrosze)}
                    </p>
                  </div>
                  <span className="shrink-0 text-sm font-semibold text-success-on-surface">+{pln(entry.teacherAmountGrosze)}</span>
                </div>
              )
            }
            const status = payoutStatusConfig[entry.status]
            return (
              <div key={`payout-${i}`} className="flex items-center gap-4 px-5 py-4 transition-colors hover:bg-muted/40">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-muted">
                  <ArrowUpRight className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-foreground">Wypłata na konto</p>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <span className="text-sm font-semibold text-foreground">-{pln(entry.amountGrosze)}</span>
                  <StatusBadge tone={status.tone} dot={false} className="px-2 py-0.5 text-[10px]">{status.label}</StatusBadge>
                </div>
              </div>
            )
          })}
          {history.length === 0 && (
            <EmptyState icon={Receipt} title="Brak transakcji" description="Historia wypłat i lekcji pojawi się tutaj." className="py-12" />
          )}
        </div>
      </div>

      {/* Payout modal */}
      {modalOpen && (
        <Dialog open onOpenChange={(open) => { if (!open && !submitting) setModalOpen(false) }}>
          <DialogContent showClose={!submitting}>
            <DialogHeader>
              <DialogTitle>Wypłata środków</DialogTitle>
              <DialogDescription>Dostępne: {pln(available)}. Realna testowa wypłata Stripe.</DialogDescription>
            </DialogHeader>

            <DialogBody>
              <Input
                type="number"
                min={1}
                max={fromGrosze(available)}
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="Kwota w zł"
                aria-label="Kwota"
                disabled={submitting}
              />
              <FormError>{error}</FormError>
            </DialogBody>

            <DialogFooter>
              <Button onClick={handlePayout} disabled={submitting} className="w-full font-semibold">
                {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Wypłać na konto
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {payouts.length > 0 && (
        <p className="mt-3 text-center text-[11px] text-muted-foreground">
          Statusy wypłat aktualizują się automatycznie (Stripe: pending → in_transit → paid).
        </p>
      )}
    </>
  )
}
