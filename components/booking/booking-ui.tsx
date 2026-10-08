'use client'

import { useEffect, useState, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Info, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogBody, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import type { StudentPaymentBreakdown } from '@/lib/service-fees'
import type { BookingWizardStep } from '@/lib/booking-wizard-core'
import { cn } from '@/lib/utils'
import { pln, useBookingFlow } from './booking-flow-provider'

const SERVICE_FEE_INFO = 'Opłata serwisowa Runbee wynosi 3% wartości zakupu, minimum 2,99 zł. Jest naliczana jednorazowo przy zakupie i nie jest pobierana ponownie przy rezerwacji lekcji z wcześniej zakupionego pakietu.'

export function FeeInfoButton() {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Wyjaśnij opłatę serwisową"
        className="inline-flex h-5 w-5 items-center justify-center rounded-full text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60"
      >
        <Info className="h-3.5 w-3.5" aria-hidden="true" />
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Opłata serwisowa</DialogTitle></DialogHeader>
          <DialogBody><p className="text-sm leading-relaxed text-muted-foreground">{SERVICE_FEE_INFO}</p></DialogBody>
          <DialogFooter className="justify-end"><Button type="button" onClick={() => setOpen(false)} className="font-semibold">Rozumiem</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

export function PriceBreakdown({ payment, subtotalLabel = 'Cena lekcji' }: { payment: StudentPaymentBreakdown; subtotalLabel?: string }) {
  return (
    <dl className="space-y-2 text-sm">
      <div className="flex items-center justify-between gap-3">
        <dt className="text-muted-foreground">{subtotalLabel}</dt>
        <dd className="font-medium tabular-nums text-foreground">{pln(payment.subtotalGrosze)}</dd>
      </div>
      <div className="flex items-center justify-between gap-3">
        <dt className="flex items-center gap-1.5 text-muted-foreground">Opłata serwisowa <FeeInfoButton /></dt>
        <dd className="font-medium tabular-nums text-foreground">{pln(payment.studentServiceFeeGrosze)}</dd>
      </div>
      <div className="flex items-center justify-between gap-3 border-t border-border pt-3">
        <dt className="font-semibold text-foreground">Łącznie do zapłaty</dt>
        <dd className="text-lg font-bold tabular-nums text-foreground">{pln(payment.studentTotalGrosze)}</dd>
      </div>
    </dl>
  )
}

export function StepHeader({ title, description, aside }: { title: string; description: string; aside?: ReactNode }) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div>
        <h2 className="text-xl font-bold tracking-tight text-foreground sm:text-2xl">{title}</h2>
        <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{description}</p>
      </div>
      {aside}
    </div>
  )
}

export function Section({ title, children, className }: { title?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={cn('rounded-2xl border border-border bg-card/60 p-4 sm:p-5', className)}>
      {title ? <h3 className="mb-3 text-sm font-semibold text-foreground">{title}</h3> : null}
      {children}
    </section>
  )
}

export const optionCardClass = (active: boolean, extra?: string) => cn(
  'rounded-xl border px-3.5 py-2.5 text-left text-sm transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60 disabled:cursor-not-allowed disabled:opacity-50 motion-reduce:transition-none',
  active
    ? 'border-primary bg-primary/10 font-semibold text-foreground'
    : 'border-border bg-background/60 text-muted-foreground hover:border-primary/40 hover:text-foreground',
  extra,
)

export function StepSkeleton() {
  return (
    <div className="space-y-4" aria-busy="true" aria-label="Ładowanie">
      <div className="h-8 w-40 animate-pulse rounded-lg bg-muted" />
      <div className="h-40 animate-pulse rounded-2xl bg-muted/70" />
      <div className="h-40 animate-pulse rounded-2xl bg-muted/70" />
    </div>
  )
}

/**
 * Deep links / refresh / Back-Forward can never reach a step whose earlier
 * steps are incomplete: once data is loaded, redirect (replace, so Back
 * doesn't loop) to the first incomplete step. Returns true when this step
 * may render.
 */
export function useStepGuard(step: BookingWizardStep): boolean {
  const router = useRouter()
  const flow = useBookingFlow()
  const allowed = flow.guardedStep(step)
  const ok = flow.ready && allowed === step
  useEffect(() => {
    if (flow.ready && allowed !== step && !flow.completed) router.replace(flow.stepHref(allowed))
  }, [flow, allowed, step, router])
  return ok
}

export function StepFooter({
  step, onBack, onNext, nextLabel, nextDisabled, busy, hint,
}: {
  step: BookingWizardStep
  onBack?: () => void
  onNext: () => void
  nextLabel: string
  nextDisabled?: boolean
  busy?: boolean
  hint?: string
}) {
  return (
    <div className="mt-6 border-t border-border pt-5">
      {hint ? <p className="mb-3 text-sm text-muted-foreground sm:text-right">{hint}</p> : null}
      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
        {step > 1 && onBack ? (
          <Button type="button" variant="outline" onClick={onBack} disabled={busy} className="h-11 w-full px-5 font-semibold sm:w-auto">
            <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Wstecz
          </Button>
        ) : <span className="hidden sm:block" />}
        <Button type="button" onClick={onNext} disabled={nextDisabled || busy} className="h-11 w-full px-8 font-semibold sm:w-auto">
          {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : null}
          {nextLabel}
        </Button>
      </div>
    </div>
  )
}
