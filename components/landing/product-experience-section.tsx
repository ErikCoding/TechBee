import Link from 'next/link'
import { ArrowRight, CalendarCheck, Video, MessageSquare, ClipboardCheck, CreditCard } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Reveal } from '@/components/shared/reveal'

/**
 * What the platform does around the lesson itself.
 *
 * Text on one side, a product panel on the other — the panel drawn in
 * the dashboards' own language (bordered `rounded-2xl` container, tinted
 * header bar, hairline-divided rows) so it reads as a piece of the
 * application rather than an illustration.
 *
 * Each row is a feature that exists today: booking against the teacher's
 * declared availability, the in-browser lesson room, the student↔teacher
 * thread, the post-lesson report, and the Stripe transfer that the
 * report confirmation releases. No invented statuses, counts or names —
 * this describes the flow, it does not fake a screenshot of someone's
 * account.
 *
 * On mobile the copy comes first and the panel follows, via `order`
 * rather than duplicated markup.
 */
const flow = [
  {
    icon: CalendarCheck,
    title: 'Rezerwacja terminu',
    detail: 'Uczeń wybiera godzinę z dostępności nauczyciela i opłaca lekcję przez Stripe.',
  },
  {
    icon: Video,
    title: 'Lekcja w przeglądarce',
    detail: 'Wideo, audio i udostępnianie ekranu — bez instalowania czegokolwiek.',
  },
  {
    icon: MessageSquare,
    title: 'Czat z nauczycielem',
    detail: 'Ustalenia przed lekcją i po niej zostają w jednym wątku.',
  },
  {
    icon: ClipboardCheck,
    title: 'Raport z lekcji',
    detail: 'Nauczyciel opisuje, co zostało zrobione. Uczeń lub rodzic potwierdza.',
  },
  {
    icon: CreditCard,
    title: 'Rozliczenie',
    detail: 'Potwierdzenie raportu uruchamia przelew środków do nauczyciela.',
  },
]

export function ProductExperienceSection() {
  return (
    <section className="border-b border-border bg-[var(--surface)]" aria-labelledby="product-heading">
      <div className="mx-auto max-w-7xl px-4 py-16 md:px-8 md:py-24">
        <div className="grid items-center gap-10 lg:grid-cols-2 lg:gap-16">
          {/* Copy — first on mobile, second on desktop. */}
          <Reveal className="order-1 max-w-xl lg:order-2">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              W środku platformy
            </p>
            <h2
              id="product-heading"
              className="mt-3 text-balance text-2xl font-bold leading-tight tracking-tight text-foreground sm:text-3xl"
            >
              Cała nauka w jednym miejscu
            </h2>
            <p className="mt-4 leading-relaxed text-muted-foreground">
              Rezerwacja, lekcja online, rozmowa z nauczycielem, raport i płatność są częścią
              jednego procesu. Nie musisz umawiać się mailem, dzwonić ani rozliczać przelewem
              na własną rękę.
            </p>
            <Link href="/marketplace" className="mt-7 inline-block">
              <Button size="lg" className="group h-11 px-6 text-[15px] font-semibold">
                Zacznij od wyboru nauczyciela
                <ArrowRight
                  className="ml-1 h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5"
                  aria-hidden="true"
                />
              </Button>
            </Link>
          </Reveal>

          {/* Product panel — second on mobile, first on desktop. */}
          <Reveal
            delay={110}
            className="order-2 overflow-hidden rounded-xl border border-border bg-card/90 shadow-[0_18px_60px_-46px_rgba(0,0,0,0.9)] lg:order-1"
          >
            <div className="flex items-center justify-between gap-3 border-b border-border bg-background/45 px-5 py-4">
              <h3 className="text-sm font-semibold text-foreground">Przebieg lekcji</h3>
              <span className="rounded-full bg-success-surface px-2.5 py-1 text-[11px] font-semibold text-success-on-surface">
                1 proces
              </span>
            </div>
            <ol className="divide-y divide-border">
              {flow.map((item, index) => {
                const Icon = item.icon
                return (
                  <li
                    key={item.title}
                    className="group flex items-start gap-4 px-5 py-4 transition-[background-color,transform] duration-200 hover:-translate-y-0.5 hover:bg-primary/5"
                  >
                    <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border bg-muted/40 text-muted-foreground transition-[border-color,background-color,color,transform] duration-200 group-hover:scale-105 group-hover:border-primary/35 group-hover:bg-primary group-hover:text-primary-foreground">
                      <Icon className="h-4 w-4" aria-hidden="true" />
                    </span>
                    <div className="min-w-0">
                      <div className="flex items-baseline gap-2">
                        <span className="text-[11px] font-bold tabular-nums text-muted-foreground/70 transition-colors duration-200 group-hover:text-primary">
                          0{index + 1}
                        </span>
                        <h4 className="text-sm font-semibold text-foreground transition-colors duration-200 group-hover:text-primary">
                          {item.title}
                        </h4>
                      </div>
                      <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                        {item.detail}
                      </p>
                    </div>
                  </li>
                )
              })}
            </ol>
          </Reveal>
        </div>
      </div>
    </section>
  )
}
