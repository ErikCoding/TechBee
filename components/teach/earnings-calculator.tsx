'use client'

import { useState } from 'react'
import { Info } from 'lucide-react'
import { PLATFORM_COMMISSION_PERCENT, splitPayment, toGrosze, fromGrosze } from '@/lib/stripe-config'
import { cn } from '@/lib/utils'

interface Props {
  /** Real bounds from the live catalogue, so the slider offers rates teachers actually charge. */
  minRate: number
  maxRate: number
  medianRate: number
  /**
   * `split` puts inputs and result side by side — right for a wide,
   * full-width section. `stacked` leads with the result and drops the
   * sliders underneath, which is what fits a hero's narrower column and
   * also puts the number first, where it does the most work.
   */
  layout?: 'split' | 'stacked'
}

/**
 * What a teacher would actually keep.
 *
 * The page used to assert "najlepsi nauczyciele zarabiają 15 000 zł+
 * miesięcznie" and "zatrzymujesz 80%" — the first was invented, and the
 * second was simply wrong: `PLATFORM_COMMISSION_PERCENT` is 15, so the
 * teacher keeps 85%.
 *
 * A calculator replaces both. It promises nothing about demand; it
 * answers "if I charge this and teach that often, what lands in my
 * account?" — and it computes it with `splitPayment`, the same function
 * the Stripe transfer uses, so the number shown here is the number that
 * would actually be paid out.
 */
export function EarningsCalculator({ minRate, maxRate, medianRate, layout = 'split' }: Props) {
  const [rate, setRate] = useState(medianRate)
  const [lessonsPerWeek, setLessonsPerWeek] = useState(5)

  const monthlyLessons = lessonsPerWeek * 4
  const grossGrosze = toGrosze(rate) * monthlyLessons
  const { platformFeeGrosze, teacherAmountGrosze } = splitPayment(grossGrosze)

  const pln = (grosze: number) => `${Math.round(fromGrosze(grosze)).toLocaleString('pl-PL')} zł`
  const stacked = layout === 'stacked'

  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-card">
      <div
        className={
          stacked
            ? 'flex flex-col-reverse gap-6 p-6'
            : 'grid gap-6 p-6 sm:grid-cols-2 sm:gap-8 sm:p-8'
        }
      >
        {/* Inputs */}
        <div className="flex flex-col gap-6">
          <div>
            <div className="flex items-baseline justify-between">
              <label htmlFor="calc-rate" className="text-sm font-medium text-foreground">
                Twoja stawka za godzinę
              </label>
              <span className="text-sm font-bold tabular-nums text-primary">{rate} zł</span>
            </div>
            <input
              id="calc-rate"
              type="range"
              min={minRate}
              max={maxRate}
              step={10}
              value={rate}
              onChange={(e) => setRate(Number(e.target.value))}
              className="mt-3 w-full accent-primary"
            />
            <div className="mt-1 flex justify-between text-[11px] text-muted-foreground">
              <span>{minRate} zł</span>
              <span>{maxRate} zł</span>
            </div>
          </div>

          <div>
            <div className="flex items-baseline justify-between">
              <label htmlFor="calc-lessons" className="text-sm font-medium text-foreground">
                Lekcje tygodniowo
              </label>
              <span className="text-sm font-bold tabular-nums text-primary">{lessonsPerWeek}</span>
            </div>
            <input
              id="calc-lessons"
              type="range"
              min={1}
              max={20}
              step={1}
              value={lessonsPerWeek}
              onChange={(e) => setLessonsPerWeek(Number(e.target.value))}
              className="mt-3 w-full accent-primary"
            />
            <div className="mt-1 flex justify-between text-[11px] text-muted-foreground">
              <span>1</span>
              <span>20</span>
            </div>
          </div>
        </div>

        {/* Result */}
        <div className="flex flex-col justify-center rounded-xl bg-muted/40 p-5">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Twoje miesięczne przychody
          </p>
          <p className="mt-1 text-4xl font-bold tabular-nums tracking-tight text-foreground transition-all duration-200">
            {pln(teacherAmountGrosze)}
          </p>
          <dl className="mt-4 flex flex-col gap-1.5 border-t border-border pt-4 text-xs">
            <div className="flex justify-between">
              <dt className="text-muted-foreground">{monthlyLessons} lekcji × {rate} zł</dt>
              <dd className="font-medium tabular-nums text-foreground">{pln(grossGrosze)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Prowizja Runbee ({PLATFORM_COMMISSION_PERCENT}%)</dt>
              <dd className="font-medium tabular-nums text-muted-foreground">−{pln(platformFeeGrosze)}</dd>
            </div>
          </dl>
        </div>
      </div>

      <p
        className={cn(
          'flex items-start gap-2 border-t border-border bg-muted/20 px-6 py-3 text-[11px] leading-relaxed text-muted-foreground',
          !stacked && 'sm:px-8',
        )}
      >
        <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        Szacunek na podstawie Twoich założeń — Runbee nie gwarantuje liczby uczniów. Prowizja liczona tą samą funkcją,
        która rozlicza realne wypłaty.
      </p>
    </div>
  )
}
