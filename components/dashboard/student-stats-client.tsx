'use client'

import Link from 'next/link'
import { BookOpen, Clock, Users, Star, ChevronRight } from 'lucide-react'
import { StatRow } from '@/components/dashboard/dashboard-primitives'
import type { StudentStats } from '@/lib/types'

interface Props {
  stats: StudentStats
}

/**
 * Learning totals, demoted from three full-width cards directly under
 * the page header — the most valuable strip of the dashboard — to one
 * compact row in the side rail. They are honest but passive numbers
 * (nothing to act on), so they no longer outrank the next lesson or a
 * pending report for attention.
 *
 * BeePoints is folded in as the row's only interactive element instead
 * of occupying a separate card, since it was the one part of that group
 * that actually led somewhere.
 *
 * Values are still the real computed ones (lesson count, hours,
 * distinct teachers); no fabricated deltas like "+3 w tym miesiącu",
 * because nothing tracks that yet.
 */
export function StudentStatsCards({ stats }: Props) {
  return (
    <section className="overflow-hidden rounded-2xl border border-border">
      <StatRow
        items={[
          { icon: BookOpen, label: 'Lekcje', value: stats.totalLessons },
          { icon: Clock, label: 'Godziny', value: stats.hoursLearned },
          { icon: Users, label: 'Nauczyciele', value: stats.teachersWorkedWith },
        ]}
      />

      <Link
        href="/beepoints"
        className="group flex items-center gap-2.5 border-t border-border bg-accent px-4 py-3 transition-colors hover:bg-accent/70"
      >
        <Star className="h-4 w-4 shrink-0 fill-primary stroke-none" aria-hidden="true" />
        <span className="text-sm font-bold text-accent-foreground">{stats.beePoints.toLocaleString('pl-PL')}</span>
        <span className="text-xs text-accent-foreground/70">BeePoints</span>
        <ChevronRight
          className="ml-auto h-4 w-4 shrink-0 text-accent-foreground/60 transition-transform group-hover:translate-x-0.5"
          aria-hidden="true"
        />
      </Link>
    </section>
  )
}
