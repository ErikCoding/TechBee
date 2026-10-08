'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowLeft, CheckCircle2, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { bookingCtaLabel } from '@/lib/booking-wizard-core'
import { useAuth } from '@/lib/auth-context'
import { isFirebaseConfigured } from '@/lib/firebase'
import { dashboardPathForRole } from '@/lib/utils'
import { useBookingFlow } from './booking-flow-provider'
import { PriceBreakdown, Section, StepHeader, StepSkeleton, useStepGuard } from './booking-ui'

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4 py-2 text-sm">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="text-right font-semibold text-foreground">{value}</dd>
    </div>
  )
}

export function StepPodsumowanie() {
  const router = useRouter()
  const { user } = useAuth()
  const flow = useBookingFlow()
  const allowed = useStepGuard(3)

  if (flow.completed) {
    const { teacher, bookingFor, completed, selectedDay, selections: s } = flow
    return (
      <div className="rounded-2xl border border-success/30 bg-success-surface p-8 text-center">
        <CheckCircle2 className="mx-auto h-10 w-10 text-success-on-surface" aria-hidden="true" />
        <h2 className="mt-3 text-lg font-semibold text-foreground">Prośba o rezerwację wysłana!</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {completed.count > 1 ? `${completed.count} lekcje co tydzień od ` : ''}{selectedDay?.dayLabel} o {s.slot} z {teacher.name} · {flow.selectedSubject.name}
          {bookingFor ? ` · dla ${bookingFor.name}` : ''}
        </p>
        <p className="mt-1 text-xs text-muted-foreground">Lekcja pojawi się w panelu, gdy {teacher.name} potwierdzi termin.</p>
        <div className="mt-6 flex flex-col justify-center gap-2 sm:flex-row">
          <Button onClick={() => router.push(dashboardPathForRole(user?.role))} className="font-semibold">Przejdź do panelu</Button>
          <Link href={`/teacher/${teacher.id}`}><Button variant="outline">Wróć do profilu nauczyciela</Button></Link>
        </div>
      </div>
    )
  }

  if (!allowed) return <StepSkeleton />

  const { selections: s, teacher, selectedSubject, selectedDay, bookingDuration, summaryKind, matchingPackage, recurringCount, singlePayment, packagePayment } = flow
  const isPackageBuy = summaryKind === 'package_only' || summaryKind === 'package_and_book'
  const kindLabel = s.lessonKind === 'trial' ? 'Lekcja próbna' : 'Lekcja standardowa'
  const purchaseLabel = summaryKind === 'existing_package' ? 'Lekcja z posiadanego pakietu'
    : summaryKind === 'package_only' ? `Pakiet ${s.packageSize} lekcji (bez terminu)`
    : summaryKind === 'package_and_book' ? `Pakiet ${s.packageSize} lekcji + pierwsza lekcja`
    : 'Pojedyncza lekcja'
  const cta = isFirebaseConfigured ? bookingCtaLabel(summaryKind) : 'Wyślij prośbę o rezerwację'
  const canSubmit = Boolean(user) && !flow.submitting && flow.stepValid(1) && flow.stepValid(2)

  return (
    <div>
      <StepHeader title="Podsumowanie" description="Sprawdź szczegóły. Płatność lub rezerwacja rozpocznie się dopiero po kliknięciu przycisku po prawej." />

      <div className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-start">
        <div className="space-y-5">
          <Section title="Szczegóły rezerwacji">
            <dl className="divide-y divide-border">
              <Row label="Nauczyciel" value={teacher.name} />
              <Row label="Przedmiot" value={selectedSubject.name} />
              <Row label="Lekcja" value={`${kindLabel} · ${bookingDuration} min`} />
              <Row
                label="Termin"
                value={summaryKind === 'package_only' ? 'Brak — terminy wybierzesz później' : `${selectedDay?.dayLabel} · ${s.slot}${recurringCount > 1 ? ` (+${recurringCount - 1} co tydzień)` : ''}`}
              />
              {summaryKind !== 'package_only' && s.topic.trim() ? <Row label="Temat" value={s.topic.trim()} /> : null}
              <Row label="Sposób płatności" value={purchaseLabel} />
            </dl>
          </Section>
          <Button type="button" variant="outline" onClick={() => router.push(flow.stepHref(2))} disabled={flow.submitting} className="h-11 w-full px-5 font-semibold sm:w-auto">
            <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Wstecz
          </Button>
        </div>

        <aside className="rounded-2xl border border-border bg-card p-4 sm:p-5 lg:sticky lg:top-24">
          <h3 className="mb-3 text-sm font-semibold text-foreground">Cena</h3>
          {summaryKind === 'existing_package' && matchingPackage ? (
            <div className="rounded-xl border border-primary/30 bg-primary/10 p-4">
              <p className="text-xl font-bold text-foreground">Z pakietu</p>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                Bez płatności Stripe i bez nowej opłaty serwisowej. Po rezerwacji zostanie {matchingPackage.remainingCredits - recurringCount}/{matchingPackage.packageSize} lekcji ({recurringCount} zarezerwowane).
              </p>
            </div>
          ) : (
            <PriceBreakdown payment={isPackageBuy ? packagePayment : singlePayment} subtotalLabel={isPackageBuy ? `Pakiet ${s.packageSize} lekcji` : 'Cena lekcji'} />
          )}
          {isPackageBuy && (
            <p className="mt-4 text-xs leading-relaxed text-muted-foreground">
              {summaryKind === 'package_only'
                ? `Kupujesz sam pakiet — żaden termin nie jest rezerwowany. Pakiet pojawi się w panelu z pełną pulą ${s.packageSize}/${s.packageSize} lekcji.`
                : `Termin zostanie zarezerwowany tylko, jeśli nadal będzie wolny, a ${teacher.name} musi go zaakceptować. W przeciwnym razie zachowasz pełne ${s.packageSize}/${s.packageSize} lekcji.`}
            </p>
          )}
          <Button type="button" onClick={() => void flow.confirm()} disabled={!canSubmit} className="mt-5 h-11 w-full font-semibold">
            {flow.submitting ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : null}
            {cta}
          </Button>
          <p className="mt-3 text-center text-xs text-muted-foreground">Nic nie zostanie pobrane przed kliknięciem.</p>
        </aside>
      </div>
    </div>
  )
}
