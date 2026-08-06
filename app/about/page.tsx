import type { Metadata } from 'next'
import { Target, Users, ShieldCheck, Sparkles } from 'lucide-react'
import { Navbar } from '@/components/layout/navbar'
import { Footer } from '@/components/layout/footer'
import { Reveal } from '@/components/shared/reveal'
import { AnimatedCounter } from '@/components/shared/animated-counter'

export const metadata: Metadata = { title: 'O nas' }

const values = [
  { icon: Target, title: 'Praktyka ponad teorię', description: 'Uczą u nas wyłącznie osoby z realnym doświadczeniem produkcyjnym — nie sami wykładowcy akademiccy.' },
  { icon: ShieldCheck, title: 'Zaufanie i weryfikacja', description: 'Każdy nauczyciel przechodzi ręczną weryfikację doświadczenia i rozmowę techniczną przed dopuszczeniem do nauczania.' },
  { icon: Users, title: 'Społeczność techniczna', description: 'Budujemy miejsce, w którym inżynierowie i technicy uczą się od siebie nawzajem, dzielą wiedzą i rozwijają karierę.' },
  { icon: Sparkles, title: 'Jakość ponad ilość', description: 'Wolimy mniej nauczycieli, ale sprawdzonych, niż dużą, niekontrolowaną bazę.' },
]

const stats = [
  { value: 300, suffix: '+', label: 'Zweryfikowanych nauczycieli' },
  { value: 8400, suffix: '+', label: 'Aktywnych uczniów' },
  { value: 47000, suffix: '+', label: 'Zrealizowanych lekcji' },
  { value: 8, suffix: '', label: 'Dziedzin technicznych' },
]

export default function AboutPage() {
  return (
    <>
      <Navbar />
      <main id="main-content" className="bg-background">
        <section className="relative overflow-hidden pb-16 pt-20 md:pb-20 md:pt-28">
          <div
            className="pointer-events-none absolute -top-40 left-1/2 h-[500px] w-[500px] -translate-x-1/2 rounded-full opacity-[0.08] blur-3xl"
            style={{ background: '#F4B400' }}
            aria-hidden="true"
          />
          <div className="relative mx-auto max-w-3xl px-4 text-center md:px-8">
            <p className="animate-fade-in-up text-sm font-semibold text-[#F4B400] uppercase tracking-wide">O nas</p>
            <h1 className="animate-fade-in-up mt-2 text-balance text-4xl font-bold leading-tight tracking-tight text-foreground md:text-5xl" style={{ animationDelay: '60ms' }}>
              Łączymy techników i inżynierów z ekspertami, którzy naprawdę pracowali w przemyśle
            </h1>
            <p className="animate-fade-in-up mx-auto mt-4 max-w-xl text-balance text-base leading-relaxed text-muted-foreground md:text-lg" style={{ animationDelay: '120ms' }}>
              TechBee powstało, bo nauka PLC, CNC, CAD czy robotyki z podręcznika to nie to samo, co nauka od kogoś, kto uruchamiał linię produkcyjną. Łączymy te dwa światy w jednej platformie lekcji online.
            </p>
          </div>
        </section>

        {/* Stats */}
        <section className="border-y border-border bg-card">
          <div className="mx-auto max-w-7xl px-4 py-12 md:px-8">
            <dl className="grid grid-cols-2 gap-8 md:grid-cols-4">
              {stats.map((stat, i) => (
                <Reveal key={stat.label} delay={i * 80} className="flex flex-col gap-1 text-center">
                  <dt className="text-3xl font-bold tracking-tight text-foreground md:text-4xl">
                    <AnimatedCounter value={stat.value} suffix={stat.suffix} />
                  </dt>
                  <dd className="text-sm text-muted-foreground">{stat.label}</dd>
                </Reveal>
              ))}
            </dl>
          </div>
        </section>

        {/* Mission */}
        <section className="section-pad bg-background">
          <div className="mx-auto max-w-3xl px-4 text-center md:px-8">
            <Reveal>
              <p className="text-sm font-semibold text-[#F4B400] uppercase tracking-wide">Nasza misja</p>
              <h2 className="mt-2 text-3xl font-bold tracking-tight text-foreground text-balance">
                Praktyczna wiedza techniczna powinna być dostępna dla każdego, kto chce się rozwijać
              </h2>
              <p className="mt-4 text-muted-foreground leading-relaxed text-balance">
                W Polsce brakuje wykwalifikowanych techników i inżynierów automatyki, mechatroniki i produkcji.
                Jednocześnie tysiące doświadczonych specjalistów ma wiedzę, której nie da się znaleźć w żadnym
                kursie online — bo zdobyli ją na hali produkcyjnej, w sterowni albo przy stole projektowym.
                TechBee daje im narzędzie, żeby przekazać tę wiedzę dalej — i na tym zarobić.
              </p>
            </Reveal>
          </div>
        </section>

        {/* Values */}
        <section className="section-pad bg-card border-t border-border">
          <div className="mx-auto max-w-6xl px-4 md:px-8">
            <Reveal className="text-center">
              <h2 className="text-3xl font-bold tracking-tight text-foreground">Czym się kierujemy</h2>
            </Reveal>
            <div className="mt-10 grid gap-5 sm:grid-cols-2">
              {values.map((v, i) => {
                const Icon = v.icon
                return (
                  <Reveal key={v.title} delay={i * 80} className="flex gap-4 rounded-2xl border border-border bg-background p-6">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#FEF3C7] dark:bg-[#3B2800]">
                      <Icon className="h-4.5 w-4.5 text-[#B45309] dark:text-[#FBBF24]" aria-hidden="true" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-foreground">{v.title}</h3>
                      <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{v.description}</p>
                    </div>
                  </Reveal>
                )
              })}
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </>
  )
}
