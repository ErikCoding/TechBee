'use client'

import { Wallet, Receipt, CheckCircle2, Clock3 } from 'lucide-react'
import { Panel } from '@/components/dashboard/dashboard-primitives'
import { EmptyState } from '@/components/ui/empty-state'
import { Skeleton } from '@/components/ui/skeleton'
import type { Lesson } from '@/lib/types'

interface Props {
  /** Lessons this parent personally paid for — `getParentLessons`, i.e. `payerId == parentId`. */
  paidLessons: Lesson[] | null
}

/**
 * What the parent has actually spent.
 *
 * `getParentLessons` (lessons where the parent is the payer) already
 * existed in the service layer and was fetched nowhere — the parent
 * dashboard showed no payment information at all, even though paying on
 * a child's behalf is one of the two things a parent account is for.
 * This surfaces it: total committed, how much is still held pending a
 * report confirmation, and the most recent charges.
 *
 * Figures are summed from the same Lesson docs the rest of the dashboard
 * reads. `paymentReleased` is the existing flag meaning the money has
 * moved on to the teacher; anything completed without it is still held.
 * No new totals are computed anywhere in the backend.
 */
export function ParentSpendingPanel({ paidLessons }: Props) {
  if (paidLessons === null) {
    return (
      <Panel icon={Wallet} title="Płatności">
        <div className="flex flex-col gap-3 p-5">
          <Skeleton className="h-8 w-1/2" />
          <Skeleton className="h-3 w-3/4" />
        </div>
      </Panel>
    )
  }

  const active = paidLessons.filter((l) => l.status !== 'cancelled')
  const total = active.reduce((sum, l) => sum + l.price, 0)
  const held = active.filter((l) => !l.paymentReleased && l.status !== 'cancelled')
  const heldAmount = held.reduce((sum, l) => sum + l.price, 0)
  const recent = [...active]
    .sort((a, b) => (b.completedAt ?? b.createdAt ?? 0) - (a.completedAt ?? a.createdAt ?? 0))
    .slice(0, 3)

  return (
    <Panel icon={Wallet} title="Płatności">
      {active.length === 0 ? (
        <EmptyState
          icon={Receipt}
          title="Brak płatności"
          description="Lekcje opłacone przez Ciebie pojawią się tutaj."
          className="py-8"
        />
      ) : (
        <>
          <div className="grid grid-cols-2 divide-x divide-border border-b border-border">
            <div className="px-5 py-4">
              <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Opłacone łącznie</p>
              <p className="mt-0.5 truncate text-xl font-bold text-foreground">{total.toLocaleString('pl-PL')} zł</p>
            </div>
            <div className="px-5 py-4">
              <p className="text-[11px] uppercase tracking-wide text-muted-foreground">W trakcie</p>
              <p className="mt-0.5 truncate text-xl font-bold text-foreground">{heldAmount.toLocaleString('pl-PL')} zł</p>
            </div>
          </div>

          <ul className="flex flex-col divide-y divide-border">
            {recent.map((lesson) => (
              <li key={lesson.id} className="flex items-center gap-3 px-5 py-3">
                <span
                  className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${
                    lesson.paymentReleased ? 'bg-success-surface text-success-on-surface' : 'bg-muted text-muted-foreground'
                  }`}
                >
                  {lesson.paymentReleased ? (
                    <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
                  ) : (
                    <Clock3 className="h-3.5 w-3.5" aria-hidden="true" />
                  )}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-medium text-foreground">{lesson.topic}</p>
                  <p className="truncate text-[11px] text-muted-foreground">
                    {lesson.studentName} · {lesson.teacherName}
                  </p>
                </div>
                <span className="shrink-0 text-xs font-semibold text-foreground">{lesson.price} zł</span>
              </li>
            ))}
          </ul>

          {heldAmount > 0 && (
            <p className="border-t border-border px-5 py-2.5 text-[11px] text-muted-foreground">
              Środki „w trakcie" trafiają do nauczyciela po potwierdzeniu raportu z lekcji.
            </p>
          )}
        </>
      )}
    </Panel>
  )
}
