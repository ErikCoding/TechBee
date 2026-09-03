'use client'

import { useEffect, useState } from 'react'
import { Banknote, Clock3, Loader2, Percent, Save, SendHorizonal, ShieldCheck, WalletCards } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { getPlatformWallet, updatePlatformCommission } from '@/services/admin.service'
import type { PlatformWalletEntry, PlatformWalletSummary } from '@/lib/types'

function pln(grosze: number | null | undefined) {
  if (grosze === null || grosze === undefined) return '—'
  return `${(grosze / 100).toLocaleString('pl-PL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} zł`
}

export function AdminPlatformWallet() {
  const [summary, setSummary] = useState<PlatformWalletSummary | null>(null)
  const [entries, setEntries] = useState<PlatformWalletEntry[]>([])
  const [commissionDraft, setCommissionDraft] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    getPlatformWallet()
      .then((wallet) => {
        if (cancelled) return
        setSummary(wallet.summary)
        setEntries(wallet.entries)
        setCommissionDraft(String(wallet.summary.commissionPercent))
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Nie udało się pobrać portfela platformy.')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  async function saveCommission() {
    const value = Number(commissionDraft.replace(',', '.'))
    if (!Number.isFinite(value) || value < 0 || value > 50) {
      setError('Prowizja musi być liczbą od 0 do 50%.')
      return
    }
    setSaving(true)
    setError(null)
    try {
      const wallet = await updatePlatformCommission(value)
      setSummary(wallet.summary)
      setEntries(wallet.entries)
      setCommissionDraft(String(wallet.summary.commissionPercent))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Nie udało się zapisać prowizji.')
    } finally {
      setSaving(false)
    }
  }

  const cards = [
    { icon: WalletCards, label: 'Saldo dostępne Stripe', value: pln(summary?.availableGrosze), hint: 'Możliwe do wypłaty na konto platformy' },
    { icon: Clock3, label: 'Saldo oczekujące', value: pln(summary?.pendingGrosze), hint: 'Środki w rozliczeniu Stripe' },
    { icon: Percent, label: 'Prowizja Runbee', value: pln(summary?.platformFeesGrosze), hint: 'Suma prowizji z opłaconych lekcji' },
    { icon: SendHorizonal, label: 'Do transferu nauczycielom', value: pln(summary?.pendingTeacherTransfersGrosze), hint: 'Opłacone lekcje przed zwolnieniem środków' },
  ]

  return (
    <section className="overflow-hidden rounded-2xl border border-border bg-card">
      <div className="flex flex-col gap-3 border-b border-border bg-muted/40 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-accent">
            <Banknote className="h-4 w-4 text-bee-yellow-dark" aria-hidden="true" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-foreground">Portfel platformy</h2>
            <p className="mt-0.5 text-xs text-muted-foreground">Saldo Stripe, prowizje Runbee i transfery dla nauczycieli.</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="relative">
            <Input
              value={commissionDraft}
              onChange={(e) => setCommissionDraft(e.target.value)}
              inputMode="decimal"
              className="h-9 w-24 pr-7 text-right text-sm font-semibold"
              aria-label="Prowizja Runbee w procentach"
            />
            <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">%</span>
          </div>
          <Button type="button" size="sm" onClick={saveCommission} disabled={saving || loading} className="h-9">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Zapisz
          </Button>
        </div>
      </div>

      {error && <div className="border-b border-border bg-destructive/10 px-5 py-2 text-xs text-destructive">{error}</div>}

      <div className="p-5">
        {loading ? (
          <div className="flex h-32 items-center justify-center text-sm text-muted-foreground">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Ładowanie portfela platformy...
          </div>
        ) : (
          <div className="flex flex-col gap-5">
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {cards.map((card) => {
                const Icon = card.icon
                return (
                  <div key={card.label} className="rounded-xl border border-border bg-background/50 p-4">
                    <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                      <Icon className="h-3.5 w-3.5" aria-hidden="true" />
                      {card.label}
                    </div>
                    <p className="mt-2 text-lg font-bold tabular-nums text-foreground">{card.value}</p>
                    <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">{card.hint}</p>
                  </div>
                )
              })}
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-xl border border-border bg-background/50 p-4">
                <p className="text-xs text-muted-foreground">Obrót opłacony</p>
                <p className="mt-1 text-base font-bold tabular-nums text-foreground">{pln(summary?.grossPaidGrosze)}</p>
              </div>
              <div className="rounded-xl border border-border bg-background/50 p-4">
                <p className="text-xs text-muted-foreground">Przekazane nauczycielom</p>
                <p className="mt-1 text-base font-bold tabular-nums text-foreground">{pln(summary?.teacherTransfersGrosze)}</p>
              </div>
              <div className="rounded-xl border border-border bg-background/50 p-4">
                <p className="text-xs text-muted-foreground">Zwroty</p>
                <p className="mt-1 text-base font-bold tabular-nums text-foreground">{pln(summary?.refundedGrosze)}</p>
              </div>
            </div>

            <div className="overflow-hidden rounded-xl border border-border">
              <div className="flex items-center gap-2 border-b border-border bg-muted/30 px-4 py-3">
                <ShieldCheck className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                <p className="text-xs font-semibold text-foreground">Ostatnie opłacone lekcje</p>
              </div>
              {entries.length === 0 ? (
                <p className="px-4 py-6 text-center text-xs text-muted-foreground">Brak opłaconych lekcji.</p>
              ) : (
                <div className="divide-y divide-border">
                  {entries.map((entry) => (
                    <div key={entry.lessonId} className="grid gap-2 px-4 py-3 text-xs sm:grid-cols-[1fr_auto_auto_auto] sm:items-center">
                      <div className="min-w-0">
                        <p className="truncate font-semibold text-foreground">{entry.topic}</p>
                        <p className="truncate text-muted-foreground">{entry.studentName} → {entry.teacherName}</p>
                      </div>
                      <p className="tabular-nums text-muted-foreground">Obrót {pln(entry.grossGrosze)}</p>
                      <p className="tabular-nums text-success-on-surface">Runbee {pln(entry.platformFeeGrosze)}</p>
                      <p className="tabular-nums text-muted-foreground">
                        {entry.transferStatus === 'sent' ? 'Transfer wysłany' : 'Czeka na raport'} · {pln(entry.teacherAmountGrosze)}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </section>
  )
}
