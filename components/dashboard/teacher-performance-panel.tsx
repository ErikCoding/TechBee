'use client'

import { useEffect, useState } from 'react'
import { CheckCircle2 } from 'lucide-react'
import { useAuth } from '@/lib/auth-context'
import { getTeacherDashboard } from '@/services/lessons.service'
import type { TeacherDashboardData } from '@/lib/types'

interface Props {
  initialData: TeacherDashboardData
}

/**
 * "Wyniki" sidebar panel. Rating and completion rate are real
 * (teacher's own Firestore application doc); response rate and the
 * lifetime lesson estimate stay demo — no real response-time or
 * full lesson-history tracking exists yet.
 */
export function TeacherPerformancePanel({ initialData }: Props) {
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

  const metrics = [
    { label: 'Wskaźnik odpowiedzi', value: `${data.responseRate}%` },
    { label: 'Wskaźnik ukończenia', value: `${data.completionRate}%` },
    { label: 'Śr. ocena', value: `${data.rating.toFixed(1)} / 5.0` },
    { label: 'Lekcje łącznie', value: data.lessonsThisMonth * 12 },
  ]

  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <h3 className="text-sm font-semibold text-foreground">Wyniki</h3>
      <div className="mt-4 flex flex-col gap-3">
        {metrics.map((metric) => (
          <div key={metric.label} className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">{metric.label}</span>
            <div className="flex items-center gap-1.5">
              <CheckCircle2 className="h-3 w-3 text-emerald-500" aria-hidden="true" />
              <span className="text-xs font-semibold text-foreground">{metric.value}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
