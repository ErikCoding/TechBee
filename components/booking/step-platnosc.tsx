'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { CreditCard, Info, Layers, PackageCheck, Ticket, type LucideIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogBody, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { buildStudentPaymentBreakdown } from '@/lib/service-fees'
import { cn } from '@/lib/utils'
import { pln, useBookingFlow } from './booking-flow-provider'
import { Section, StepFooter, StepHeader, StepSkeleton, optionCardClass, useStepGuard } from './booking-ui'

function remainingLessonsText(count: number): string {
  if (count === 1) return '1 lekcja pozostała'
  if (count >= 2 && count <= 4) return `${count} lekcje pozostały`
  return `${count} lekcji pozostało`
}

function PaymentTile({ icon: Icon, title, lines, active, disabled, onClick }: {
  icon: LucideIcon; title: string; lines: string[]; active: boolean; disabled?: boolean; onClick: () => void
}) {
  return (
    <button type="button" disabled={disabled} aria-pressed={active} onClick={onClick}
      className={optionCardClass(active, 'group relative flex min-h-32 flex-col items-start gap-3 rounded-2xl p-4')}>
      <span className="flex w-full items-start justify-between">
        <span className={cn('flex h-9 w-9 items-center justify-center rounded-xl', active ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground')}>
          <Icon className="h-4 w-4" aria-hidden="true" />
        </span>
        <span className={cn('flex h-5 w-5 items-center justify-center rounded-full border-2', active ? 'border-primary' : 'border-border')} aria-hidden="true">
          {active && <span className="h-2.5 w-2.5 rounded-full bg-primary" />}
        </span>
      </span>
      <span className="space-y-1">
        <span className="block text-sm font-semibold text-foreground">{title}</span>
        {lines.map((line, i) => (
          <span key={line} className={cn('block text-xs leading-relaxed', i === 0 ? 'text-muted-foreground' : 'text-muted-foreground/80')}>{line}</span>
        ))}
      </span>
    </button>
  )
}

function PackageInfoDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Jak działają pakiety?</DialogTitle>
          <DialogDescription>Najważniejsze zasady rezerwacji z pakietu lekcji.</DialogDescription>
        </DialogHeader>
        <DialogBody>
          <p className="text-sm leading-relaxed text-muted-foreground">Pakiet pozwala opłacić z góry 5 lub 10 lekcji u wybranego nauczyciela.</p>
          <ul className="space-y-2 text-sm leading-relaxed text-muted-foreground">
            <li>• Pakiet jest przypisany do konkretnego nauczyciela, przedmiotu i długości lekcji.</li>
            <li>• Przy kolejnej rezerwacji wybierz „Wykorzystaj posiadany pakiet” — nie płacisz ponownie za lekcję.</li>
            <li>• Liczbę pozostałych lekcji sprawdzisz w sekcji „Moje pakiety” w swoim panelu.</li>
          </ul>
          <div className="rounded-xl border border-border bg-muted/30 p-3">
            <p className="text-xs font-semibold text-foreground">Anulowanie</p>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">Jeśli nauczyciel odrzuci prośbę o rezerwację lub zaakceptowane zostanie odwołanie kwalifikującej się lekcji, niewykorzystana lekcja wróci do Twojego pakietu.</p>
          </div>
        </DialogBody>
        <DialogFooter className="justify-end"><Button type="button" onClick={() => onOpenChange(false)} className="font-semibold">Rozumiem</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export function StepPlatnosc() {
  const router = useRouter()
  const flow = useBookingFlow()
  const allowed = useStepGuard(2)
  const [infoOpen, setInfoOpen] = useState(false)
  if (!allowed) return <StepSkeleton />

  const { selections: s, update, matchingPackage, matchingPackages, canBuyPackages, offeredPackageSizes, singlePayment, lessonSubtotalGrosze, hasTerm, selectedSubject, bookingDuration, recurringCount, recurringMax } = flow
  const termReady = hasTerm && Boolean(s.topic.trim())
  const valid = flow.stepValid(2)
  const recurringPreviewLabel = s.recurringEnabled && matchingPackage ? `${recurringCount} spotkania co tydzień` : null

  return (
    <div className="space-y-5">
      <StepHeader
        title="Wybierz płatność"
        description="Wybór nie uruchamia płatności — to nastąpi dopiero po podsumowaniu."
        aside={
          <Button type="button" variant="ghost" size="sm" onClick={() => setInfoOpen(true)} className="w-fit text-xs text-muted-foreground hover:text-foreground">
            <Info className="h-3.5 w-3.5" aria-hidden="true" /> Jak działają pakiety?
          </Button>
        }
      />

      {matchingPackage && (
        <div className="flex items-start gap-2.5 rounded-2xl border border-primary/30 bg-primary/10 px-4 py-3 text-sm text-foreground">
          <PackageCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
          <div>
            <p className="font-semibold">Masz aktywny pakiet</p>
            <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
              {remainingLessonsText(matchingPackage.remainingCredits)} dla {selectedSubject.name} · {bookingDuration} min.
              {matchingPackages.length > 1 ? ' Użyjemy najstarszego pasującego pakietu.' : ''}
            </p>
          </div>
        </div>
      )}

      {!termReady && (
        <p className="rounded-xl border border-border bg-card/60 px-4 py-3 text-xs text-muted-foreground">
          Nie wybrano terminu — dostępny jest tylko zakup pakietu na później. Aby opłacić pojedynczą lekcję, wróć do kroku „Termin”.
        </p>
      )}

      <div className="grid gap-3 md:grid-cols-3">
        <PaymentTile
          icon={CreditCard} active={s.paymentChoice === 'single'} disabled={!termReady}
          title={s.lessonKind === 'trial' ? 'Lekcja próbna' : 'Jedna lekcja'}
          lines={[`Cena lekcji ${pln(singlePayment.subtotalGrosze)}`, `Opłata serwisowa ${pln(singlePayment.studentServiceFeeGrosze)}`]}
          onClick={() => update({ paymentChoice: 'single' })}
        />
        <PaymentTile
          icon={Ticket} active={s.paymentChoice === 'existing_package'} disabled={!matchingPackage || !termReady}
          title="Wykorzystaj posiadany pakiet"
          lines={[matchingPackage ? `${matchingPackage.remainingCredits} dostępne` : 'Brak pasującego pakietu', 'Bez nowej opłaty serwisowej']}
          onClick={() => update({ paymentChoice: 'existing_package' })}
        />
        <PaymentTile
          icon={Layers} active={s.paymentChoice === 'buy_package'} disabled={!canBuyPackages}
          title="Kup pakiet lekcji"
          lines={[canBuyPackages ? `${offeredPackageSizes.join(' lub ')} lekcji u tego nauczyciela` : 'Niedostępne dla tego wyboru', 'Opłata serwisowa naliczana raz']}
          onClick={() => update({ paymentChoice: 'buy_package', packageMode: termReady ? 'package_and_book' : 'package_only' })}
        />
      </div>

      {s.paymentChoice === 'existing_package' && matchingPackage && (
        <Section>
          <label className="flex items-start gap-3 text-sm font-medium text-foreground">
            <input type="checkbox" checked={s.recurringEnabled} disabled={matchingPackage.remainingCredits < 2}
              onChange={(e) => update({ recurringEnabled: e.target.checked })} className="mt-1 h-4 w-4 rounded border-border accent-[#F4B400]" />
            <span>
              Rezerwuj co tydzień
              <span className="block text-xs font-normal text-muted-foreground">
                {matchingPackage.remainingCredits >= 2 ? `Od 2 do ${matchingPackage.remainingCredits} spotkań z tego pakietu.` : 'Ten pakiet ma tylko jedną dostępną lekcję.'}
              </span>
            </span>
          </label>
          {s.recurringEnabled && (
            <div className="mt-4 flex flex-col gap-1.5 sm:max-w-[200px]">
              <label htmlFor="recurringCount" className="text-xs font-medium text-foreground">Liczba spotkań</label>
              <select id="recurringCount" value={recurringCount} onChange={(e) => update({ recurringCount: Number(e.target.value) })}
                className="h-10 rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50">
                {Array.from({ length: Math.max(0, recurringMax - 1) }, (_, i) => i + 2).map((count) => (
                  <option key={count} value={count}>{count} spotkania</option>
                ))}
              </select>
              {recurringPreviewLabel && <p className="text-xs text-muted-foreground">{recurringPreviewLabel}</p>}
            </div>
          )}
        </Section>
      )}

      {s.paymentChoice === 'buy_package' && canBuyPackages && (
        <Section className="space-y-4 border-primary/30">
          <div className="grid gap-3 sm:grid-cols-2">
            {offeredPackageSizes.map((size) => {
              const payment = buildStudentPaymentBreakdown(lessonSubtotalGrosze * size)
              const active = s.packageSize === size
              return (
                <button key={size} type="button" aria-pressed={active} onClick={() => update({ packageSize: size as 5 | 10 })}
                  className={optionCardClass(active, 'flex min-h-16 flex-col justify-center')}>
                  <span>Pakiet {size} lekcji</span>
                  <span className="text-xs font-normal opacity-90">Cena pakietu {pln(payment.subtotalGrosze)}</span>
                  <span className="text-[11px] font-normal opacity-75">Łącznie {pln(payment.studentTotalGrosze)}</span>
                </button>
              )
            })}
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <button type="button" disabled={!termReady} aria-pressed={s.packageMode === 'package_and_book'} onClick={() => update({ packageMode: 'package_and_book' })}
              className={optionCardClass(s.packageMode === 'package_and_book')}>
              <span className="block">Kup pakiet i zarezerwuj pierwszą lekcję</span>
              <span className="mt-1 block text-xs font-normal opacity-80">{termReady ? `Po sukcesie zostanie ${s.packageSize - 1}/${s.packageSize} lekcji.` : 'Najpierw wybierz termin w kroku „Termin”.'}</span>
            </button>
            <button type="button" aria-pressed={s.packageMode === 'package_only'} onClick={() => update({ packageMode: 'package_only' })}
              className={optionCardClass(s.packageMode === 'package_only')}>
              <span className="block">Kup sam pakiet — terminy wybiorę później</span>
              <span className="mt-1 block text-xs font-normal opacity-80">Otrzymasz pełne {s.packageSize}/{s.packageSize} lekcji.</span>
            </button>
          </div>
          <p className={cn('rounded-xl border px-3 py-2 text-xs leading-relaxed text-muted-foreground', 'border-warning/30 bg-warning-surface')}>
            {s.packageMode === 'package_and_book'
              ? 'Termin zostanie zarezerwowany tylko, jeśli nadal będzie wolny, a nauczyciel musi go zaakceptować. Jeśli ktoś zajmie go wcześniej, zachowasz pełen pakiet.'
              : 'Kupujesz pakiet bez rezerwacji terminu — żaden termin nie zostanie zarezerwowany ani wysłany do nauczyciela.'}
          </p>
        </Section>
      )}

      <StepFooter step={2} onBack={() => router.push(flow.stepHref(1))} onNext={() => router.push(flow.stepHref(3))} nextLabel="Dalej" nextDisabled={!valid} />
      <PackageInfoDialog open={infoOpen} onOpenChange={setInfoOpen} />
    </div>
  )
}
