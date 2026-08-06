import Link from 'next/link'
import { DollarSign, Calendar, Users, Shield } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Reveal } from '@/components/shared/reveal'

const benefits = [
  {
    icon: DollarSign,
    title: 'Zarabiaj na swoich zasadach',
    description: 'Ustaw własną stawkę godzinową. Najlepsi nauczyciele zarabiają 15 000 zł+ miesięcznie, pracując na część etatu. Zatrzymujesz 80% kwoty za każdą lekcję.',
  },
  {
    icon: Calendar,
    title: 'Twój grafik, Twoje zasady',
    description: 'Ustaw dostępność w osobistym kalendarzu. Przyjmuj lub odrzucaj zapytania. Bez minimalnej liczby godzin i narzuconego grafiku.',
  },
  {
    icon: Users,
    title: 'Gotowa baza uczniów',
    description: 'Docieraj do ponad 8400 aktywnych uczniów bez własnego marketingu. SEO i reklamy kierują uczniów prosto na Twój profil.',
  },
  {
    icon: Shield,
    title: 'Bezpiecznie i wiarygodnie',
    description: 'Płatności są trzymane w depozycie do zakończenia lekcji. Profil pokazuje Twoje prawdziwe kwalifikacje i opinie.',
  },
]

export function ForTeachersSection() {
  return (
    <section className="section-pad bg-card border-y border-border" id="for-teachers" aria-labelledby="for-teachers-heading">
      <div className="mx-auto max-w-7xl px-4 md:px-8">
        <div className="grid gap-12 lg:grid-cols-2 lg:items-center">
          {/* Left: text */}
          <Reveal>
            <p className="text-sm font-semibold text-[#F4B400] uppercase tracking-wide">
              Dla nauczycieli
            </p>
            <h2
              id="for-teachers-heading"
              className="mt-2 text-3xl font-bold tracking-tight text-foreground text-balance"
            >
              Zamień doświadczenie przemysłowe w dochód
            </h2>
            <p className="mt-3 text-muted-foreground leading-relaxed text-balance">
              Lata pracy na produkcji, w sterowni lub przy stanowisku projektowym to dokładnie to,
              czego potrzebuje kolejne pokolenie techników i inżynierów. TechBee łączy Twoją wiedzę
              z uczniami, którzy chcą za nią zapłacić.
            </p>

            <div className="mt-8 grid gap-5 sm:grid-cols-2">
              {benefits.map((b) => {
                const Icon = b.icon
                return (
                  <div key={b.title} className="flex gap-3">
                    <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#FEF3C7] dark:bg-[#3B2800]">
                      <Icon className="h-4 w-4 text-[#B45309] dark:text-[#FBBF24]" aria-hidden="true" />
                    </div>
                    <div>
                      <h3 className="text-sm font-semibold text-foreground">{b.title}</h3>
                      <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{b.description}</p>
                    </div>
                  </div>
                )
              })}
            </div>

            <div className="mt-8 flex gap-3">
              <Link href="/teach">
                <Button className="bg-[#F4B400] text-[#0A0A0A] hover:bg-[#FBBF24] font-semibold transition-transform hover:-translate-y-0.5">
                  Zgłoś się jako nauczyciel
                </Button>
              </Link>
              <Link href="/dashboard/teacher">
                <Button variant="outline">Zobacz panel nauczyciela</Button>
              </Link>
            </div>
          </Reveal>

          {/* Right: stats card */}
          <Reveal delay={120} className="rounded-3xl border border-border bg-background p-8 transition-shadow hover:shadow-lg">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              Najwyższe zarobki nauczyciela w tym miesiącu
            </p>
            <div className="mt-4 flex items-end gap-2">
              <span className="text-5xl font-bold tracking-tight text-foreground">15 840 zł</span>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">Praca ok. 20 godzin tygodniowo</p>

            <div className="mt-6 grid grid-cols-3 gap-4 border-t border-border pt-6">
              {[
                { value: '88', label: 'Lekcje' },
                { value: '4.9', label: 'Śr. ocena' },
                { value: '100%', label: 'Ukończenie' },
              ].map((s) => (
                <div key={s.label} className="text-center">
                  <div className="text-2xl font-bold text-foreground">{s.value}</div>
                  <div className="mt-0.5 text-xs text-muted-foreground">{s.label}</div>
                </div>
              ))}
            </div>

            <div className="mt-6 space-y-3">
              {[
                { name: 'Julia Kamińska', specialty: 'Robotyka przemysłowa', amount: '14 200 zł', color: '#EF4444' },
                { name: 'Tomasz Wójcik', specialty: 'Automatyka przemysłowa', amount: '13 650 zł', color: '#EC4899' },
                { name: 'Marek Kowalski', specialty: 'Programowanie PLC', amount: '12 960 zł', color: '#3B82F6' },
              ].map((t) => (
                <div key={t.name} className="flex items-center justify-between rounded-xl bg-muted/50 px-4 py-3 transition-colors hover:bg-muted">
                  <div className="flex items-center gap-3">
                    <div
                      className="flex h-8 w-8 items-center justify-center rounded-lg text-xs font-bold text-white"
                      style={{ backgroundColor: t.color }}
                      aria-hidden="true"
                    >
                      {t.name.split(' ').map((n) => n[0]).join('')}
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-foreground">{t.name}</p>
                      <p className="text-[11px] text-muted-foreground">{t.specialty}</p>
                    </div>
                  </div>
                  <span className="text-sm font-bold text-[#F4B400]">{t.amount}</span>
                </div>
              ))}
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  )
}
