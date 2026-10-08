'use client'

import Link from 'next/link'
import { useSelectedLayoutSegment } from 'next/navigation'
import { Check } from 'lucide-react'
import { bookingStepFromSlug, type BookingWizardStep } from '@/lib/booking-wizard-core'
import { cn } from '@/lib/utils'
import { useBookingFlow } from './booking-flow-provider'

const STEPS: { step: BookingWizardStep; label: string }[] = [
  { step: 1, label: 'Termin' },
  { step: 2, label: 'Płatność' },
  { step: 3, label: 'Podsumowanie' },
]

export function BookingStepper() {
  const segment = useSelectedLayoutSegment()
  const { stepHref, completed } = useBookingFlow()
  const current = (segment && bookingStepFromSlug(segment)) || 1
  const progress = ((current - 1) / (STEPS.length - 1)) * 100

  return (
    <nav aria-label="Etapy rezerwacji" className="rounded-xl border border-border bg-card/70 px-3 py-2 sm:px-4">
      <ol className="flex items-center justify-between gap-1">
        {STEPS.map(({ step, label }) => {
          const done = step < current || Boolean(completed)
          const active = step === current && !completed
          const inner = (
            <>
              <span
                className={cn(
                  'flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-[11px] font-bold transition-colors duration-200 motion-reduce:transition-none',
                  active && 'border-primary bg-primary text-primary-foreground shadow-[0_0_0_4px_rgba(244,180,0,0.16)]',
                  done && 'border-primary/60 bg-primary/15 text-primary',
                  !active && !done && 'border-border bg-background text-muted-foreground',
                )}
              >
                {done ? <Check className="h-3 w-3" aria-hidden="true" /> : step}
              </span>
              <span className={cn('truncate text-[11px] font-semibold sm:text-xs', active ? 'text-foreground' : done ? 'text-foreground/80' : 'text-muted-foreground')}>
                {label}
              </span>
            </>
          )
          return (
            <li key={step} className="min-w-0 flex-1" aria-current={active ? 'step' : undefined}>
              {done && !completed && step < current ? (
                <Link href={stepHref(step)} className="flex items-center justify-center gap-1.5 rounded-lg py-1 hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60">{inner}</Link>
              ) : (
                <div className="flex items-center justify-center gap-1.5 py-1">{inner}</div>
              )}
            </li>
          )
        })}
      </ol>
      <div className="mt-1.5 h-0.5 overflow-hidden rounded-full bg-border" role="presentation">
        <div
          className="h-full rounded-full bg-primary transition-[width] duration-300 ease-out motion-reduce:transition-none"
          style={{ width: completed ? '100%' : `${Math.max(progress, 6)}%` }}
        />
      </div>
    </nav>
  )
}
