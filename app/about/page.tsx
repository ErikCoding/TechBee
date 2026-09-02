import type { Metadata } from 'next'
import Link from 'next/link'
import {
  ArrowRight,
  BookOpenCheck,
  ClipboardCheck,
  Factory,
  GraduationCap,
  SearchCheck,
  ShieldCheck,
  Sparkles,
  Users,
} from 'lucide-react'
import { Navbar } from '@/components/layout/navbar'
import { Footer } from '@/components/layout/footer'
import { Button } from '@/components/ui/button'
import { Reveal } from '@/components/shared/reveal'
import { AnimatedCounter } from '@/components/shared/animated-counter'

export const metadata: Metadata = { title: 'O nas' }

const stats = [
  { value: 300, suffix: '+', label: 'zweryfikowanych nauczycieli' },
  { value: 8400, suffix: '+', label: 'aktywnych uczniów' },
  { value: 47000, suffix: '+', label: 'zrealizowanych lekcji' },
]

const principles = [
  {
    icon: Factory,
    title: 'Najpierw praktyka',
    description:
      'Runbee powstało dla osób, które chcą uczyć się od ludzi pracujących z realnymi maszynami, projektami i wdrożeniami.',
  },
  {
    icon: ShieldCheck,
    title: 'Weryfikacja przed widocznością',
    description:
      'Profil nauczyciela trafia na giełdę dopiero po sprawdzeniu doświadczenia i specjalizacji.',
  },
  {
    icon: Users,
    title: 'Uczniowie, rodzice i nauczyciele',
    description:
      'Platforma porządkuje lekcję od rezerwacji po raport, żeby każda strona wiedziała, co się dzieje.',
  },
  {
    icon: Sparkles,
    title: 'Mniej hałasu, więcej jakości',
    description:
      'Wolimy mniejszą, sprawdzoną bazę specjalistów niż katalog, w którym trudno odróżnić praktyka od przypadkowego profilu.',
  },
]

const process = [
  {
    icon: SearchCheck,
    title: 'Wybór specjalisty',
    detail: 'Uczeń porównuje profile według dziedziny, oceny, ceny i dostępności.',
  },
  {
    icon: BookOpenCheck,
    title: 'Lekcja online',
    detail: 'Spotkanie odbywa się w przeglądarce, z rozmową i udostępnianiem ekranu.',
  },
  {
    icon: ClipboardCheck,
    title: 'Raport po zajęciach',
    detail: 'Po lekcji zostaje jasne podsumowanie i podstawa do rozliczenia.',
  },
]

export default function AboutPage() {
  return (
    <>
      <div className="dark">
        <Navbar />
        <main id="main-content" className="bg-background">
          <section className="border-b border-border bg-background">
            <div className="mx-auto max-w-7xl px-4 py-14 md:px-8 md:py-20 lg:py-24">
              <div className="grid items-center gap-10 lg:grid-cols-2 lg:gap-16">
                <div className="max-w-xl">
                  <p className="animate-fade-in-up text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    O Runbee
                  </p>
                  <h1
                    className="animate-fade-in-up mt-4 text-balance text-3xl font-bold leading-[1.15] tracking-tight text-foreground sm:text-4xl lg:text-[2.75rem]"
                    style={{ animationDelay: '70ms' }}
                  >
                    Łączymy naukę techniki z doświadczeniem z przemysłu
                  </h1>
                  <p
                    className="animate-fade-in-up mt-5 max-w-2xl text-balance text-base leading-relaxed text-muted-foreground sm:text-lg"
                    style={{ animationDelay: '130ms' }}
                  >
                    PLC, CNC, CAD, robotyka i automatyka wymagają rozmowy z kimś, kto naprawdę
                    rozwiązywał takie problemy. Runbee porządkuje ten kontakt w jednej platformie
                    lekcji online.
                  </p>
                  <div
                    className="animate-fade-in-up mt-8 flex flex-col gap-3 sm:flex-row"
                    style={{ animationDelay: '190ms' }}
                  >
                    <Link href="/marketplace" className="w-full sm:w-auto">
                      <Button size="lg" className="group h-11 w-full px-6 text-[15px] font-semibold sm:w-auto">
                        Zobacz nauczycieli
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
                        className="h-11 w-full border-border bg-card/40 px-6 text-[15px] hover:border-primary/50 hover:bg-primary/10 sm:w-auto"
                      >
                        Dla nauczycieli
                      </Button>
                    </Link>
                  </div>
                </div>

                <div
                  className="animate-fade-in-up overflow-hidden rounded-2xl border border-border bg-card"
                  style={{ animationDelay: '240ms' }}
                  aria-label="Co robi Runbee"
                >
                  <div className="flex items-center justify-between gap-3 border-b border-border bg-muted/40 px-5 py-3.5">
                    <div className="flex min-w-0 items-center gap-2">
                      <GraduationCap className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                      <div>
                        <p className="truncate text-sm font-semibold text-foreground">Praktyk uczy praktyki</p>
                      </div>
                    </div>
                    <span className="rounded-full bg-accent px-2.5 py-1 text-[11px] font-semibold text-accent-foreground">
                      Runbee
                    </span>
                  </div>

                  <ol className="divide-y divide-border">
                    {process.map((item) => {
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
                            <h2 className="text-sm font-semibold text-foreground transition-colors duration-200 group-hover:text-primary">
                              {item.title}
                            </h2>
                            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{item.detail}</p>
                          </div>
                        </li>
                      )
                    })}
                  </ol>
                </div>
              </div>
            </div>
          </section>

          <section className="border-b border-border bg-[var(--surface)]">
            <div className="mx-auto max-w-7xl px-4 py-12 md:px-8">
              <dl className="grid gap-4 sm:grid-cols-3">
                {stats.map((stat, i) => (
                  <Reveal
                    key={stat.label}
                    delay={i * 80}
                    className="rounded-2xl border border-border bg-card p-5"
                  >
                    <dt className="text-3xl font-bold tracking-tight text-foreground md:text-4xl">
                      <AnimatedCounter value={stat.value} suffix={stat.suffix} />
                    </dt>
                    <dd className="mt-2 text-sm leading-relaxed text-muted-foreground">{stat.label}</dd>
                  </Reveal>
                ))}
              </dl>
            </div>
          </section>

          <section className="border-b border-border bg-background" aria-labelledby="mission-heading">
            <div className="mx-auto grid max-w-7xl gap-10 px-4 py-16 md:px-8 md:py-24 lg:grid-cols-[0.8fr_1.2fr] lg:gap-16">
              <Reveal>
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Nasza misja
                </p>
                <h2
                  id="mission-heading"
                  className="mt-3 text-balance text-2xl font-bold leading-tight tracking-tight text-foreground sm:text-3xl"
                >
                  Wiedza techniczna powinna być dostępna od ludzi, którzy naprawdę ją stosują
                </h2>
              </Reveal>

              <Reveal delay={100} className="space-y-5 text-base leading-relaxed text-muted-foreground">
                <p>
                  W wielu obszarach technicznych najcenniejsza wiedza nie mieści się w kursie wideo
                  ani w instrukcji producenta. Pojawia się przy uruchomieniu linii, diagnozie awarii,
                  doborze narzędzia, ustawieniu procesu albo projekcie, który musi zadziałać w realnym
                  zakładzie.
                </p>
                <p>
                  Runbee daje tej wiedzy miejsce: uczeń może znaleźć specjalistę, umówić lekcję i
                  przejść przez cały proces online, a nauczyciel dostaje narzędzia do pracy, raportów
                  i rozliczeń.
                </p>
              </Reveal>
            </div>
          </section>

          <section className="border-b border-border bg-[var(--surface)]" aria-labelledby="principles-heading">
            <div className="mx-auto max-w-7xl px-4 py-16 md:px-8 md:py-24">
              <Reveal className="max-w-2xl">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Czym się kierujemy
                </p>
                <h2
                  id="principles-heading"
                  className="mt-3 text-balance text-2xl font-bold leading-tight tracking-tight text-foreground sm:text-3xl"
                >
                  Platforma ma być prosta, ale wymagająca tam, gdzie liczy się jakość
                </h2>
              </Reveal>

              <div className="mt-12 grid gap-4 sm:grid-cols-2">
                {principles.map((principle, i) => {
                  const Icon = principle.icon
                  return (
                    <Reveal
                      key={principle.title}
                      delay={(i % 2) * 80}
                      className="group rounded-2xl border border-border bg-card p-5 transition-colors duration-200 hover:border-primary/40"
                    >
                      <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent text-accent-foreground transition-colors duration-200 group-hover:bg-primary group-hover:text-primary-foreground">
                        <Icon className="h-4.5 w-4.5" aria-hidden="true" />
                      </span>
                      <h3 className="mt-4 text-base font-semibold text-foreground">{principle.title}</h3>
                      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                        {principle.description}
                      </p>
                    </Reveal>
                  )
                })}
              </div>
            </div>
          </section>

          <section className="border-b border-border bg-background px-4 py-16 md:px-8 md:py-24">
            <Reveal className="mx-auto flex max-w-5xl flex-col items-start justify-between gap-8 rounded-2xl border border-border bg-card p-6 sm:p-8 lg:flex-row lg:items-center">
              <div className="max-w-2xl">
                <p className="text-xs font-medium uppercase tracking-wide text-primary">Dalej</p>
                <h2 className="mt-3 text-balance text-2xl font-bold leading-tight tracking-tight text-foreground sm:text-3xl">
                  Zobacz, kto może pomóc Ci w konkretnej dziedzinie
                </h2>
                <p className="mt-4 max-w-xl text-balance leading-relaxed text-muted-foreground">
                  Przejrzyj giełdę nauczycieli i porównaj profile według specjalizacji, ceny,
                  dostępności i opinii.
                </p>
              </div>
              <Link href="/marketplace" className="w-full shrink-0 sm:w-auto">
                <Button size="lg" className="group h-11 w-full px-7 text-[15px] font-semibold sm:w-auto">
                  Przeglądaj nauczycieli
                  <ArrowRight
                    className="ml-1 h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5"
                    aria-hidden="true"
                  />
                </Button>
              </Link>
            </Reveal>
          </section>
        </main>
      </div>
      <Footer />
    </>
  )
}
