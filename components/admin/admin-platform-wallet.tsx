'use client'

import { useEffect, useState } from 'react'
import { ArrowRight, Banknote, CheckCircle2, ChevronDown, Loader2, ReceiptText, Save, SendHorizonal, WalletCards } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { getPlatformWallet, updatePlatformCommission } from '@/services/admin.service'
import type { PlatformWalletEntry, PlatformWalletSummary } from '@/lib/types'

function pln(grosze: number | null | undefined) {
  if (grosze === null || grosze === undefined) return '—'
  return `${(grosze / 100).toLocaleString('pl-PL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} zł`
}

function signedPln(grosze: number | null | undefined) {
  if (grosze === null || grosze === undefined) return '—'
  return `${grosze < 0 ? '−' : ''}${pln(Math.abs(grosze))}`
}

function rateLabel(entry: PlatformWalletEntry) {
  if (typeof entry.effectiveCommissionPercent !== 'number') return '—'
  return `${entry.effectiveCommissionPercent.toLocaleString('pl-PL')}%`
}

function settlementLabel(status: PlatformWalletEntry['settlementStatus']) {
  switch (status) {
    case 'transferred':
      return 'Transfer wysłany'
    case 'ready_for_transfer':
      return 'Gotowe do transferu'
    case 'waiting_teacher_acceptance':
      return 'Czeka na nauczyciela'
    case 'waiting_lesson':
      return 'Czeka na lekcję'
    case 'waiting_confirmation':
      return 'Czeka na potwierdzenie'
    case 'refunded':
      return 'Zwrócono'
    case 'waiting_report':
    default:
      return 'Oczekuje na raport'
  }
}

function commissionBadge(entry: PlatformWalletEntry) {
  const promo = entry.commissionSource === 'founding_teacher'
  return (
    <Badge
      variant={promo ? 'default' : 'outline'}
      className={promo ? 'bg-accent text-accent-foreground' : 'bg-background text-muted-foreground'}
    >
      {rateLabel(entry)}{promo ? ' PROMO' : ''}
    </Badge>
  )
}

const COLLAPSED_ENTRY_COUNT = 5

export function AdminPlatformWallet() {
  const [summary, setSummary] = useState<PlatformWalletSummary | null>(null)
  const [entries, setEntries] = useState<PlatformWalletEntry[]>([])
  const [commissionDraft, setCommissionDraft] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [entriesExpanded, setEntriesExpanded] = useState(false)

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
        if (!cancelled) setError(err instanceof Error ? err.message : 'Nie udało się pobrać finansów Runbee.')
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

  const feeIncomplete = summary ? !summary.stripeFeesComplete : false
  const visibleEntries = entriesExpanded ? entries : entries.slice(0, COLLAPSED_ENTRY_COUNT)

  return (
    <section className="overflow-hidden rounded-2xl border border-border bg-card">
      <div className="flex flex-col gap-3 border-b border-border bg-muted/40 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-accent">
            <Banknote className="h-4 w-4 text-bee-yellow-dark" aria-hidden="true" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-foreground">Finanse Runbee</h2>
            <p className="mt-0.5 text-xs text-muted-foreground">Przepływ płatności, prowizje, koszty i rozliczenia nauczycieli.</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="relative">
            <Input
              value={commissionDraft}
              onChange={(e) => setCommissionDraft(e.target.value)}
              inputMode="decimal"
              className="h-9 w-24 pr-7 text-right text-sm font-semibold"
              aria-label="Standardowa prowizja Runbee w procentach"
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
            Ładowanie finansów Runbee...
          </div>
        ) : (
          <div className="flex flex-col gap-5">
            <div className="grid gap-3 lg:grid-cols-[1.15fr_1fr_1fr]">
              <div className="rounded-xl border border-success/25 bg-[linear-gradient(135deg,var(--background)_0%,color-mix(in_oklab,var(--success)_10%,var(--background))_100%)] p-4">
                <div className="flex items-center gap-2 text-xs font-semibold uppercase text-success">
                  <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
                  Runbee
                </div>
                <p className="mt-3 text-xs text-muted-foreground">Zarobek netto Runbee</p>
                <p className="mt-1 text-2xl font-extrabold tabular-nums text-foreground">
                  {summary?.netPlatformRevenueGrosze === null ? 'Niepełne dane' : pln(summary?.netPlatformRevenueGrosze)}
                </p>
                <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">Po odjęciu kosztów obsługi płatności</p>
                {feeIncomplete && (
                  <p className="mt-3 rounded-lg border border-success/30 bg-background/50 px-3 py-2 text-[11px] text-muted-foreground">
                    Brakuje snapshotu Stripe fee dla {summary?.stripeFeesMissingCount ?? 0} starszych transakcji.
                  </p>
                )}
                <div className="mt-4 grid gap-2 text-xs sm:grid-cols-3">
                  <div>
                    <p className="text-muted-foreground">Prowizja Runbee</p>
                    <p className="font-semibold tabular-nums text-success">{pln(summary?.grossPlatformCommissionGrosze)}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Koszty Stripe</p>
                    <p className="font-semibold tabular-nums text-muted-foreground">{signedPln(summary ? -summary.stripeProcessingFeesGrosze : undefined)}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Koszty zwrotów</p>
                    <p className="font-semibold tabular-nums text-muted-foreground">{signedPln(summary ? -summary.refundCostGrosze : undefined)}</p>
                  </div>
                </div>
              </div>

              <div className="rounded-xl border border-border bg-background/50 p-4">
                <div className="flex items-center gap-2 text-xs font-semibold uppercase text-muted-foreground">
                  <SendHorizonal className="h-3.5 w-3.5" aria-hidden="true" />
                  Nauczyciele
                </div>
                <p className="mt-3 text-xs text-muted-foreground">Do wypłaty nauczycielom</p>
                <p className="mt-1 text-xl font-bold tabular-nums text-foreground">{pln(summary?.teacherAmountGrosze)}</p>
                <div className="mt-4 grid gap-2 text-xs">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-muted-foreground">Oczekuje na zwolnienie</span>
                    <span className="font-semibold tabular-nums text-foreground">{pln(summary?.teacherPendingReleaseGrosze)}</span>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-muted-foreground">Gotowe do transferu</span>
                    <span className="font-semibold tabular-nums text-foreground">{pln(summary?.teacherReadyForTransferGrosze)}</span>
                  </div>
                  <div className="flex items-center justify-between gap-3 border-t border-border pt-2">
                    <span className="text-muted-foreground">Przekazane nauczycielom</span>
                    <span className="font-semibold tabular-nums text-foreground">{pln(summary?.teacherTransferredGrosze)}</span>
                  </div>
                </div>
              </div>

              <div className="rounded-xl border border-border bg-background/50 p-4">
                <div className="flex items-center gap-2 text-xs font-semibold uppercase text-muted-foreground">
                  <WalletCards className="h-3.5 w-3.5" aria-hidden="true" />
                  Stripe
                </div>
                <div className="mt-3 grid gap-3 text-xs">
                  <div>
                    <p className="text-muted-foreground">Saldo dostępne Stripe</p>
                    <p className="mt-1 text-base font-bold tabular-nums text-foreground">{pln(summary?.stripeAvailableGrosze)}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Saldo oczekujące Stripe</p>
                    <p className="mt-1 text-base font-bold tabular-nums text-foreground">{pln(summary?.stripePendingGrosze)}</p>
                  </div>
                </div>
                <p className="mt-4 text-[11px] leading-relaxed text-muted-foreground">
                  Saldo techniczne Stripe — zawiera środki Runbee oraz środki przeznaczone dla nauczycieli.
                </p>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-xl border border-border bg-background/50 p-4">
                <p className="text-xs text-muted-foreground">Obrót opłacony</p>
                <p className="mt-1 text-base font-bold tabular-nums text-foreground">{pln(summary?.paidVolumeGrosze)}</p>
              </div>
              <div className="rounded-xl border border-border bg-background/50 p-4">
                <p className="text-xs text-muted-foreground">Zwroty</p>
                <p className="mt-1 text-base font-bold tabular-nums text-foreground">{pln(summary?.refundAmountGrosze)}</p>
                <p className="mt-1 text-[11px] text-muted-foreground">Łączna kwota zwrócona klientom</p>
                <div className="mt-3 grid gap-1 text-xs">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-muted-foreground">Koszt zwrotów dla Runbee</span>
                    <span className="font-semibold tabular-nums text-foreground">{pln(summary?.refundCostGrosze)}</span>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-muted-foreground">Liczba zwrotów</span>
                    <span className="font-semibold tabular-nums text-foreground">{summary?.refundCount ?? 0}</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-border bg-background/50 p-4">
              <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                <span>Zapłacono</span>
                <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Prowizja Runbee</span>
                <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Koszt Stripe</span>
                <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Runbee netto</span>
                <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Nauczyciel</span>
              </div>
            </div>

            <div className="overflow-hidden rounded-xl border border-border">
              <div className="flex items-center gap-2 border-b border-border bg-muted/30 px-4 py-3">
                <ReceiptText className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                <p className="text-xs font-semibold text-foreground">Ostatnie płatności</p>
              </div>
              {entries.length === 0 ? (
                <p className="px-4 py-6 text-center text-xs text-muted-foreground">Brak płatności.</p>
              ) : (
                <>
                  <div className="hidden divide-y divide-border lg:block">
                    <div className="grid grid-cols-[1.45fr_.8fr_.9fr_.9fr_.85fr_.95fr] gap-3 bg-muted/20 px-4 py-2 text-[11px] font-medium text-muted-foreground">
                      <span>Lekcja</span>
                      <span>Zapłacono</span>
                      <span>Prowizja Runbee</span>
                      <span>Stripe / netto</span>
                      <span>Nauczyciel</span>
                      <span>Status</span>
                    </div>
                    {visibleEntries.map((entry) => (
                      <div key={entry.lessonId} className="grid grid-cols-[1.45fr_.8fr_.9fr_.9fr_.85fr_.95fr] gap-3 px-4 py-3 text-xs">
                        <div className="min-w-0">
                          <p className="truncate font-semibold text-foreground">{entry.topic}</p>
                          <p className="truncate text-muted-foreground">{entry.studentName} → {entry.teacherName}</p>
                          <p className="mt-0.5 text-[11px] text-muted-foreground">{entry.date}</p>
                        </div>
                        <p className="font-semibold tabular-nums text-foreground">{pln(entry.grossGrosze)}</p>
                        <div>
                          <p className="font-semibold tabular-nums text-foreground">{pln(entry.platformFeeGrosze)}</p>
                          <div className="mt-1">{commissionBadge(entry)}</div>
                        </div>
                        <div>
                          <p className="tabular-nums text-muted-foreground">Stripe: {signedPln(typeof entry.stripeFeeGrosze === 'number' ? -entry.stripeFeeGrosze : undefined)}</p>
                          <p className="mt-0.5 tabular-nums text-foreground">Netto: {pln(entry.netPlatformRevenueGrosze)}</p>
                        </div>
                        <p className="font-semibold tabular-nums text-foreground">{pln(entry.teacherAmountGrosze)}</p>
                        <p className="text-muted-foreground">{settlementLabel(entry.settlementStatus)}</p>
                      </div>
                    ))}
                  </div>

                  <div className="divide-y divide-border lg:hidden">
                    {visibleEntries.map((entry) => (
                      <div key={entry.lessonId} className="px-4 py-3 text-xs">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="truncate font-semibold text-foreground">{entry.topic}</p>
                            <p className="truncate text-muted-foreground">{entry.studentName} → {entry.teacherName}</p>
                            <p className="mt-0.5 text-[11px] text-muted-foreground">{entry.date}</p>
                          </div>
                          <p className="shrink-0 font-bold tabular-nums text-foreground">{pln(entry.grossGrosze)}</p>
                        </div>
                        <div className="mt-3 grid gap-2">
                          <div className="flex items-center justify-between gap-3">
                            <span className="text-muted-foreground">Prowizja Runbee</span>
                            <span className="flex items-center gap-2 font-semibold tabular-nums text-foreground">{pln(entry.platformFeeGrosze)} {commissionBadge(entry)}</span>
                          </div>
                          <div className="flex items-center justify-between gap-3">
                            <span className="text-muted-foreground">Stripe</span>
                            <span className="tabular-nums text-foreground">{signedPln(typeof entry.stripeFeeGrosze === 'number' ? -entry.stripeFeeGrosze : undefined)}</span>
                          </div>
                          <div className="flex items-center justify-between gap-3">
                            <span className="text-muted-foreground">Runbee netto</span>
                            <span className="tabular-nums text-foreground">{pln(entry.netPlatformRevenueGrosze)}</span>
                          </div>
                          <div className="flex items-center justify-between gap-3">
                            <span className="text-muted-foreground">Nauczyciel</span>
                            <span className="tabular-nums text-foreground">{pln(entry.teacherAmountGrosze)}</span>
                          </div>
                          <div className="flex items-center justify-between gap-3">
                            <span className="text-muted-foreground">Status</span>
                            <span className="text-foreground">{settlementLabel(entry.settlementStatus)}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  {entries.length > COLLAPSED_ENTRY_COUNT && (
                    <button
                      type="button"
                      onClick={() => setEntriesExpanded((prev) => !prev)}
                      className="flex w-full items-center justify-center gap-1.5 border-t border-border bg-muted/20 px-4 py-2.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted/40 hover:text-foreground"
                    >
                      <ChevronDown
                        className={`h-3.5 w-3.5 transition-transform duration-200 ${entriesExpanded ? 'rotate-180' : ''}`}
                        aria-hidden="true"
                      />
                      {entriesExpanded ? 'Zwiń' : `Pokaż więcej (${entries.length - COLLAPSED_ENTRY_COUNT})`}
                    </button>
                  )}
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </section>
  )
}
