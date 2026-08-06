import { Star } from 'lucide-react'
import { getTestimonials } from '@/services/testimonials.service'
import { Reveal } from '@/components/shared/reveal'

export async function TestimonialsSection() {
  const testimonials = await getTestimonials()

  return (
    <section className="section-pad bg-[var(--surface)]" id="reviews" aria-labelledby="reviews-heading">
      <div className="mx-auto max-w-7xl px-4 md:px-8">
        {/* Header */}
        <Reveal className="mx-auto max-w-2xl text-center">
          <p className="text-sm font-semibold text-[#F4B400] uppercase tracking-wide">
            Opinie uczniów
          </p>
          <h2
            id="reviews-heading"
            className="mt-1 text-3xl font-bold tracking-tight text-foreground text-balance"
          >
            Prawdziwi uczniowie, konkretne efekty
          </h2>
          <p className="mt-2 text-muted-foreground text-balance">
            Ponad 6200 zweryfikowanych opinii. 94% uczniów deklaruje mierzalny postęp w pracy po pierwszych 5 lekcjach.
          </p>
        </Reveal>

        {/* Masonry-style grid */}
        <div className="mt-12 columns-1 gap-5 space-y-5 sm:columns-2 lg:columns-3">
          {testimonials.map((t, i) => (
            <Reveal key={t.id} delay={i * 70} className="break-inside-avoid">
              <article className="rounded-2xl border border-border bg-card p-6 shadow-sm transition-shadow hover:shadow-md">
                {/* Stars */}
                <div className="flex gap-0.5" aria-label={`Ocena ${t.rating} na 5 gwiazdek`}>
                  {Array.from({ length: 5 }).map((_, idx) => (
                    <Star
                      key={idx}
                      className={
                        idx < t.rating
                          ? 'h-3.5 w-3.5 fill-[#F4B400] stroke-none'
                          : 'h-3.5 w-3.5 fill-muted stroke-none'
                      }
                      aria-hidden="true"
                    />
                  ))}
                </div>
                {/* Comment */}
                <blockquote className="mt-3 text-sm leading-relaxed text-foreground">
                  &ldquo;{t.comment}&rdquo;
                </blockquote>
                {/* Author */}
                <div className="mt-4 flex items-center gap-3">
                  <div
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white"
                    style={{ backgroundColor: t.avatarColor }}
                    aria-hidden="true"
                  >
                    {t.initials}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-foreground">{t.name}</p>
                    <p className="text-xs text-muted-foreground">{t.role}</p>
                  </div>
                </div>
                {/* Teacher tag */}
                <div className="mt-3 flex items-center gap-1.5 rounded-lg bg-muted px-3 py-1.5 text-xs text-muted-foreground">
                  <span className="text-foreground font-medium">{t.teacherName}</span>
                  <span>·</span>
                  <span>{t.specialty}</span>
                </div>
              </article>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  )
}
