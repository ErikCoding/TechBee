import { ArrowDownLeft, ArrowUpRight, RefreshCw, Plus, CreditCard } from 'lucide-react'
import { Navbar } from '@/components/layout/navbar'
import { Footer } from '@/components/layout/footer'
import { Button } from '@/components/ui/button'
import { getWalletStats, getWalletTransactions } from '@/services/wallet.service'
import { RequireAuth } from '@/components/auth/require-auth'
import { BackButton } from '@/components/shared/back-button'
import { cn } from '@/lib/utils'
import type { Transaction } from '@/lib/types'

const typeConfig: Record<Transaction['type'], { icon: React.ElementType; label: string; amountClass: string }> = {
  credit: { icon: ArrowDownLeft, label: 'Wpłata', amountClass: 'text-emerald-500' },
  debit: { icon: ArrowUpRight, label: 'Płatność', amountClass: 'text-foreground' },
  refund: { icon: RefreshCw, label: 'Zwrot', amountClass: 'text-blue-500' },
}

const statusConfig: Record<Transaction['status'], { label: string; className: string }> = {
  completed: { label: 'Zakończona', className: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' },
  pending: { label: 'Oczekuje', className: 'bg-yellow-500/10 text-yellow-600 dark:text-yellow-400' },
  failed: { label: 'Nieudana', className: 'bg-red-500/10 text-red-600 dark:text-red-400' },
}

export default async function WalletPage() {
  const [walletStats, walletTransactions] = await Promise.all([
    getWalletStats(),
    getWalletTransactions(),
  ])

  return (
    <>
      <Navbar />
      <main id="main-content" className="bg-background">
        <RequireAuth>
        <div className="mx-auto max-w-3xl px-4 py-8 md:px-8">
          <BackButton />
          <h1 className="text-2xl font-bold text-foreground">Portfel</h1>
          <p className="mt-0.5 text-muted-foreground">Zarządzaj BeeCoins i historią transakcji</p>

          {/* Balance card */}
          <div className="animate-fade-in-up relative mt-6 overflow-hidden rounded-3xl bg-[#F4B400] p-8">
            <div className="animate-gradient pointer-events-none absolute inset-0 opacity-20" style={{ backgroundImage: 'linear-gradient(120deg, transparent, #fff, transparent)' }} aria-hidden="true" />
            <p className="relative text-sm font-semibold text-[#78350F]">Dostępne saldo</p>
            <p className="relative mt-1 text-5xl font-bold tracking-tight text-[#0A0A0A]">
              {walletStats.balance.toLocaleString('pl-PL')} zł
            </p>
            <p className="relative mt-1 text-sm text-[#78350F]">BeeCoins</p>
            <div className="relative mt-6 flex flex-wrap gap-3">
              <Button className="bg-[#0A0A0A] text-white hover:bg-[#1A1A1A] font-semibold transition-transform hover:-translate-y-0.5">
                <Plus className="mr-2 h-4 w-4" />
                Doładuj
              </Button>
              <Button variant="outline" className="border-[#0A0A0A]/30 bg-transparent text-[#0A0A0A] hover:bg-[#0A0A0A]/10 font-semibold">
                <CreditCard className="mr-2 h-4 w-4" />
                Wypłać
              </Button>
            </div>
          </div>

          {/* Summary stats */}
          <div className="mt-4 grid grid-cols-2 gap-4 md:grid-cols-3">
            {[
              { label: 'Wydano łącznie', value: `${walletStats.totalSpent.toLocaleString('pl-PL')} zł` },
              { label: 'Doładowania łącznie', value: `${walletStats.totalTopups.toLocaleString('pl-PL')} zł` },
              { label: 'Oczekujące', value: walletStats.pending > 0 ? `${walletStats.pending} zł` : 'Brak' },
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
              {walletTransactions.map((tx) => {
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
            </div>
          </div>
        </div>
        </RequireAuth>
      </main>
      <Footer />
    </>
  )
}
