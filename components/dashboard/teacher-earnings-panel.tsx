'use client'

import { Wallet, TrendingUp } from 'lucide-react'
import { Panel, PanelFooterLink } from '@/components/dashboard/dashboard-primitives'
import { cn } from '@/lib/utils'
import type { TeacherDashboardData } from '@/lib/types'

interface Props {
  data: TeacherDashboardData
}

/**
 * Every earnings figure in one place.
 *
 * The teacher's money used to be spread across four surfaces that never
 * appeared together: a "Ten miesiąc" stat card in the top row, a
 * full-width six-month bar chart in the main column, a separate "Zarobki
 * łączne" card in the sidebar, and the /wallet page behind a quick link.
 * A teacher wanting to answer "how am I doing and can I withdraw?" had
 * to read three regions and then navigate. This groups the monthly
 * figure, the lifetime total, the trend and the route to payouts into a
 * single panel.
 *
 * The chart keeps its horizontal scroll on narrow screens — six flex-1
 * columns squeezed into 375px clipped their own labels.
 */
export function TeacherEarningsPanel({ data }: Props) {
  const maxEarnings = Math.max(...data.earningsChart.map((e) => e.amount), 1)
  const currentMonth = data.earningsChart[data.earningsChart.length - 1]?.month

  return (
    <Panel icon={Wallet} title="Zarobki">
      <div className="grid grid-cols-2 divide-x divide-border border-b border-border">
        <div className="px-5 py-4">
          <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Ten miesiąc</p>
          <p className="mt-0.5 truncate text-xl font-bold text-foreground">
            {data.monthlyEarnings.toLocaleString('pl-PL')} zł
          </p>
        </div>
        <div className="px-5 py-4">
          <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Łącznie</p>
          <p className="mt-0.5 truncate text-xl font-bold text-foreground">
            {data.totalEarnings.toLocaleString('pl-PL')} zł
          </p>
        </div>
      </div>

      <div className="px-5 py-4">
        <div className="mb-3 flex items-center gap-1.5">
          <TrendingUp className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
          <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Ostatnie 6 miesięcy</p>
        </div>
        <div className="overflow-x-auto">
          <div className="flex items-end gap-2.5" role="img" aria-label="Wykres słupkowy miesięcznych zarobków">
            {data.earningsChart.map((entry) => {
              const heightPct = (entry.amount / maxEarnings) * 100
              const isCurrent = entry.month === currentMonth
              return (
                <div key={entry.month} className="flex w-9 shrink-0 flex-1 flex-col items-center gap-1.5">
                  <span className="text-[10px] font-semibold text-muted-foreground">
                    {(entry.amount / 1000).toFixed(1)}k
                  </span>
                  <div className="relative w-full rounded-t-md bg-muted" style={{ height: '72px' }}>
                    <div
                      className={cn(
                        'absolute bottom-0 w-full origin-bottom rounded-t-md transition-all duration-700 ease-out',
                        isCurrent ? 'bg-primary' : 'bg-border',
                      )}
                      style={{ height: `${heightPct}%` }}
                    />
                  </div>
                  <span className={cn('text-[10px]', isCurrent ? 'font-semibold text-foreground' : 'text-muted-foreground')}>
                    {entry.month}
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      <PanelFooterLink href="/wallet" icon={Wallet}>
        Portfel i wypłaty
      </PanelFooterLink>
    </Panel>
  )
}
