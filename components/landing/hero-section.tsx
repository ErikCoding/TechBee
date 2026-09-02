import Link from 'next/link'
import { ArrowRight, BadgeCheck, CalendarDays, CreditCard, Star, Video } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { HeroSearch } from '@/components/landing/hero-search'
import { getCategories } from '@/services/categories.service'
import { getTeachers } from '@/services/teachers.service'

/**
 * The homepage hero keeps the existing black Runbee identity while
 * making the first decision obvious: search the marketplace or browse
 * teachers. The supporting panel gives the page a product feel without
 * introducing a decorative background pattern.
 *
 * The visual treatment stays dark and product-like: quiet gradients,
 * one strong search action, and a compact platform preview instead of a
 * decorative pattern.
 */
export async function HeroSection() {
  const [categories, teachers] = await Promise.all([getCategories(), getTeachers()])
  const verifiedCount = teachers.filter((t) => t.verified).length
  const avgRating = teachers.length
    ? teachers.reduce((sum, t) => sum + t.rating, 0) / teachers.length
    : 0
  const trustSignals = [
    { icon: BadgeCheck, label: 'Zweryfikowani praktycy' },
    { icon: Video, label: 'Lekcje online' },
    { icon: CreditCard, label: 'Bez abonamentu' },
  ]

  return (
    <section className="relative isolate overflow-hidden border-b border-border bg-background">
      <div
        className="pointer-events-none absolute inset-0 -z-20"
        style={{
          background:
            'linear-gradient(180deg, color-mix(in srgb, var(--bee-yellow) 10%, var(--background)) 0%, var(--background) 38%, var(--surface) 100%)',
        }}
        aria-hidden="true"
      />
      <div
        className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-px bg-gradient-to-r from-transparent via-primary/40 to-transparent"
        aria-hidden="true"
      />

      <div className="relative mx-auto flex max-w-7xl flex-col gap-10 px-4 py-16 sm:min-h-[calc(100svh-57px)] sm:flex-row sm:items-center sm:justify-between sm:gap-8 sm:py-20 md:gap-10 md:px-8 lg:gap-16 lg:py-24">
        <div className="min-w-0 max-w-3xl flex-1">
          <p
            className="animate-fade-in-up text-xs font-semibold uppercase tracking-wide text-primary"
            style={{ animationDelay: '40ms' }}
          >
            Giełda nauczycieli technicznych
          </p>

          <h1
            className="animate-fade-in-up mt-5 text-balance text-4xl font-bold leading-[1.08] tracking-tight text-foreground sm:text-[2.65rem] md:text-[3.15rem] lg:text-[3.75rem]"
            style={{ animationDelay: '100ms' }}
          >
            Znajdź nauczyciela techniki, który uczy{' '}
            <span className="text-primary">z własnego doświadczenia</span>
          </h1>

          <p
            className="animate-fade-in-up mt-5 max-w-2xl text-balance text-base leading-relaxed text-muted-foreground sm:text-lg"
            style={{ animationDelay: '135ms' }}
          >
            Przejrzyj sprawdzone profile, wybierz termin i zacznij lekcję online bez umawiania wszystkiego poza platformą.
          </p>

          <div className="animate-fade-in-up mt-9" style={{ animationDelay: '170ms' }}>
            <HeroSearch categories={categories} compact />
          </div>

          <div
            className="animate-fade-in-up mt-7 flex flex-col gap-3 sm:flex-row"
            style={{ animationDelay: '230ms' }}
          >
            <Link href="/marketplace" className="w-full sm:w-auto">
              <Button
                size="lg"
                className="group h-11 w-full px-6 text-[15px] font-semibold shadow-[0_0_0_0_rgba(244,180,0,0)] transition-[transform,box-shadow] duration-300 hover:-translate-y-0.5 hover:shadow-[0_10px_28px_-8px_rgba(244,180,0,0.45)] sm:w-auto"
              >
                Przeglądaj nauczycieli
                <ArrowRight
                  className="ml-1 h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5"
                  aria-hidden="true"
                />
              </Button>
            </Link>
            <Link href="/teach" className="w-full sm:w-auto">
              <Button
                variant="outline"
                size="lg"
                className="h-11 w-full border-border bg-card/40 px-6 text-[15px] transition-[transform,border-color,background-color] duration-300 hover:-translate-y-0.5 hover:border-primary/50 hover:bg-primary/10 sm:w-auto"
              >
                Zostań nauczycielem
              </Button>
            </Link>
          </div>

          <div
            className="animate-fade-in-up mt-8 flex flex-wrap gap-2.5"
            style={{ animationDelay: '280ms' }}
            aria-label={`${verifiedCount} zweryfikowanych nauczycieli, ${categories.length} dziedzin technicznych`}
          >
            {trustSignals.map((signal) => {
              const Icon = signal.icon
              return (
                <span
                  key={signal.label}
                  className="inline-flex items-center gap-2 rounded-full border border-border bg-card/55 px-3 py-1.5 text-xs font-medium text-muted-foreground"
                >
                  <Icon className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
                  {signal.label}
                </span>
              )
            })}
          </div>
        </div>

        <div
          className="hidden animate-fade-in-up w-full max-w-sm rounded-2xl border border-border bg-card/70 p-4 shadow-[0_24px_80px_-50px_rgba(0,0,0,0.95)] backdrop-blur sm:block sm:w-64 sm:shrink-0 sm:self-center md:w-72 lg:w-96"
          style={{ animationDelay: '260ms' }}
          aria-label="Podsumowanie platformy"
        >
          <div className="rounded-xl border border-border bg-background/70 p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Dzisiaj na Runbee
                </p>
                <p className="mt-1 text-lg font-semibold text-foreground">Gotowe do rezerwacji</p>
              </div>
              <span className="rounded-full bg-primary px-3 py-1 text-xs font-bold text-primary-foreground">
                Online
              </span>
            </div>

            <dl className="mt-6 grid grid-cols-2 gap-3">
              <div className="rounded-lg border border-border bg-card/80 p-3">
                <dt className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <BadgeCheck className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
                  Nauczyciele
                </dt>
                <dd className="mt-2 text-2xl font-bold tabular-nums text-foreground">{verifiedCount}</dd>
              </div>
              <div className="rounded-lg border border-border bg-card/80 p-3">
                <dt className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Star className="h-3.5 w-3.5 fill-primary stroke-none" aria-hidden="true" />
                  Średnia ocena
                </dt>
                <dd className="mt-2 text-2xl font-bold tabular-nums text-foreground">{avgRating.toFixed(1)}</dd>
              </div>
            </dl>

            <div className="mt-4 rounded-lg border border-primary/25 bg-primary/10 p-3">
              <div className="flex items-start gap-3">
                <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                  <CalendarDays className="h-4 w-4" aria-hidden="true" />
                </span>
                <div>
                  <p className="text-sm font-semibold text-foreground">Wybierasz termin z kalendarza</p>
                  <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                    Rezerwacja, lekcja i raport zostają w jednym procesie.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
