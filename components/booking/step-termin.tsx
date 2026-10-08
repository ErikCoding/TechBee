'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { CalendarRange, CheckCircle2, ChevronDown, ChevronUp, Loader2, Lock } from 'lucide-react'
import { Textarea } from '@/components/ui/textarea'
import { BOOKING_WINDOW_DAYS } from '@/lib/availability'
import { LESSON_BUFFER_MINUTES } from '@/lib/lesson-time'
import { cn } from '@/lib/utils'
import { pln, useBookingFlow } from './booking-flow-provider'
import { Section, StepFooter, StepHeader, StepSkeleton, optionCardClass } from './booking-ui'

/** Days shown before the calendar is expanded. */
const COLLAPSED_DAY_COUNT = 7

export function StepTermin() {
  const router = useRouter()
  const flow = useBookingFlow()
  const { selections: s, update, days, trialConfig, trialPayment, firstRegularPayment, firstRegularDuration, durationOptions, subjects } = flow
  const [expanded, setExpanded] = useState(false)
  const autoExpanded = useRef(false)

  // A restored/selected date beyond the first week must stay visible after
  // a refresh or Back/Forward: open the calendar once when data is ready.
  useEffect(() => {
    if (!flow.ready || autoExpanded.current) return
    autoExpanded.current = true
    if (s.dayIso && days.findIndex((d) => d.isoDate === s.dayIso) >= COLLAPSED_DAY_COUNT) setExpanded(true)
  }, [flow.ready, s.dayIso, days])

  if (!flow.ready) return <StepSkeleton />

  if (days.length === 0) {
    return (
      <div className="rounded-2xl border border-border bg-card p-8 text-center text-sm text-muted-foreground">
        Ten nauczyciel nie ma obecnie dostępnych terminów. Napisz do niego wiadomość, aby zapytać o dostępność.
      </div>
    )
  }

  const viewDay = days.find((d) => d.isoDate === s.dayIso) ?? days[0]
  const isTrial = s.lessonKind === 'trial' && trialConfig.enabled
  const valid = flow.stepValid(1)
  const hasSlot = Boolean(s.slot)
  const canCollapse = days.length > COLLAPSED_DAY_COUNT
  // Collapsed view = first 7 days, plus the selected day if it lies further out (so a choice never disappears).
  const firstDays = days.slice(0, COLLAPSED_DAY_COUNT)
  const visibleDays = !canCollapse || expanded
    ? days
    : firstDays.some((d) => d.isoDate === viewDay.isoDate) ? firstDays : [...firstDays, viewDay]
  const hiddenCount = days.length - visibleDays.length
  const hint = !valid
    ? hasSlot && !s.topic.trim()
      ? 'Podaj temat lekcji, aby przejść dalej.'
      : isTrial ? 'Lekcja próbna wymaga wybrania terminu i tematu.' : undefined
    : !hasSlot
      ? 'Bez terminu możesz kupić tylko pakiet — wybierz go w następnym kroku.'
      : undefined

  return (
    <div>
      <StepHeader
        title="Wybierz termin"
        description="Przedmiot, rodzaj i długość lekcji oraz godzina spotkania."
        aside={
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <CalendarRange className="h-3.5 w-3.5" aria-hidden="true" /> Do {BOOKING_WINDOW_DAYS} dni do przodu · {LESSON_BUFFER_MINUTES} min zapasu
          </p>
        }
      />

      <div className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,4fr)_minmax(0,5fr)] lg:items-start">
        <div className="space-y-5">
          {subjects.length > 1 && (
            <Section title="Przedmiot">
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-1">
                {subjects.map((subject) => {
                  const active = s.subjectId === subject.id
                  return (
                    <button key={subject.id} type="button" aria-pressed={active} onClick={() => update({ subjectId: subject.id })}
                      className={optionCardClass(active, 'flex min-h-12 items-center justify-between gap-2')}>
                      <span>{subject.name}</span>
                      {active && <CheckCircle2 className="h-4 w-4 shrink-0 text-primary" aria-hidden="true" />}
                    </button>
                  )
                })}
              </div>
            </Section>
          )}

          {trialConfig.enabled && trialPayment && (
            <Section title="Rodzaj lekcji">
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-1">
                <button type="button" aria-pressed={!isTrial} onClick={() => update({ lessonKind: 'regular' })} className={optionCardClass(!isTrial, 'flex min-h-14 flex-col justify-center')}>
                  <span>Lekcja standardowa</span>
                  <span className="text-xs font-normal opacity-80">od {pln(firstRegularPayment.subtotalGrosze)} / {firstRegularDuration} min</span>
                </button>
                <button type="button" aria-pressed={isTrial} onClick={() => update({ lessonKind: 'trial' })} className={optionCardClass(isTrial, 'flex min-h-14 flex-col justify-center')}>
                  <span>Lekcja próbna</span>
                  <span className="text-xs font-normal opacity-80">{trialConfig.duration} min · {pln(trialPayment.subtotalGrosze)}</span>
                </button>
              </div>
            </Section>
          )}

          <Section title="Długość">
            {isTrial ? (
              <p className="inline-flex rounded-xl border border-primary/30 bg-primary/10 px-4 py-2 text-sm font-semibold text-foreground">Lekcja próbna: {trialConfig.duration} min</p>
            ) : (
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {durationOptions.map((d) => (
                  <button key={d.minutes} type="button" aria-pressed={s.duration === d.minutes} onClick={() => update({ duration: d.minutes })}
                    className={optionCardClass(s.duration === d.minutes, 'min-h-11 text-center font-medium')}>
                    {d.label}
                  </button>
                ))}
              </div>
            )}
          </Section>

          <Section title="Temat lekcji">
            <Textarea
              value={s.topic}
              maxLength={500}
              onChange={(e) => update({ topic: e.target.value })}
              placeholder="np. Konfiguracja bloków funkcyjnych w TIA Portal, przygotowanie do egzaminu…"
              rows={4}
            />
          </Section>
        </div>

        <div className="space-y-5">
          <Section title="Dzień">
            <div className="grid grid-cols-4 gap-2 sm:grid-cols-7">
              {visibleDays.map((day) => {
                const active = day.isoDate === viewDay.isoDate
                return (
                  <button key={day.isoDate} type="button" aria-pressed={active} onClick={() => update({ dayIso: day.isoDate, slot: null })}
                    className={optionCardClass(active, 'flex min-h-12 flex-col items-center justify-center gap-0.5 px-1 py-1.5 text-center text-xs font-medium')}>
                    <span>{day.weekdayLabel}</span>
                    <span className="text-[11px] opacity-80">{day.dayLabel.split(', ')[1]}</span>
                  </button>
                )
              })}
            </div>
            {canCollapse && (
              <button
                type="button"
                aria-expanded={expanded}
                onClick={() => setExpanded((v) => !v)}
                className="mt-3 inline-flex h-10 w-full items-center justify-center gap-2 rounded-xl border border-border bg-background/60 text-sm font-medium text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60 motion-reduce:transition-none"
              >
                {expanded ? (<><ChevronUp className="h-4 w-4" aria-hidden="true" /> Pokaż mniej terminów</>) : (<><ChevronDown className="h-4 w-4" aria-hidden="true" /> Pokaż więcej terminów{hiddenCount > 0 ? ` (+${hiddenCount})` : ''}</>)}
              </button>
            )}
          </Section>

          <Section title={<span className="inline-flex items-center gap-2">Godzina — {viewDay.dayLabel}{flow.loadingSlots && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" aria-hidden="true" />}</span>}>
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 xl:grid-cols-5">
              {viewDay.slots.map((slot) => {
                const disabled = slot.status !== 'available'
                const active = s.dayIso === viewDay.isoDate && s.slot === slot.time
                return (
                  <button key={slot.time} type="button" disabled={disabled} aria-pressed={active} onClick={() => update({ dayIso: viewDay.isoDate, slot: slot.time })}
                    className={cn(optionCardClass(active, 'inline-flex min-h-11 items-center justify-center gap-1.5 px-2 text-center font-semibold tabular-nums'),
                      active && 'bg-primary text-primary-foreground hover:text-primary-foreground', disabled && 'bg-muted/60')}>
                    {slot.status === 'booked' && <Lock className="h-3 w-3" aria-hidden="true" />}
                    {slot.time}
                  </button>
                )
              })}
            </div>
            {viewDay.slots.every((slot) => slot.status !== 'available') && (
              <p className="mt-4 text-xs text-muted-foreground">Brak wolnych godzin dla lekcji {flow.bookingDuration} min.</p>
            )}
          </Section>
        </div>
      </div>

      <StepFooter step={1} onNext={() => router.push(flow.stepHref(2))} nextLabel="Dalej" nextDisabled={!valid} hint={hint} />
    </div>
  )
}
