import { Reveal } from '@/components/shared/reveal'
import { AnimatedCounter } from '@/components/shared/animated-counter'

const stats = [
  { value: 300, suffix: '+', label: 'Zweryfikowani nauczyciele', description: 'Certyfikowani profesjonaliści z przemysłu' },
  { value: 8400, suffix: '+', label: 'Aktywni uczniowie', description: 'Uczą się każdego miesiąca' },
  { value: 47000, suffix: '+', label: 'Zrealizowane lekcje', description: 'Od startu platformy' },
  { value: 4.9, suffix: '', label: 'Średnia ocena', description: 'Wśród wszystkich nauczycieli', decimal: true },
]

export function StatsSection() {
  return (
    <section className="border-y border-border bg-card">
      <div className="mx-auto max-w-7xl px-4 py-12 md:px-8">
        <dl className="grid grid-cols-2 gap-8 md:grid-cols-4">
          {stats.map((stat, i) => (
            <Reveal key={stat.label} delay={i * 80} className="flex flex-col gap-1 text-center">
              <dt className="text-3xl font-bold tracking-tight text-foreground md:text-4xl">
                {stat.decimal ? (
                  stat.value.toFixed(1)
                ) : (
                  <AnimatedCounter value={stat.value} suffix={stat.suffix} />
                )}
              </dt>
              <dd className="text-sm font-semibold text-foreground">{stat.label}</dd>
              <dd className="text-xs text-muted-foreground">{stat.description}</dd>
            </Reveal>
          ))}
        </dl>
      </div>
    </section>
  )
}
