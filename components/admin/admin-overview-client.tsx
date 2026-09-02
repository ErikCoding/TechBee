'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Users, Wallet, Activity, UserPlus, TrendingUp, TrendingDown, GraduationCap, ArrowRight } from 'lucide-react'
import { useAuth } from '@/lib/auth-context'
import { getAdminStats } from '@/services/admin.service'
import { AdminPendingSummary } from '@/components/admin/admin-pending-summary'
import { cn } from '@/lib/utils'
import type { AdminStats } from '@/lib/types'

interface Props {
  initialStats: AdminStats
}

/**
 * Starts from the server-rendered demo baseline (SSR has no signed-in
 * admin context to query Firestore with) and re-fetches real aggregate
 * stats — user counts, role breakdown, weekly signups, pending
 * verifications — once the admin is authenticated client-side. Revenue
 * figures stay the demo baseline throughout (no real payments yet).
 */
export function AdminOverviewClient({ initialStats }: Props) {
  const { user } = useAuth()
  const [stats, setStats] = useState(initialStats)

  useEffect(() => {
    if (!user || user.role !== 'admin') return
    let cancelled = false
    getAdminStats().then((fresh) => {
      if (!cancelled) setStats(fresh)
    })
    return () => {
      cancelled = true
    }
  }, [user])

  const maxRevenue = Math.max(...stats.revenueChart.map((r) => r.amount))
  const maxRole = Math.max(...stats.usersByRole.map((r) => r.count), 1)

  const cards = [
    { icon: Users, label: 'Użytkownicy łącznie', value: stats.totalUsers.toLocaleString('pl-PL'), sub: `${stats.totalTeachers} nauczycieli · ${stats.totalStudents.toLocaleString('pl-PL')} uczniów` },
    { icon: Wallet, label: 'Przychód (miesiąc)', value: `${stats.monthlyRevenue.toLocaleString('pl-PL')} zł`, sub: `${stats.revenueChange > 0 ? '+' : ''}${stats.revenueChange}% vs poprzedni miesiąc`, trend: stats.revenueChange >= 0 },
    { icon: Activity, label: 'Aktywne lekcje dziś', value: stats.activeLessonsToday, sub: 'Na żywo w tej chwili' },
    { icon: UserPlus, label: 'Nowe rejestracje', value: stats.newSignupsThisWeek, sub: 'W tym tygodniu' },
  ]

  return (
    <div className="flex flex-col gap-6">
      {/* Analytics cards */}
      <div className="grid grid-cols-1 divide-y divide-border overflow-hidden rounded-2xl border border-border sm:grid-cols-2 sm:divide-x sm:divide-y-0 xl:grid-cols-4">
        {cards.map((card) => {
          const Icon = card.icon
          return (
            <div key={card.label} className="flex items-start gap-3 bg-card p-5">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-accent">
                <Icon className="h-4 w-4 text-bee-yellow-dark" aria-hidden="true" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <p className="text-xl font-bold text-foreground">{card.value}</p>
                  {'trend' in card && (
                    card.trend ? <TrendingUp className="h-3.5 w-3.5 shrink-0 text-success" /> : <TrendingDown className="h-3.5 w-3.5 shrink-0 text-destructive" />
                  )}
                </div>
                <p className="truncate text-xs font-medium text-foreground">{card.label}</p>
                <p className="mt-0.5 truncate text-[11px] text-muted-foreground">{card.sub}</p>
              </div>
            </div>
          )
        })}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <AdminPendingSummary />
        <Link
          href="/admin/teachers"
          className="flex items-center justify-between rounded-2xl border border-border bg-card p-6 transition-colors hover:bg-muted/40"
        >
          <div className="flex items-center gap-3">
            <GraduationCap className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
            <div>
              <p className="text-sm font-semibold text-foreground">Zarządzaj giełdą nauczycieli</p>
              <p className="text-xs text-muted-foreground">Wszystkie profile, wyróżnienia i usuwanie</p>
            </div>
          </div>
          <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
        </Link>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Revenue chart */}
        <section className="overflow-hidden rounded-2xl border border-border lg:col-span-2">
          <div className="bg-muted/40 px-6 py-3.5">
            <h2 className="text-sm font-semibold text-foreground">Przychód platformy</h2>
            <p className="mt-0.5 text-xs text-muted-foreground">Dane demonstracyjne — bez połączenia z prawdziwymi płatnościami</p>
          </div>
          <div className="flex items-end gap-3 bg-card p-6" role="img" aria-label="Wykres słupkowy przychodu platformy">
            {stats.revenueChart.map((entry) => {
              const heightPct = (entry.amount / maxRevenue) * 100
              return (
                <div key={entry.month} className="flex flex-1 flex-col items-center gap-2">
                  <span className="text-[10px] font-semibold text-muted-foreground">{(entry.amount / 1000).toFixed(0)}k zł</span>
                  <div className="relative w-full rounded-t-lg bg-muted" style={{ height: '120px' }}>
                    <div
                      className={cn(
                        'absolute bottom-0 w-full rounded-t-lg transition-all duration-700 ease-out',
                        entry.month === 'Lip' ? 'bg-primary' : 'bg-border',
                      )}
                      style={{ height: `${heightPct}%` }}
                    />
                  </div>
                  <span className="text-[10px] text-muted-foreground">{entry.month}</span>
                </div>
              )
            })}
          </div>
        </section>

        {/* Users by role */}
        <section className="overflow-hidden rounded-2xl border border-border">
          <div className="bg-muted/40 px-6 py-3.5">
            <h2 className="text-sm font-semibold text-foreground">Użytkownicy wg roli</h2>
          </div>
          <div className="flex flex-col gap-3 bg-card p-6">
            {stats.usersByRole.map((r) => (
              <div key={r.role}>
                <div className="mb-1 flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">{r.role}</span>
                  <span className="font-semibold text-foreground">{r.count.toLocaleString('pl-PL')}</span>
                </div>
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full transition-all duration-700 ease-out"
                    style={{ width: `${(r.count / maxRole) * 100}%`, background: r.color }}
                  />
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  )
}
