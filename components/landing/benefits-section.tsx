import { BadgeCheck, ShieldCheck, Wallet, Users, Star, Layers } from 'lucide-react'
import { PLATFORM_COMMISSION_PERCENT } from '@/lib/stripe-config'
import { Reveal } from '@/components/shared/reveal'
import { getTeachers } from '@/services/teachers.service'
import { getCategories } from '@/services/categories.service'

/**
 * Why use Runbee — four real advantages, no more.
 *
 * Each one maps to something the product actually does: manual profile
 * verification before publication, the report-confirmation step that
 * gates the Stripe transfer, per-lesson pricing with no subscription,
 * and the parent account with its own oversight of a linked student.
 * Nothing here describes a feature that does not exist.
 *
 * The section used to be a plain two-column list of hairline-divided
 * rows — readable, but flat, and cramped against its neighbours. It now
 * runs on the same `section-pad` rhythm as the rest of the page (more
 * air top and bottom), and the benefits sit as individually padded cards
 * with an icon badge rather than a bare bullet, next to a small stat
 * panel built from the same live catalogue the hero counts from — real
 * numbers, not a decorative illustration.
 *
 * The softer dark surface separates this from the teacher cards without
 * adding decorative background texture.
 */
const benefits = [
  {
    icon: BadgeCheck,
    title: 'Zweryfikowani praktycy',
    description:
      'Każdy nauczyciel przechodzi ręczną weryfikację doświadczenia przemysłowego, zanim jego profil trafi na giełdę.',
  },
  {
    icon: ShieldCheck,
    title: 'Płacisz za zrealizowaną lekcję',
    description:
      'Nauczyciel otrzymuje środki dopiero po tym, jak potwierdzisz raport z lekcji. Jeśli coś się nie zgadza — możesz go zakwestionować.',
  },
  {
    icon: Wallet,
    title: 'Bez abonamentu',
    description: `Płacisz za pojedynczą lekcję, bez umów i minimum godzin. Prowizja platformy to ${PLATFORM_COMMISSION_PERCENT}% i jest wliczona w cenę.`,
  },
  {
    icon: Users,
    title: 'Konto dla rodzica',
    description:
      'Rodzic może połączyć się z kontem ucznia, rezerwować i opłacać lekcje oraz zatwierdzać raporty w jego imieniu.',
  },
]

export async function BenefitsSection() {
  const [teachers, categories] = await Promise.all([getTeachers(), getCategories()])
  const verifiedCount = teachers.filter((t) => t.verified).length
  const avgRating = teachers.length
    ? teachers.reduce((sum, t) => sum + t.rating, 0) / teachers.length
    : 0

  const stats = [
    { icon: BadgeCheck, value: String(verifiedCount), label: 'zweryfikowanych nauczycieli' },
    { icon: Star, value: avgRating.toFixed(1), label: 'średnia ocena na giełdzie' },
    { icon: Layers, value: String(categories.length), label: 'dziedzin technicznych' },
  ]

  return (
    <section
      className="section-pad relative isolate overflow-hidden border-b border-border bg-[var(--surface)]"
      aria-labelledby="benefits-heading"
    >
      <div className="relative mx-auto max-w-7xl px-4 md:px-8">
        <Reveal className="max-w-2xl">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Dlaczego Runbee
          </p>
          <h2
            id="benefits-heading"
            className="mt-3 text-balance text-2xl font-bold leading-tight tracking-tight text-foreground sm:text-3xl"
          >
            Zbudowane wokół zaufania do nauczyciela
          </h2>
          <p className="mt-4 leading-relaxed text-muted-foreground">
            Minimalna liczba obietnic, maksymalnie konkretny proces: weryfikacja profili, płatność za lekcję i czytelny raport po spotkaniu.
          </p>
        </Reveal>

        <div className="mt-12 grid gap-6 lg:grid-cols-[minmax(0,21rem)_minmax(0,1fr)] lg:gap-8">
          {/* Stat panel — the app's own panel vocabulary, real numbers. */}
          <Reveal className="lg:sticky lg:top-24 lg:self-start">
            <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-[0_24px_80px_-56px_rgba(0,0,0,0.95)]">
              <div className="border-b border-border bg-background/45 px-5 py-4">
                <h3 className="text-sm font-semibold text-foreground">Runbee w liczbach</h3>
              </div>
              <dl className="divide-y divide-border">
                {stats.map((stat) => {
                  const Icon = stat.icon
                  return (
                    <div key={stat.label} className="flex items-center gap-3.5 px-5 py-4">
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-accent text-accent-foreground">
                        <Icon className="h-4 w-4" aria-hidden="true" />
                      </span>
                      <div className="min-w-0">
                        <dd className="text-lg font-bold leading-none tabular-nums text-foreground">
                          {stat.value}
                        </dd>
                        <dt className="mt-1 text-xs leading-snug text-muted-foreground">{stat.label}</dt>
                      </div>
                    </div>
                  )
                })}
              </dl>
            </div>
          </Reveal>

          {/* Benefit cards — padded, with an icon badge, breathing room between them. */}
          <div className="grid gap-4 sm:grid-cols-2">
            {benefits.map((benefit, i) => {
              const Icon = benefit.icon
              return (
                <Reveal
                  key={benefit.title}
                  delay={(i % 2) * 90}
                  className="group h-full rounded-2xl border border-border bg-card p-5 shadow-[0_24px_80px_-58px_rgba(0,0,0,0.95)] transition-colors duration-200 hover:border-primary/40"
                >
                  <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent text-accent-foreground transition-colors duration-200 group-hover:bg-primary group-hover:text-primary-foreground">
                    <Icon className="h-4.5 w-4.5" aria-hidden="true" />
                  </span>
                  <h3 className="mt-4 text-base font-semibold text-foreground">{benefit.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                    {benefit.description}
                  </p>
                </Reveal>
              )
            })}
          </div>
        </div>
      </div>
    </section>
  )
}
