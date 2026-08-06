'use client'

import { useEffect, useState } from 'react'
import { BookOpen, Clock, Users } from 'lucide-react'
import { useAuth } from '@/lib/auth-context'
import { getStudentStats } from '@/services/lessons.service'
import type { StudentStats } from '@/lib/types'

interface Props {
  initialStats: StudentStats
}

/**
 * The three real, computed stat cards (lesson count, hours learned,
 * teachers worked with) — starts from the server-fetched demo
 * baseline and re-fetches scoped to the real signed-in student once
 * known client-side. No fabricated deltas ("+3 this month") since
 * there's nothing tracking that yet — honest current totals only.
 */
export function StudentStatsCards({ initialStats }: Props) {
  const { user } = useAuth()
  const [stats, setStats] = useState(initialStats)

  useEffect(() => {
    if (!user) return
    let cancelled = false
    getStudentStats(user.id).then((fresh) => {
      if (!cancelled) setStats(fresh)
    })
    return () => {
      cancelled = true
    }
  }, [user])

  const cards = [
    { icon: BookOpen, label: 'Lekcje łącznie', value: stats.totalLessons, sub: 'Zarezerwowane dotychczas' },
    { icon: Clock, label: 'Godziny nauki', value: stats.hoursLearned, sub: 'Łączny czas lekcji' },
    { icon: Users, label: 'Nauczyciele', value: stats.teachersWorkedWith, sub: 'Różnych nauczycieli' },
  ]

  return (
    <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
      {cards.map((card, i) => {
        const Icon = card.icon
        return (
          <div key={card.label} className="animate-fade-in-up rounded-2xl border border-border bg-card p-5 transition-shadow hover:shadow-sm" style={{ animationDelay: `${i * 60}ms` }}>
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#FEF3C7] dark:bg-[#3B2800]">
              <Icon className="h-4 w-4 text-[#B45309] dark:text-[#FBBF24]" aria-hidden="true" />
            </div>
            <p className="mt-3 text-2xl font-bold text-foreground">{card.value}</p>
            <p className="text-xs font-medium text-foreground">{card.label}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">{card.sub}</p>
          </div>
        )
      })}
    </div>
  )
}
