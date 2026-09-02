import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Reveal } from '@/components/shared/reveal'

/**
 * The closing action: one headline, one supporting line, one button.
 *
 * Kept to a narrow centred column on the page background rather than a
 * tinted or bordered block — by this point the visitor has passed four
 * framed sections, and a fifth container immediately above a link-rich
 * footer would just add noise to the moment that should be simplest.
 *
 * The final action stays simple: one compact dark panel, one line of
 * copy, one primary action.
 */
export function CtaSection() {
  return (
    <section className="border-b border-border bg-background px-4 py-16 md:px-8 md:py-24">
      <Reveal className="mx-auto flex max-w-5xl flex-col items-start justify-between gap-8 rounded-2xl border border-border bg-card p-6 shadow-[0_28px_90px_-58px_rgba(0,0,0,0.95)] sm:p-8 lg:flex-row lg:items-center">
        <div className="max-w-2xl">
          <p className="text-xs font-medium uppercase tracking-wide text-primary">Gotowy do startu?</p>
          <h2 className="mt-3 text-balance text-2xl font-bold leading-tight tracking-tight text-foreground sm:text-3xl">
            Znajdź nauczyciela, którego potrzebujesz
          </h2>
          <p className="mt-4 max-w-xl text-balance leading-relaxed text-muted-foreground">
            Przeglądanie giełdy nie wymaga konta. Zakładasz je dopiero wtedy, gdy rezerwujesz konkretną lekcję.
          </p>
        </div>
        <Link href="/marketplace" className="w-full shrink-0 sm:w-auto">
          <Button
            size="lg"
            className="group h-11 w-full px-7 text-[15px] font-semibold transition-[transform,box-shadow] duration-300 hover:-translate-y-0.5 hover:shadow-[0_10px_28px_-8px_rgba(244,180,0,0.45)] sm:w-auto"
          >
            Przeglądaj nauczycieli
            <ArrowRight
              className="ml-1 h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5"
              aria-hidden="true"
            />
          </Button>
        </Link>
      </Reveal>
    </section>
  )
}
