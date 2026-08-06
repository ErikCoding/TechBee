'use client'

import { useEffect, useState } from 'react'
import { ArrowDownLeft, ArrowUpRight, RefreshCw, Plus, CreditCard, Loader2, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useAuth } from '@/lib/auth-context'
import { getWalletStats, getWalletTransactions, topUpWallet, withdrawFromWallet } from '@/services/wallet.service'
import { cn } from '@/lib/utils'
import type { Transaction, WalletStats } from '@/lib/types'

const typeConfig: Record<Transaction['type'], { icon: React.ElementType; amountClass: string }> = {
  credit: { icon: ArrowDownLeft, amountClass: 'text-emerald-500' },
  debit: { icon: ArrowUpRight, amountClass: 'text-foreground' },
  refund: { icon: RefreshCw, amountClass: 'text-blue-500' },
}

const statusConfig: Record<Transaction['status'], { label: string; className: string }> = {
  completed: { label: 'Zakończona', className: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' },
  pending: { label: 'Oczekuje', className: 'bg-yellow-500/10 text-yellow-600 dark:text-yellow-400' },
  failed: { label: 'Nieudana', className: 'bg-red-500/10 text-red-600 dark:text-red-400' },
}

const TOPUP_PRESETS = [50, 100, 250, 500]

interface Props {
  initialStats: WalletStats
  initialTransactions: Transaction[]
}

/**
 * The whole wallet page below the header — one client component so
 * top-up/withdraw actually mutate real (simulated) balance/history
 * and everything re-renders immediately. Starts from the
 * server-fetched demo baseline and re-fetches scoped to the real
 * signed-in user once known client-side.
 */
export function WalletClient({ initialStats, initialTransactions }: Props) {
  const { user } = useAuth()
  const [stats, setStats] = useState(initialStats)
  const [transactions, setTransactions] = useState(initialTransactions)
  const [modal, setModal] = useState<'topup' | 'withdraw' | null>(null)
  const [amount, setAmount] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function refresh(userId: string) {
    const [freshStats, freshTx] = await Promise.all([getWalletStats(userId), getWalletTransactions(userId)])
    setStats(freshStats)
    setTransactions(freshTx)
  }

  useEffect(() => {
    if (!user) return
    let cancelled = false
    Promise.all([getWalletStats(user.id), getWalletTransactions(user.id)]).then(([freshStats, freshTx]) => {
      if (!cancelled) {
        setStats(freshStats)
        setTransactions(freshTx)
      }
    })
    return () => {
      cancelled = true
    }
  }, [user])

  function openModal(kind: 'topup' | 'withdraw') {
    setModal(kind)
    setAmount('')
    setError(null)
  }

  async function handleSubmit() {
    if (!user) return
    const value = Number(amount)
    if (!value || value <= 0) {
      setError('Podaj kwotę większą od zera.')
      return
    }
    setSubmitting(true)
    setError(null)
    try {
      if (modal === 'topup') {
        await topUpWallet(user.id, Math.round(value))
      } else {
        const ok = await withdrawFromWallet(user.id, Math.round(value))
        if (!ok) {
          setError('Niewystarczające środki na koncie.')
          return
        }
      }
      await refresh(user.id)
      setModal(null)
    } catch {
      setError('Nie udało się zapisać operacji. Spróbuj ponownie.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <>
      {/* Balance card */}
      <div className="animate-fade-in-up relative mt-6 overflow-hidden rounded-3xl bg-[#F4B400] p-8">
        <div className="animate-gradient pointer-events-none absolute inset-0 opacity-20" style={{ backgroundImage: 'linear-gradient(120deg, transparent, #fff, transparent)' }} aria-hidden="true" />
        <p className="relative text-sm font-semibold text-[#78350F]">Dostępne saldo</p>
        <p className="relative mt-1 break-words text-4xl font-bold tracking-tight text-[#0A0A0A] sm:text-5xl">
          {stats.balance.toLocaleString('pl-PL')} zł
        </p>
        <p className="relative mt-1 text-sm text-[#78350F]">BeeCoins</p>
        <div className="relative mt-6 flex flex-wrap gap-3">
          <Button onClick={() => openModal('topup')} className="bg-[#0A0A0A] text-white hover:bg-[#1A1A1A] font-semibold transition-transform hover:-translate-y-0.5">
            <Plus className="mr-2 h-4 w-4" />
            Doładuj
          </Button>
          <Button onClick={() => openModal('withdraw')} variant="outline" className="border-[#0A0A0A]/30 bg-transparent text-[#0A0A0A] hover:bg-[#0A0A0A]/10 font-semibold">
            <CreditCard className="mr-2 h-4 w-4" />
            Wypłać
          </Button>
        </div>
      </div>

      {/* Summary stats */}
      <div className="mt-4 grid grid-cols-2 gap-4 md:grid-cols-3">
        {[
          { label: 'Wydano łącznie', value: `${stats.totalSpent.toLocaleString('pl-PL')} zł` },
          { label: 'Doładowania łącznie', value: `${stats.totalTopups.toLocaleString('pl-PL')} zł` },
          { label: 'Oczekujące', value: stats.pending > 0 ? `${stats.pending} zł` : 'Brak' },
        ].map((s, i) => (
          <div key={s.label} className="animate-fade-in-up rounded-2xl border border-border bg-card p-4 text-center" style={{ animationDelay: `${i * 60}ms` }}>
            <p className="text-lg font-bold text-foreground">{s.value}</p>
            <p className="text-xs text-muted-foreground">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Transaction list */}
      <div className="mt-8">
        <h2 className="mb-4 font-semibold text-foreground">Historia transakcji</h2>
        <div className="flex flex-col divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card">
          {transactions.map((tx) => {
            const type = typeConfig[tx.type]
            const status = statusConfig[tx.status]
            const TypeIcon = type.icon
            return (
              <div key={tx.id} className="flex items-center gap-4 px-5 py-4 transition-colors hover:bg-muted/40">
                <div
                  className={cn(
                    'flex h-9 w-9 shrink-0 items-center justify-center rounded-xl',
                    tx.type === 'credit' ? 'bg-emerald-500/10' :
                    tx.type === 'refund' ? 'bg-blue-500/10' : 'bg-muted',
                  )}
                >
                  <TypeIcon
                    className={cn(
                      'h-4 w-4',
                      tx.type === 'credit' ? 'text-emerald-500' :
                      tx.type === 'refund' ? 'text-blue-500' : 'text-muted-foreground',
                    )}
                    aria-hidden="true"
                  />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-foreground">{tx.description}</p>
                  <p className="text-xs text-muted-foreground">{tx.date}</p>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <span className={cn('text-sm font-semibold', type.amountClass)}>
                    {tx.amount > 0 ? '+' : ''}{Math.abs(tx.amount)} zł
                  </span>
                  <span className={cn('rounded-full px-2 py-0.5 text-[10px] font-medium', status.className)}>
                    {status.label}
                  </span>
                </div>
              </div>
            )
          })}
          {transactions.length === 0 && (
            <p className="p-8 text-center text-sm text-muted-foreground">Brak transakcji.</p>
          )}
        </div>
      </div>

      {/* Top-up / withdraw modal */}
      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50" onClick={() => !submitting && setModal(null)} aria-hidden="true" />
          <div className="relative w-full max-w-sm rounded-2xl border border-border bg-card p-6 shadow-xl animate-fade-in-up">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-foreground">
                {modal === 'topup' ? 'Doładuj portfel' : 'Wypłać środki'}
              </h3>
              <button type="button" onClick={() => setModal(null)} className="rounded-lg p-1 text-muted-foreground hover:bg-muted" aria-label="Zamknij">
                <X className="h-4 w-4" />
              </button>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              {modal === 'topup'
                ? 'Symulacja doładowania — bez rzeczywistej płatności.'
                : `Dostępne saldo: ${stats.balance.toLocaleString('pl-PL')} zł.`}
            </p>

            {modal === 'topup' && (
              <div className="mt-3 flex flex-wrap gap-1.5">
                {TOPUP_PRESETS.map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setAmount(String(p))}
                    className={cn(
                      'rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors',
                      amount === String(p) ? 'border-[#F4B400] bg-[#F4B400] text-[#0A0A0A]' : 'border-border text-muted-foreground hover:bg-muted',
                    )}
                  >
                    {p} zł
                  </button>
                ))}
              </div>
            )}

            <div className="mt-3">
              <Input
                type="number"
                min={1}
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="Kwota w zł"
                aria-label="Kwota"
              />
            </div>

            {error && <p className="mt-2 text-xs text-destructive">{error}</p>}

            <Button
              onClick={handleSubmit}
              disabled={submitting}
              className="mt-4 w-full bg-[#F4B400] text-[#0A0A0A] hover:bg-[#FBBF24] font-semibold"
            >
              {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {modal === 'topup' ? 'Doładuj' : 'Wypłać'}
            </Button>
          </div>
        </div>
      )}
    </>
  )
}
