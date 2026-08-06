import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Reveal } from '@/components/shared/reveal'

export function CtaSection() {
  return (
    <section className="section-pad bg-background" aria-labelledby="cta-heading">
      <div className="mx-auto max-w-7xl px-4 md:px-8">
        <Reveal className="relative overflow-hidden rounded-3xl bg-[#F4B400] px-8 py-14 text-center md:px-16">
          {/* decorative circles */}
          <div className="animate-float pointer-events-none absolute -left-12 -top-12 h-48 w-48 rounded-full bg-white/10" aria-hidden="true" />
          <div className="animate-float-slow pointer-events-none absolute -bottom-16 -right-12 h-64 w-64 rounded-full bg-white/10" aria-hidden="true" />

          <div className="relative">
            <h2
              id="cta-heading"
              className="text-3xl font-bold tracking-tight text-[#0A0A0A] text-balance md:text-4xl"
            >
              Chcesz podnieść swoje umiejętności techniczne?
            </h2>
            <p className="mx-auto mt-3 max-w-xl text-balance text-[#3B2800]/80">
              Dołącz do ponad 8400 inżynierów i techników, którzy co miesiąc uczą się praktycznych umiejętności przemysłowych od zweryfikowanych ekspertów.
            </p>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
              <Link href="/marketplace">
                <Button
                  size="lg"
                  className="bg-[#0A0A0A] text-white hover:bg-[#1A1A1A] font-semibold px-8 transition-transform hover:-translate-y-0.5"
                >
                  Znajdź nauczyciela
                </Button>
              </Link>
              <Link href="/teach">
                <Button
                  size="lg"
                  variant="outline"
                  className="border-[#0A0A0A]/30 bg-transparent text-[#0A0A0A] hover:bg-[#0A0A0A]/10 px-8 font-semibold transition-transform hover:-translate-y-0.5"
                >
                  Ucz na TechBee
                </Button>
              </Link>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  )
}
