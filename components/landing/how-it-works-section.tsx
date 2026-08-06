import { Search, CalendarCheck, Video, Trophy } from 'lucide-react'
import { Reveal } from '@/components/shared/reveal'

const steps = [
  {
    icon: Search,
    step: '01',
    title: 'Znajdź specjalistę',
    description:
      'Szukaj według umiejętności, oprogramowania lub dostępności. Filtruj po ocenie, cenie i języku. Czytaj zweryfikowane opinie prawdziwych uczniów.',
  },
  {
    icon: CalendarCheck,
    step: '02',
    title: 'Zarezerwuj lekcję',
    description:
      'Wybierz termin pasujący do Twojego grafiku. Płać bezpiecznie BeeCoins z portfela. Anuluj lub przełóż lekcję do 24 godzin przed startem.',
  },
  {
    icon: Video,
    step: '03',
    title: 'Ucz się online na żywo',
    description:
      'Dołącz przez wbudowany pokój wideo. Udostępniaj ekran, kod i schematy w czasie rzeczywistym. Sesje są nagrywane do późniejszej powtórki.',
  },
  {
    icon: Trophy,
    step: '04',
    title: 'Zdobywaj BeePoints',
    description:
      'Każda lekcja daje BeePoints. Wymieniaj je na zniżki, priorytetowe rezerwacje i ekskluzywne warsztaty z najlepszymi nauczycielami.',
  },
]

export function HowItWorksSection() {
  return (
    <section className="section-pad bg-background" id="how-it-works" aria-labelledby="how-heading">
      <div className="mx-auto max-w-7xl px-4 md:px-8">
        {/* Header */}
        <Reveal className="mx-auto max-w-2xl text-center">
          <p className="text-sm font-semibold text-[#F4B400] uppercase tracking-wide">
            Prosty proces
          </p>
          <h2
            id="how-heading"
            className="mt-1 text-3xl font-bold tracking-tight text-foreground text-balance"
          >
            Od zera do praktycznych umiejętności w czterech krokach
          </h2>
          <p className="mt-2 text-muted-foreground text-balance">
            Bez umów i abonamentów. Rezerwujesz tylko wtedy, gdy tego potrzebujesz.
          </p>
        </Reveal>

        {/* Steps */}
        <div className="mt-14 grid gap-8 md:grid-cols-2 lg:grid-cols-4">
          {steps.map((step, index) => {
            const Icon = step.icon
            return (
              <Reveal key={step.step} delay={index * 100} className="relative flex flex-col gap-4">
                {/* Connector line (desktop) */}
                {index < steps.length - 1 && (
                  <div
                    className="absolute left-[calc(50%+2.5rem)] top-6 hidden h-px w-[calc(100%-2rem)] bg-border lg:block"
                    aria-hidden="true"
                  />
                )}
                {/* Icon + step number */}
                <div className="group relative flex h-12 w-12 items-center justify-center rounded-2xl border border-[#F4B400]/30 bg-[#FEF3C7] transition-transform duration-300 hover:scale-105 dark:bg-[#3B2800]">
                  <Icon className="h-5 w-5 text-[#B45309] dark:text-[#FBBF24]" aria-hidden="true" />
                  <span className="absolute -right-2 -top-2 flex h-5 w-5 items-center justify-center rounded-full bg-[#F4B400] text-[10px] font-bold text-[#0A0A0A]">
                    {step.step}
                  </span>
                </div>
                <div>
                  <h3 className="font-semibold text-foreground">{step.title}</h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                    {step.description}
                  </p>
                </div>
              </Reveal>
            )
          })}
        </div>
      </div>
    </section>
  )
}
