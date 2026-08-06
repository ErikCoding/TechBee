import Link from 'next/link'
import type { Metadata } from 'next'
import { DollarSign, Calendar, Users, Shield, FileCheck, UserPlus, BadgeCheck, Rocket } from 'lucide-react'
import { Navbar } from '@/components/layout/navbar'
import { Footer } from '@/components/layout/footer'
import { Button } from '@/components/ui/button'
import { Reveal } from '@/components/shared/reveal'

export const metadata: Metadata = { title: 'Zostań nauczycielem' }

const benefits = [
  { icon: DollarSign, title: 'Zarabiaj na swoich zasadach', description: 'Ustaw własną stawkę godzinową. Zatrzymujesz 80% kwoty za każdą lekcję.' },
  { icon: Calendar, title: 'Twój grafik, Twoje zasady', description: 'Ustaw dostępność w kalendarzu. Przyjmuj lub odrzucaj zapytania bez minimalnej liczby godzin.' },
  { icon: Users, title: 'Gotowa baza uczniów', description: 'Docieraj do tysięcy aktywnych uczniów bez własnego marketingu.' },
  { icon: Shield, title: 'Bezpiecznie i wiarygodnie', description: 'Płatności trzymane w depozycie do zakończenia lekcji. Twój profil pokazuje realne opinie.' },
]

const steps = [
  { icon: UserPlus, title: 'Załóż konto nauczyciela', description: 'Rejestracja zajmuje 2 minuty — wybierz typ konta „Jestem nauczycielem”.' },
  { icon: FileCheck, title: 'Uzupełnij profil', description: 'Dodaj doświadczenie, umiejętności, certyfikaty i wyceń swoje lekcje.' },
  { icon: BadgeCheck, title: 'Przejdź weryfikację', description: 'Krótka rozmowa techniczna, żeby potwierdzić realne doświadczenie przemysłowe.' },
  { icon: Rocket, title: 'Zacznij uczyć', description: 'Publikujemy Twój profil w giełdzie nauczycieli i zaczynasz przyjmować rezerwacje.' },
]

export default function TeachPage() {
  return (
    <>
      <Navbar />
      <main id="main-content" className="bg-background">
        {/* Hero */}
        <section className="relative overflow-hidden pb-16 pt-20 md:pb-24 md:pt-28">
          <div
            className="pointer-events-none absolute -top-40 left-1/2 h-[500px] w-[500px] -translate-x-1/2 rounded-full opacity-[0.08] blur-3xl"
            style={{ background: '#F4B400' }}
            aria-hidden="true"
          />
          <div className="relative mx-auto max-w-3xl px-4 text-center md:px-8">
            <p className="animate-fade-in-up text-sm font-semibold text-[#F4B400] uppercase tracking-wide">Dla nauczycieli</p>
            <h1 className="animate-fade-in-up mt-2 text-balance text-4xl font-bold leading-tight tracking-tight text-foreground md:text-5xl" style={{ animationDelay: '60ms' }}>
              Zamień doświadczenie przemysłowe w dochód
            </h1>
            <p className="animate-fade-in-up mx-auto mt-4 max-w-xl text-balance text-base leading-relaxed text-muted-foreground md:text-lg" style={{ animationDelay: '120ms' }}>
              Ucz online, w dogodnych dla siebie godzinach. Najlepsi nauczyciele zarabiają 15 000 zł+ miesięcznie, pracując na część etatu.
            </p>
            <div className="animate-fade-in-up mt-8 flex flex-wrap items-center justify-center gap-3" style={{ animationDelay: '180ms' }}>
              <Link href="/register?role=teacher">
                <Button size="lg" className="bg-[#F4B400] text-[#0A0A0A] hover:bg-[#FBBF24] font-semibold px-8 transition-transform hover:-translate-y-0.5">
                  Zgłoś się jako nauczyciel
                </Button>
              </Link>
              <Link href="/#for-teachers">
                <Button size="lg" variant="outline" className="px-8">Dowiedz się więcej</Button>
              </Link>
            </div>
          </div>
        </section>

        {/* Benefits */}
        <section className="section-pad bg-card border-y border-border">
          <div className="mx-auto max-w-6xl px-4 md:px-8">
            <Reveal className="text-center">
              <h2 className="text-3xl font-bold tracking-tight text-foreground">Dlaczego warto uczyć na TechBee</h2>
            </Reveal>
            <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
              {benefits.map((b, i) => {
                const Icon = b.icon
                return (
                  <Reveal key={b.title} delay={i * 80} className="rounded-2xl border border-border bg-background p-6">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#FEF3C7] dark:bg-[#3B2800]">
                      <Icon className="h-4.5 w-4.5 text-[#B45309] dark:text-[#FBBF24]" aria-hidden="true" />
                    </div>
                    <h3 className="mt-4 text-sm font-semibold text-foreground">{b.title}</h3>
                    <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">{b.description}</p>
                  </Reveal>
                )
              })}
            </div>
          </div>
        </section>

        {/* Steps */}
        <section className="section-pad bg-background">
          <div className="mx-auto max-w-5xl px-4 md:px-8">
            <Reveal className="text-center">
              <h2 className="text-3xl font-bold tracking-tight text-foreground">Jak dołączyć w 4 krokach</h2>
              <p className="mt-2 text-muted-foreground">Wymagamy co najmniej 3 lat praktycznego doświadczenia przemysłowego w Twojej specjalizacji.</p>
            </Reveal>
            <div className="mt-12 grid gap-8 md:grid-cols-2 lg:grid-cols-4">
              {steps.map((step, i) => {
                const Icon = step.icon
                return (
                  <Reveal key={step.title} delay={i * 90} className="flex flex-col gap-3">
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-[#F4B400]/30 bg-[#FEF3C7] dark:bg-[#3B2800]">
                      <Icon className="h-5 w-5 text-[#B45309] dark:text-[#FBBF24]" aria-hidden="true" />
                    </div>
                    <h3 className="font-semibold text-foreground">{step.title}</h3>
                    <p className="text-sm leading-relaxed text-muted-foreground">{step.description}</p>
                  </Reveal>
                )
              })}
            </div>
            <Reveal delay={300} className="mt-14 flex justify-center">
              <Link href="/register?role=teacher">
                <Button size="lg" className="bg-[#F4B400] text-[#0A0A0A] hover:bg-[#FBBF24] font-semibold px-8">
                  Zacznij teraz
                </Button>
              </Link>
            </Reveal>
          </div>
        </section>
      </main>
      <Footer />
    </>
  )
}
