'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Users, Wallet, Activity, UserPlus, TrendingUp, TrendingDown, GraduationCap, ArrowRight } from 'lucide-react'
import { useAuth } from '@/lib/auth-context'
import { getAdminStats } from '@/services/admin.service'
import { AdminPendingSummary } from '@/components/admin/admin-pending-summary'
import { AdminPlatformWallet } from '@/components/admin/admin-platform-wallet'
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
  const [activeSeries, setActiveSeries] = useState<string[]>(['gross', 'commission'])
  const [hoveredMonth, setHoveredMonth] = useState<string | null>(null)

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

  const metricOptions = [
    { id: 'gross', label: 'Obrót', color: '#F4B400', value: (amount: number) => amount },
    { id: 'commission', label: 'Prowizja Runbee', color: '#10B981', value: (amount: number) => amount },
    { id: 'teacher', label: 'Wypłaty nauczycieli', color: '#3B82F6', value: (amount: number) => amount },
  ]
  const selectedMetrics = metricOptions.filter((metric) => activeSeries.includes(metric.id))
  const revenueRows = stats.revenueChart.map((entry) => ({
    month: entry.month,
    gross: entry.amount,
    commission: Math.round(entry.platformFee ?? entry.amount * 0.15),
    teacher: Math.round(entry.teacherAmount ?? entry.amount * 0.85),
  }))
  const revenueValues = revenueRows.flatMap((row) => selectedMetrics.map((metric) => row[metric.id as keyof typeof row] as number))
  const maxRevenue = Math.max(...revenueValues, 1)
  const minRevenue = Math.min(...revenueValues, 0)
  const chartWidth = 760
  const chartHeight = 300
  const padX = 54
  const padTop = 24
  const padBottom = 44
  const plotWidth = chartWidth - padX * 2
  const plotHeight = chartHeight - padTop - padBottom
  const valueSpan = Math.max(maxRevenue - minRevenue, 1)
  const xForIndex = (index: number) => padX + (revenueRows.length === 1 ? plotWidth / 2 : (index / (revenueRows.length - 1)) * plotWidth)
  const yForValue = (value: number) => padTop + ((maxRevenue - value) / valueSpan) * plotHeight
  const chartSeries = selectedMetrics.map((metric) => {
    const points = revenueRows.map((row, index) => {
      const value = row[metric.id as keyof typeof row] as number
      return { month: row.month, value, x: xForIndex(index), y: yForValue(value) }
    })
    return {
      ...metric,
      points,
      path: points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' '),
    }
  })
  const hoveredRow = revenueRows.find((row) => row.month === hoveredMonth) ?? revenueRows[revenueRows.length - 1]
  const latestRevenue = hoveredRow?.gross ?? 0

  function toggleSeries(id: string) {
    setActiveSeries((prev) => {
      if (prev.includes(id)) return prev.length === 1 ? prev : prev.filter((item) => item !== id)
      return [...prev, id]
    })
  }

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

      <AdminPlatformWallet />

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Revenue chart */}
        <section className="overflow-hidden rounded-2xl border border-border lg:col-span-2">
          <div className="flex flex-col gap-3 bg-muted/40 px-5 py-3.5 sm:flex-row sm:items-center sm:justify-between sm:px-6">
            <div>
              <h2 className="text-sm font-semibold text-foreground">Finanse platformy</h2>
              <p className="mt-0.5 text-xs text-muted-foreground">Ostatnie 6 miesięcy · obrót, prowizja i wypłaty</p>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-xl font-bold tabular-nums text-foreground">
                {latestRevenue.toLocaleString('pl-PL')} zł
              </span>
              <span className={stats.revenueChange >= 0 ? 'text-xs font-semibold text-success' : 'text-xs font-semibold text-destructive'}>
                {stats.revenueChange > 0 ? '+' : ''}{stats.revenueChange}%
              </span>
            </div>
          </div>

          <div className="bg-card px-4 py-4 sm:px-6">
            <div className="flex flex-wrap gap-2" aria-label="Metryki widoczne na wykresie">
              {metricOptions.map((metric) => {
                const active = activeSeries.includes(metric.id)
                return (
                  <button
                    key={metric.id}
                    type="button"
                    onClick={() => toggleSeries(metric.id)}
                    aria-pressed={active}
                    className={`inline-flex items-center gap-2 rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors ${
                      active ? 'border-primary bg-accent text-accent-foreground' : 'border-border text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: metric.color }} aria-hidden="true" />
                    {metric.label}
                  </button>
                )
              })}
            </div>

            <div className="mt-4 rounded-xl border border-border bg-background/40 p-3">
              <div className="mb-3 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <p className="text-xs font-semibold text-foreground">{hoveredRow?.month ?? 'Ostatni miesiąc'}</p>
                  <p className="text-[11px] text-muted-foreground">Najedź na punkt lub miesiąc, aby zobaczyć szczegóły.</p>
                </div>
                {hoveredRow && (
                  <div className="grid grid-cols-3 gap-2 text-right text-[11px]">
                    <div>
                      <p className="text-muted-foreground">Obrót</p>
                      <p className="font-semibold tabular-nums text-foreground">{hoveredRow.gross.toLocaleString('pl-PL')} zł</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Prowizja</p>
                      <p className="font-semibold tabular-nums text-foreground">{hoveredRow.commission.toLocaleString('pl-PL')} zł</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Wypłaty</p>
                      <p className="font-semibold tabular-nums text-foreground">{hoveredRow.teacher.toLocaleString('pl-PL')} zł</p>
                    </div>
                  </div>
                )}
              </div>

              <svg
                viewBox={`0 0 ${chartWidth} ${chartHeight}`}
                className="h-auto w-full overflow-visible"
                role="img"
                aria-label="Interaktywny wykres liniowy finansów platformy za ostatnie 6 miesięcy"
              >
              <defs>
                <filter id="chart-shadow" x="-10%" y="-20%" width="120%" height="150%">
                  <feDropShadow dx="0" dy="6" stdDeviation="6" floodOpacity="0.12" />
                </filter>
              </defs>
              {[0, 0.25, 0.5, 0.75, 1].map((ratio) => {
                const y = padTop + ratio * plotHeight
                const value = maxRevenue - ratio * valueSpan
                return (
                  <g key={ratio}>
                    <line x1={padX} x2={chartWidth - padX} y1={y} y2={y} stroke="var(--border)" strokeDasharray="4 6" />
                    <text x={padX - 12} y={y + 4} textAnchor="end" className="fill-muted-foreground text-[10px]">
                      {(value / 1000).toFixed(0)}k
                    </text>
                  </g>
                )
              })}

              {revenueRows.map((row, index) => {
                const x = xForIndex(index)
                const hovered = hoveredRow?.month === row.month
                return (
                  <g
                    key={row.month}
                    onMouseEnter={() => setHoveredMonth(row.month)}
                    onFocus={() => setHoveredMonth(row.month)}
                    tabIndex={0}
                  >
                    <rect
                      x={x - plotWidth / Math.max(revenueRows.length - 1, 1) / 2}
                      y={0}
                      width={plotWidth / Math.max(revenueRows.length - 1, 1)}
                      height={chartHeight}
                      fill="transparent"
                    />
                    <line
                      x1={x}
                      x2={x}
                      y1={padTop}
                      y2={chartHeight - padBottom}
                      stroke={hovered ? 'var(--muted-foreground)' : 'transparent'}
                      strokeDasharray="4 6"
                    />
                    <line x1={x} x2={x} y1={chartHeight - padBottom} y2={chartHeight - padBottom + 5} stroke="var(--border)" />
                    <text x={x} y={chartHeight - 14} textAnchor="middle" className="fill-muted-foreground text-[11px]">
                      {row.month}
                    </text>
                  </g>
                )
              })}

              {chartSeries.map((series) => (
                <g key={series.id} filter="url(#chart-shadow)">
                  <path
                    d={series.path}
                    fill="none"
                    stroke={series.color}
                    strokeWidth="4"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </g>
              ))}

              {chartSeries.map((series) => (
                <g key={`${series.id}-points`}>
                  {series.points.map((point) => {
                    const hovered = hoveredRow?.month === point.month
                    return (
                      <circle
                        key={`${series.id}-${point.month}`}
                        cx={point.x}
                        cy={point.y}
                        r={hovered ? 6 : 4.5}
                        fill="var(--card)"
                        stroke={series.color}
                        strokeWidth="3"
                        onMouseEnter={() => setHoveredMonth(point.month)}
                        onFocus={() => setHoveredMonth(point.month)}
                        tabIndex={0}
                      >
                        <title>{`${series.label}: ${point.value.toLocaleString('pl-PL')} zł (${point.month})`}</title>
                      </circle>
                    )
                  })}
                </g>
              ))}

              </svg>
            </div>
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
