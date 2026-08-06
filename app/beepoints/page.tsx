import { Sprout, Award, Star, Crown, ArrowUpRight, ArrowDownLeft } from 'lucide-react'
import { Navbar } from '@/components/layout/navbar'
import { Footer } from '@/components/layout/footer'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { getBeePointsEvents, getBeePointsRules, getBeePointsStats, getBeePointsTiers } from '@/services/beepoints.service'
import { RequireAuth } from '@/components/auth/require-auth'
import { BeePointsRules } from '@/components/beepoints/beepoints-rules'
import { BackButton } from '@/components/shared/back-button'
import { cn } from '@/lib/utils'

const tierIconMap: Record<string, React.ElementType> = {
  Sprout, Award, Star, Crown,
}

export default async function BeePointsPage() {
  const [beePointsTiers, beePointsEvents, beePointsStats, beePointsRules] = await Promise.all([
    getBeePointsTiers(),
    getBeePointsEvents(),
    getBeePointsStats(),
    getBeePointsRules(),
  ])

  const currentTierData = beePointsTiers.find((t) => t.name === beePointsStats.currentTier)!
  const nextTierData = beePointsTiers.find((t) => t.name === beePointsStats.nextTier)!
  const progressToNext = Math.round(
    ((beePointsStats.currentPoints - currentTierData.minPoints) /
      (nextTierData.minPoints - currentTierData.minPoints)) * 100,
  )
  const CurrentTierIcon = tierIconMap[currentTierData.icon]

  return (
    <>
      <Navbar />
      <main id="main-content" className="bg-background">
        <RequireAuth>
        <div className="mx-auto max-w-4xl px-4 py-8 md:px-8">
          <BackButton />
          <h1 className="text-2xl font-bold text-foreground">BeePoints</h1>
          <p className="mt-0.5 text-muted-foreground">
            Zdobywaj punkty, odblokowuj nagrody i awansuj na kolejne poziomy
          </p>

          {/* Current status hero */}
          <div className="animate-fade-in-up mt-6 overflow-hidden rounded-3xl border border-[#F4B400]/30 bg-[#FEF3C7] p-7 dark:bg-[#3B2800]">
            <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <span className={cn('inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-bold', currentTierData.badgeClass)}>
                    <CurrentTierIcon className="h-3.5 w-3.5" aria-hidden="true" />
                    {currentTierData.name} Bee
                  </span>
                </div>
                <p className="mt-3 text-5xl font-bold tracking-tight text-[#78350F] dark:text-[#FBBF24]">
                  {beePointsStats.currentPoints.toLocaleString('pl-PL')}
                </p>
                <p className="mt-0.5 text-sm text-[#92400E] dark:text-[#FCD34D]">Dostępne BeePoints</p>
              </div>
              <div className="w-full sm:w-56">
                <div className="flex items-center justify-between text-xs text-[#92400E] dark:text-[#FCD34D]">
                  <span>{currentTierData.name}</span>
                  <span>{nextTierData.name}</span>
                </div>
                <Progress value={progressToNext} className="mt-1.5 h-2" />
                <p className="mt-1 text-xs text-[#92400E] dark:text-[#FCD34D]">
                  <span className="font-semibold">{beePointsStats.pointsToNextTier} pkt</span> do poziomu {nextTierData.name}
                </p>
              </div>
            </div>
          </div>

          {/* Rules */}
          <BeePointsRules earning={beePointsRules.earning} redemption={beePointsRules.redemption} />

          {/* Tier cards */}
          <div className="mt-8">
            <h2 className="mb-4 font-semibold text-foreground">Poziomy i korzyści</h2>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {beePointsTiers.map((tier, i) => {
                const TierIcon = tierIconMap[tier.icon]
                const isActive = tier.name === beePointsStats.currentTier
                return (
                  <div
                    key={tier.name}
                    className={cn(
                      'animate-fade-in-up rounded-2xl border bg-card p-5 transition-all hover:-translate-y-0.5 hover:shadow-md',
                      isActive
                        ? 'border-[#F4B400] ring-1 ring-[#F4B400]/40'
                        : 'border-border',
                    )}
                    style={{ animationDelay: `${i * 70}ms` }}
                  >
                    <div className="flex items-center justify-between">
                      <span className={cn('inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold', tier.badgeClass)}>
                        <TierIcon className="h-3 w-3" aria-hidden="true" />
                        {tier.name}
                      </span>
                      {isActive && (
                        <Badge className="bg-[#F4B400] text-[#0A0A0A] text-[10px]">Aktualny</Badge>
                      )}
                    </div>
                    <p className="mt-2.5 text-xs text-muted-foreground">
                      {tier.minPoints === 0
                        ? `0 – ${tier.maxPoints.toLocaleString('pl-PL')} pkt`
                        : tier.maxPoints === Infinity
                        ? `${tier.minPoints.toLocaleString('pl-PL')}+ pkt`
                        : `${tier.minPoints.toLocaleString('pl-PL')} – ${tier.maxPoints.toLocaleString('pl-PL')} pkt`}
                    </p>
                    <ul className="mt-3 flex flex-col gap-1.5">
                      {tier.benefits.map((b) => (
                        <li key={b} className="flex items-start gap-1.5 text-xs text-muted-foreground">
                          <span className="mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[#F4B400]" aria-hidden="true" />
                          {b}
                        </li>
                      ))}
                    </ul>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Events history */}
          <div className="mt-8">
            <h2 className="mb-4 font-semibold text-foreground">Aktywność punktów</h2>
            <div className="flex flex-col divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card">
              {beePointsEvents.map((event) => (
                <div key={event.id} className="flex items-center gap-4 px-5 py-4 transition-colors hover:bg-muted/40">
                  <div
                    className={cn(
                      'flex h-9 w-9 shrink-0 items-center justify-center rounded-xl',
                      event.type === 'earned' ? 'bg-[#FEF3C7] dark:bg-[#3B2800]' : 'bg-muted',
                    )}
                  >
                    {event.type === 'earned' ? (
                      <ArrowDownLeft className="h-4 w-4 text-[#B45309] dark:text-[#FBBF24]" aria-hidden="true" />
                    ) : (
                      <ArrowUpRight className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-foreground">{event.description}</p>
                    <p className="text-xs text-muted-foreground">{event.date}</p>
                  </div>
                  <span
                    className={cn(
                      'text-sm font-bold',
                      event.type === 'earned' ? 'text-[#F4B400]' : 'text-muted-foreground',
                    )}
                  >
                    {event.points > 0 ? '+' : ''}{event.points.toLocaleString('pl-PL')} pkt
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
        </RequireAuth>
      </main>
      <Footer />
    </>
  )
}
