import {
  GraduationCap, Star, Sparkles, UserCheck, Flame, Users,
  Wallet, Ticket, Gift, Crown, type LucideIcon,
} from 'lucide-react'
import type { BeePointsRule } from '@/lib/types'

const iconMap: Record<string, LucideIcon> = {
  GraduationCap, Star, Sparkles, UserCheck, Flame, Users, Wallet, Ticket, Gift, Crown,
}

interface BeePointsRulesProps {
  earning: BeePointsRule[]
  redemption: BeePointsRule[]
}

function RuleCard({ rule, index }: { rule: BeePointsRule; index: number }) {
  const Icon = iconMap[rule.icon] ?? Star
  return (
    <div
      className="animate-fade-in-up flex gap-3 rounded-xl border border-border bg-card p-4 transition-shadow hover:shadow-sm"
      style={{ animationDelay: `${index * 50}ms` }}
    >
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-accent">
        <Icon className="h-4 w-4 text-bee-yellow-dark" aria-hidden="true" />
      </div>
      <div className="min-w-0">
        <div className="flex flex-wrap items-baseline gap-x-2">
          <p className="text-sm font-semibold text-foreground">{rule.title}</p>
          <span className="text-xs font-bold text-primary">{rule.points}</span>
        </div>
        <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{rule.description}</p>
      </div>
    </div>
  )
}

export function BeePointsRules({ earning, redemption }: BeePointsRulesProps) {
  return (
    <div className="mt-8">
      <h2 className="font-semibold text-foreground">Jak działają BeePoints</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Proste zasady: zdobywaj punkty za naukę i aktywność, wydawaj je na zniżki i darmowe lekcje. Punkty nie
        wygasają, dopóki Twoje konto jest aktywne, i naliczają się wyłącznie za ukończone (nieodwołane) lekcje.
      </p>
      <div className="mt-5 grid gap-6 lg:grid-cols-2">
        <div>
          <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Zdobywanie punktów</h3>
          <div className="flex flex-col gap-2.5">
            {earning.map((rule, i) => (
              <RuleCard key={rule.title} rule={rule} index={i} />
            ))}
          </div>
        </div>
        <div>
          <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Wykorzystywanie punktów</h3>
          <div className="flex flex-col gap-2.5">
            {redemption.map((rule, i) => (
              <RuleCard key={rule.title} rule={rule} index={i} />
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
