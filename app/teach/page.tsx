import Link from 'next/link'
import type { Metadata } from 'next'
import {
  ArrowRight, Wallet, CalendarRange, ShieldCheck, Search,
  UserPlus, CalendarCheck, Inbox, GraduationCap,
  Video, MessageSquare, ClipboardCheck, LineChart,
} from 'lucide-react'
import { Navbar } from '@/components/layout/navbar'
import { Footer } from '@/components/layout/footer'
import { Button } from '@/components/ui/button'
import { TeacherDashboardPreview } from '@/components/teach/teacher-dashboard-preview'
import { EarningsCalculator } from '@/components/teach/earnings-calculator'
import { getTeachers } from '@/services/teachers.service'
import { Reveal } from '@/components/shared/reveal'
import { PLATFORM_COMMISSION_PERCENT } from '@/lib/stripe-config'

export const metadata: Metadata = {
  title: 'Zostań nauczycielem',
  description:
    'Ucz online w dogodnych godzinach. Ustalasz stawkę i grafik, Runbee zajmuje się płatnościami, kalendarzem i rozliczeniami.',
}

/** Why a teacher would join — four, all real. */
const benefits = [
  {
    icon: Wallet,
    title: 'Ty ustalasz stawkę',
    description: `Sam decydujesz, ile kosztuje Twoja godzina, i zmieniasz to kiedy chcesz. U Ciebie zostaje ${100 - PLATFORM_COMMISSION_PERCENT}% kwoty lekcji.`,
  },
  {
    icon: CalendarRange,
    title: 'Ty ustalasz grafik',
    description:
      'Definiujesz dni i godziny dostępności. Każdą rezerwację akceptujesz albo odrzucasz — nie ma minimum godzin.',
  },
  {
    icon: ShieldCheck,
    title: 'Rozliczenia bez faktur',
    description:
      'Płatności obsługuje Stripe. Środki trafiają na Twoje konto po potwierdzeniu raportu z lekcji.',
  },
  {
    icon: Search,
    title: 'Uczniowie sami Cię znajdują',
    description:
      'Twój profil trafia do giełdy z filtrami po dziedzinie, cenie i dostępności. Nie musisz szukać uczniów.',
  },
]

/** Onboarding, in the order it actually happens. */
const steps = [
  {
    icon: UserPlus,
    title: 'Załóż profil nauczyciela',
    description: 'Doświadczenie, specjalizacja, umiejętności i certyfikaty. Profil przechodzi weryfikację.',
  },
  {
    icon: CalendarCheck,
    title: 'Ustaw dostępność i stawkę',
    description: 'Zaznaczasz dni i godziny, w których uczysz, oraz cenę za godzinę.',
  },
  {
    icon: Inbox,
    title: 'Uczniowie rezerwują lekcje',
    description: 'Rezerwacje trafiają do Twojego panelu. Potwierdzasz te, które Ci pasują.',
  },
  {
    icon: GraduationCap,
    title: 'Uczysz i rozliczasz się',
    description: 'Prowadzisz lekcję w przeglądarce, wysyłasz raport, otrzymujesz przelew.',
  },
]

/** Tools that exist in the product today. */
const tools = [
  {
    icon: Video,
    title: 'Pokój lekcyjny',
    detail: 'Wideo, audio i udostępnianie ekranu w przeglądarce — bez instalacji po żadnej stronie.',
  },
  {
    icon: CalendarRange,
    title: 'Kalendarz dostępności',
    detail: 'Dni i zakresy godzin, z których generują się terminy widoczne dla uczniów.',
  },
  {
    icon: MessageSquare,
    title: 'Czat z uczniem',
    detail: 'Jeden wątek na relację — ustalenia przed lekcją i po niej zostają w historii.',
  },
  {
    icon: ClipboardCheck,
    title: 'Raporty z lekcji',
    detail: 'Krótkie podsumowanie zajęć, które uczeń lub rodzic potwierdza.',
  },
  {
    icon: Wallet,
    title: 'Portfel i wypłaty',
    detail: 'Saldo Stripe Connect z historią transferów i wypłatą na konto bankowe.',
  },
  {
    icon: LineChart,
    title: 'Panel z Twoimi danymi',
    detail: 'Nadchodzące lekcje, prośby o rezerwację, zarobki i oceny w jednym miejscu.',
  },
]

/**
 * The teacher acquisition page.
 *
 * Not the homepage with the nouns swapped — the homepage argues that
 * good teachers are here, this one argues that teaching here is worth a
 * teacher's time. So the order is: what you control, what you would
 * actually earn, how long it takes to start, and what you get to work
 * with.
 *
 * Same container, tokens, panel vocabulary and heading scale as the
 * marketplace and dashboards. One visual in the hero (the teacher panel),
 * one interactive element further down (the earnings calculator, which
 * computes with `splitPayment` — the same function the real Stripe
 * transfer uses), and nothing decorative anywhere.
 *
 * Every figure comes from the catalogue or `PLATFORM_COMMISSION_PERCENT`.
 */
export default async function TeachPage() {
  const teachers = await getTeachers()
  const rates = teachers.map((t) => t.hourlyRate).sort((a, b) => a - b)
  const minRate = rates[0] ?? 80
  const maxRate = rates[rates.length - 1] ?? 300
  const medianRate = rates[Math.floor(rates.length / 2)] ?? 150

  return (
    <>
      <Navbar />
      <main id="main-content">
        {/* ── 1. Hero ── */}
        <section className="border-b border-border bg-background">
          <div className="mx-auto max-w-7xl px-4 py-14 md:px-8 md:py-20 lg:py-24">
            <div className="grid items-center gap-10 lg:grid-cols-2 lg:gap-16">
              <div className="max-w-xl">
                <p
                  className="animate-fade-in-up text-xs font-medium uppercase tracking-wide text-muted-foreground"
                  style={{ animationDelay: '40ms' }}
                >
                  Dla nauczycieli
                </p>

                <h1
                  className="animate-fade-in-up mt-4 text-balance text-3xl font-bold leading-[1.15] tracking-tight text-foreground sm:text-4xl lg:text-[2.75rem]"
                  style={{ animationDelay: '100ms' }}
                >
                  Ucz techniki online, na własnych warunkach
                </h1>

                <p
                  className="animate-fade-in-up mt-5 text-base leading-relaxed text-muted-foreground sm:text-lg"
                  style={{ animationDelay: '160ms' }}
                >
                  Ustalasz stawkę i godziny, my zajmujemy się kalendarzem, płatnościami
                  i rozliczeniami. Ty prowadzisz lekcje.
                </p>

                <div className="animate-fade-in-up mt-8 flex flex-col gap-3 sm:flex-row" style={{ animationDelay: '220ms' }}>
                  <Link href="/register?role=teacher" className="sm:w-auto">
                    <Button size="lg" className="group h-11 w-full px-6 text-[15px] font-semibold sm:w-auto">
                      Załóż konto nauczyciela
                      <ArrowRight
                        className="ml-1 h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5"
                        aria-hidden="true"
                      />
                    </Button>
                  </Link>
                  <Link href="#jak-zaczac" className="sm:w-auto">
                    <Button variant="outline" size="lg" className="h-11 w-full px-6 text-[15px] sm:w-auto">
                      Jak zacząć
                    </Button>
                  </Link>
                </div>
              </div>

              <TeacherDashboardPreview className="animate-fade-in-up [animation-delay:300ms]" />
            </div>
          </div>
        </section>

        {/* ── 2. Why teach here ── */}
        <section
          className="border-b border-border bg-[var(--surface)]"
          aria-labelledby="why-heading"
        >
          <div className="mx-auto max-w-7xl px-4 py-16 md:px-8 md:py-24">
            <Reveal className="max-w-xl">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Dlaczego Runbee
              </p>
              <h2
                id="why-heading"
                className="mt-3 text-balance text-2xl font-bold leading-tight tracking-tight text-foreground sm:text-3xl"
              >
                Uczysz. Resztą zajmujemy się my.
              </h2>
            </Reveal>

            <div className="mt-12 grid gap-12 lg:grid-cols-2 lg:gap-16">
              <dl className="border-t border-border">
                {benefits.map((benefit, i) => {
                  const Icon = benefit.icon
                  return (
                    <Reveal key={benefit.title} delay={i * 80} className="border-b border-border py-6">
                      <dt className="flex items-center gap-3">
                        <Icon className="h-5 w-5 shrink-0 text-primary" aria-hidden="true" />
                        <span className="text-base font-semibold text-foreground">
                          {benefit.title}
                        </span>
                      </dt>
                      <dd className="mt-2 text-sm leading-relaxed text-muted-foreground">
                        {benefit.description}
                      </dd>
                    </Reveal>
                  )
                })}
              </dl>

              {/* Real payout maths, not a promise about demand. */}
              <Reveal delay={120}>
                <p className="mb-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Policz, ile zostaje u Ciebie
                </p>
                <EarningsCalculator
                  minRate={minRate}
                  maxRate={maxRate}
                  medianRate={medianRate}
                  layout="stacked"
                />
              </Reveal>
            </div>
          </div>
        </section>

        {/* ── 3. How it works ── */}
        <section
          className="border-b border-border bg-background"
          id="jak-zaczac"
          aria-labelledby="steps-heading"
        >
          <div className="mx-auto max-w-7xl px-4 py-16 md:px-8 md:py-24">
            <Reveal className="max-w-xl">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Jak zacząć
              </p>
              <h2
                id="steps-heading"
                className="mt-3 text-balance text-2xl font-bold leading-tight tracking-tight text-foreground sm:text-3xl"
              >
                Cztery kroki do pierwszej lekcji
              </h2>
              <p className="mt-3 leading-relaxed text-muted-foreground">
                Wymagamy co najmniej trzech lat praktycznego doświadczenia przemysłowego
                w Twojej specjalizacji.
              </p>
            </Reveal>

            <ol className="mt-12 grid gap-px overflow-hidden rounded-2xl border border-border bg-border sm:grid-cols-2 lg:grid-cols-4">
              {steps.map((step, index) => {
                const Icon = step.icon
                return (
                  <Reveal as="li" key={step.title} delay={index * 80} className="flex flex-col gap-4 bg-card p-6">
                    <div className="flex items-center gap-3">
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-accent text-accent-foreground">
                        <Icon className="h-4 w-4" aria-hidden="true" />
                      </span>
                      <span className="text-xs font-bold tabular-nums tracking-wide text-muted-foreground">
                        KROK {index + 1}
                      </span>
                    </div>
                    <div>
                      <h3 className="text-base font-semibold text-foreground">{step.title}</h3>
                      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                        {step.description}
                      </p>
                    </div>
                  </Reveal>
                )
              })}
            </ol>
          </div>
        </section>

        {/* ── 4. Teacher tools ── */}
        <section
          className="border-b border-border bg-[var(--surface)]"
          aria-labelledby="tools-heading"
        >
          <div className="mx-auto max-w-7xl px-4 py-16 md:px-8 md:py-24">
            <Reveal className="max-w-xl">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Narzędzia
              </p>
              <h2
                id="tools-heading"
                className="mt-3 text-balance text-2xl font-bold leading-tight tracking-tight text-foreground sm:text-3xl"
              >
                Wszystko, czego potrzebujesz, jest w środku
              </h2>
            </Reveal>

            <dl className="mt-12 grid gap-x-16 border-t border-border sm:grid-cols-2">
              {tools.map((tool, i) => {
                const Icon = tool.icon
                return (
                  <Reveal key={tool.title} delay={(i % 2) * 80} className="border-b border-border py-6 sm:py-7">
                    <dt className="flex items-center gap-3">
                      <Icon className="h-5 w-5 shrink-0 text-primary" aria-hidden="true" />
                      <span className="text-base font-semibold text-foreground">{tool.title}</span>
                    </dt>
                    <dd className="mt-2 max-w-md text-sm leading-relaxed text-muted-foreground">
                      {tool.detail}
                    </dd>
                  </Reveal>
                )
              })}
            </dl>
          </div>
        </section>

        {/* ── 5. Final CTA ── */}
        <section className="border-b border-border bg-background">
          <Reveal className="mx-auto max-w-2xl px-4 py-16 text-center md:px-8 md:py-24">
            <h2 className="text-balance text-2xl font-bold leading-tight tracking-tight text-foreground sm:text-3xl">
              Masz doświadczenie, którego ktoś właśnie szuka
            </h2>
            <p className="mx-auto mt-4 max-w-md text-balance leading-relaxed text-muted-foreground">
              Założenie profilu nic nie kosztuje — prowizję pobieramy dopiero od zrealizowanej
              lekcji.
            </p>
            <Link href="/register?role=teacher" className="mt-8 inline-block">
              <Button size="lg" className="group h-11 px-7 text-[15px] font-semibold">
                Załóż konto nauczyciela
                <ArrowRight
                  className="ml-1 h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5"
                  aria-hidden="true"
                />
              </Button>
            </Link>
          </Reveal>
        </section>
      </main>
      <Footer />
    </>
  )
}
