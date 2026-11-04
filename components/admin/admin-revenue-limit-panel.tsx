'use client'

import { useCallback, useEffect, useState } from 'react'
import { AlertTriangle, CheckCircle2, Download, Info, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { StatusBadge } from '@/components/ui/status-badge'
import { getRevenueLedger } from '@/services/admin.service'
import type { QuarterSummary } from '@/lib/revenue-ledger-core'

const pln = (grosze: number) => `${(grosze / 100).toLocaleString('pl-PL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} zł`
const pct = (share: number) => `${(share * 100).toLocaleString('pl-PL', { maximumFractionDigits: 1 })}%`

type Level = QuarterSummary['warning']

const LEVEL: Record<Level, { tone: 'success' | 'warning' | 'error'; label: string; bar: string; alert: string | null }> = {
  none: { tone: 'success', label: 'W normie', bar: 'var(--primary)', alert: null },
  warning_80: { tone: 'warning', label: 'Powyżej 80% limitu', bar: '#F59E0B', alert: 'Przekroczono 80% limitu kwartalnego. Zaplanuj rejestrację działalności w CEIDG.' },
  warning_95: { tone: 'error', label: 'Powyżej 95% limitu', bar: '#EF4444', alert: 'Przekroczono 95% limitu kwartalnego. Po przekroczeniu limitu masz 7 dni na rejestrację w CEIDG.' },
  exceeded: { tone: 'error', label: 'Limit przekroczony', bar: '#EF4444', alert: 'Limit kwartalny przekroczony. Masz 7 dni na rejestrację w CEIDG, skontaktuj się z księgowym.' },
}

function Meter({ title, hint, valueGrosze, limitGrosze, share, level, primary }: {
  title: string; hint: string; valueGrosze: number; limitGrosze: number; share: number; level: Level; primary?: boolean
}) {
  const cfg = LEVEL[level]
  const width = Math.min(100, share * 100)
  const left = Math.max(0, limitGrosze - valueGrosze)
  return (
    <div className="rounded-xl border border-border bg-background/40 p-4" style={primary ? { borderColor: 'color-mix(in srgb, var(--primary) 40%, var(--border))' } : undefined}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-foreground">{title}</p>
          <p className="mt-0.5 text-xs leading-snug text-muted-foreground">{hint}</p>
        </div>
        <StatusBadge tone={cfg.tone} dot={false} className="shrink-0 px-2 py-0.5 text-[10px]">{cfg.label}</StatusBadge>
      </div>

      <p className="mt-4 text-2xl font-bold tracking-tight text-foreground">{pln(valueGrosze)}</p>
      <p className="text-xs text-muted-foreground">{pct(share)} limitu · zostało {pln(left)}</p>

      {/* Pasek z progami 80% i 95% */}
      <div className="relative mt-3" style={{ height: 10 }}>
        <div className="absolute inset-0 overflow-hidden rounded-full bg-muted" role="progressbar" aria-valuenow={Math.round(width)} aria-valuemin={0} aria-valuemax={100} aria-label={title}>
          <div style={{ width: `${width}%`, height: '100%', background: cfg.bar, borderRadius: 999, transition: 'width 600ms ease' }} />
        </div>
        {[80, 95].map((mark) => (
          <span key={mark} aria-hidden="true" style={{ position: 'absolute', top: -2, bottom: -2, left: `${mark}%`, width: 2, background: 'var(--border)', borderRadius: 1 }} />
        ))}
      </div>
      <div className="relative mt-1.5 text-[10px] text-muted-foreground" style={{ height: 12 }}>
        <span style={{ position: 'absolute', left: 0 }}>0</span>
        <span style={{ position: 'absolute', left: '80%', transform: 'translateX(-50%)' }}>80%</span>
        <span style={{ position: 'absolute', left: '95%', transform: 'translateX(-50%)' }}>95%</span>
      </div>
    </div>
  )
}

/** Licznik kwartalnego limitu działalności nierejestrowanej + eksport ewidencji (CSV). Tylko odczyt danych. */
export function AdminRevenueLimitPanel() {
  const [summary, setSummary] = useState<QuarterSummary | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [exporting, setExporting] = useState(false)

  useEffect(() => {
    let cancelled = false
    getRevenueLedger()
      .then((res) => { if (!cancelled) setSummary(res.summary) })
      .catch((err) => { if (!cancelled) setError(err instanceof Error ? err.message : 'Nie udało się pobrać danych.') })
    return () => { cancelled = true }
  }, [])

  const exportCsv = useCallback(async () => {
    setExporting(true)
    setError(null)
    try {
      const res = await getRevenueLedger({ format: 'csv', quarter: summary ? `${summary.quarter.year}-Q${summary.quarter.quarter}` : undefined })
      if (!res.csv) throw new Error('Brak danych do eksportu.')
      const url = URL.createObjectURL(new Blob([res.csv], { type: 'text/csv;charset=utf-8' }))
      const a = document.createElement('a')
      a.href = url
      a.download = res.filename ?? 'runbee-ewidencja.csv'
      a.click()
      URL.revokeObjectURL(url)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Nie udało się wyeksportować ewidencji.')
    } finally {
      setExporting(false)
    }
  }, [summary])

  const alert = summary ? LEVEL[summary.warning].alert : null

  return (
    <section className="overflow-hidden rounded-2xl border border-border bg-card">
      <div className="flex flex-wrap items-center justify-between gap-3 bg-muted/40 px-5 py-3.5 sm:px-6">
        <div className="flex flex-wrap items-center gap-2.5">
          <h2 className="text-sm font-semibold text-foreground">Limit działalności nierejestrowanej</h2>
          {summary && <span className="rounded-full border border-border bg-background px-2.5 py-0.5 text-[11px] font-medium text-muted-foreground">{summary.quarter.label}</span>}
        </div>
        <Button type="button" variant="outline" size="sm" onClick={() => void exportCsv()} disabled={exporting || !summary}>
          {exporting ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Download className="h-4 w-4" aria-hidden="true" />}
          Eksport ewidencji (CSV)
        </Button>
      </div>

      <div className="flex flex-col gap-4 p-5 sm:p-6">
        {!summary && !error && <div className="h-40 animate-pulse rounded-xl bg-muted/50" />}
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}

        {summary && (
          <>
            <p className="text-xs text-muted-foreground">
              Limit kwartalny: <span className="font-semibold text-foreground">{pln(summary.limitGrosze)}</span> · tylko płatności produkcyjne, bez zwrotów · liczba płatności: {summary.entryCount}
            </p>

            <div className="grid gap-4 lg:grid-cols-2">
              <Meter primary title="Przychód Runbee" hint="Prowizja od korepetytorów + opłata serwisowa uczniów. Od tego liczymy ostrzeżenia."
                valueGrosze={summary.runbeeRevenueGrosze} limitGrosze={summary.limitGrosze} share={summary.runbeeRevenueShare} level={summary.warning} />
              <Meter title="Obrót przez konto Stripe" hint="Całe płatności uczniów, w tym część należna korepetytorom. Informacyjnie."
                valueGrosze={summary.turnoverGrosze} limitGrosze={summary.limitGrosze} share={summary.turnoverShare} level={summary.turnoverWarning} />
            </div>

            {alert ? (
              <p role="status" className="flex items-start gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2.5 text-xs leading-relaxed text-amber-200">
                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                {alert}
              </p>
            ) : (
              <p className="flex items-center gap-2 text-xs text-muted-foreground">
                <CheckCircle2 className="h-3.5 w-3.5 text-success" aria-hidden="true" />
                Przychód Runbee mieści się w limicie kwartału.
              </p>
            )}

            <details className="group rounded-lg border border-border px-3 py-2 text-xs text-muted-foreground">
              <summary className="flex cursor-pointer list-none items-center gap-2 font-medium text-foreground">
                <Info className="h-3.5 w-3.5" aria-hidden="true" /> Jak to liczymy i co to jest ten limit
              </summary>
              <div className="mt-2 flex flex-col gap-2 leading-relaxed">
                <p>Działalność nierejestrowana to wyjątek dla małego dorabiania bez firmy. Od 2026 roku limit wynosi 225% płacy minimalnej na kwartał (10 813,50 zł). Po przekroczeniu masz 7 dni na wpis do CEIDG.</p>
                <p>Która z dwóch liczb wlicza się do limitu, zależy od modelu prawnego (pośrednik czy sprzedawca) i to ustali księgowy. Dlatego pokazujemy obie.</p>
                <p>W CSV płatności bez zapisanej zgody na start usługi mają „brak” (dotyczy starszych zamówień).</p>
              </div>
            </details>
          </>
        )}
      </div>
    </section>
  )
}
