import { CheckCircle2, Clock3, AlertTriangle } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { Lesson } from '@/lib/types'

/** Shared status pill for an already-reported lesson — used on both the teacher and parent dashboards so the wording/colors stay consistent. */
export function ReportStatusBadge({ lesson }: { lesson: Lesson }) {
  let label: string
  let Icon: typeof CheckCircle2
  let className: string

  if (lesson.dispute) {
    if (lesson.dispute.status === 'open') {
      label = 'Spór w toku'
      Icon = AlertTriangle
      className = 'text-orange-600 bg-orange-500/10 dark:text-orange-400'
    } else {
      label = 'Spór rozstrzygnięty'
      Icon = CheckCircle2
      className = 'text-emerald-500 bg-emerald-500/10'
    }
  } else if (lesson.reportConfirmedAt) {
    label = 'Płatność zwolniona'
    Icon = CheckCircle2
    className = 'text-emerald-500 bg-emerald-500/10'
  } else {
    label = 'Oczekuje na potwierdzenie'
    Icon = Clock3
    className = 'text-yellow-600 bg-yellow-500/10 dark:text-yellow-400'
  }

  return (
    <span className={cn('flex shrink-0 items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium', className)}>
      <Icon className="h-3 w-3" aria-hidden="true" />
      {label}
    </span>
  )
}
