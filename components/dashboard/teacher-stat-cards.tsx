'use client'

import { useEffect, useState } from 'react'
import { DollarSign, BookOpen, Users, TrendingUp } from 'lucide-react'
import { useAuth } from '@/lib/auth-context'
import { getTeacherDashboard } from '@/services/lessons.service'
import type { TeacherDashboardData } from '@/lib/types'

interface Props {
  initialData: TeacherDashboardData
}

/**
 * Top stat row. "Ukończenie" (completionRate) is real, pulled from the
 * teacher's own Firestore application doc — the other three
 * (earnings, lesson/student counts) stay demo since there's no real
 * payment processing or per-lesson attendance tracking yet.
 */
export function TeacherStatCards({ initialData }: Props) {
  const { user } = useAuth()
  const [data, setData] = useState(initialData)

  useEffect(() => {
    if (!user || user.role !== 'teacher') return
    let cancelled = false
    getTeacherDashboard(user.name, user.id).then((fresh) => {
      if (!cancelled) setData(fresh)
    })
    return () => {
      cancelled = true
    }
  }, [user])

  const cards = [
    { icon: DollarSign, label: 'Ten miesiąc', value: `${data.monthlyEarnings.toLocaleString('pl-PL')} zł`, sub: 'Przychód brutto' },
    { icon: BookOpen, label: 'Lekcje', value: data.lessonsThisMonth, sub: 'W tym miesiącu' },
    { icon: Users, label: 'Uczniowie', value: data.studentsThisMonth, sub: 'Aktywni w tym miesiącu' },
    { icon: TrendingUp, label: 'Ukończenie', value: `${data.completionRate}%`, sub: 'Wynik łączny' },
  ]

  return (
    <div className="mt-6 grid grid-cols-2 gap-4 md:grid-cols-4">
      {cards.map((card, i) => {
        const Icon = card.icon
        return (
          <div key={card.label} className="animate-fade-in-up rounded-2xl border border-border bg-card p-5" style={{ animationDelay: `${i * 60}ms` }}>
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-muted">
              <Icon className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
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
