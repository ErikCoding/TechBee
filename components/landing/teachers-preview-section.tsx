import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { TeacherCard } from '@/components/shared/teacher-card'
import { getFeaturedTeachers, getTeachers } from '@/services/teachers.service'
import { Reveal } from '@/components/shared/reveal'

/**
 * A slice of the real marketplace, rendered with the marketplace's own
 * `TeacherCard`.
 *
 * Reusing the component rather than restyling one for the landing page
 * is the point: what a visitor compares here — rating, rate,
 * availability, specialisation — is exactly what they will compare one
 * click later, so the transition to `/marketplace` has no seam.
 *
 * Three cards, because that is the marketplace's own desktop column
 * count and because it is enough to show variety without turning the
 * section into a listing page.
 */
export async function TeachersPreviewSection() {
  const [teachers, featured] = await Promise.all([getTeachers(), getFeaturedTeachers()])
  const preview = (featured.length >= 3 ? featured : teachers).slice(0, 3)
  if (preview.length === 0) return null

  return (
    <section className="border-b border-border bg-background" id="teachers" aria-labelledby="teachers-heading">
      <div className="mx-auto max-w-7xl px-4 py-16 md:px-8 md:py-24">
        {/* Stacks until lg: at 768 the intro paragraph and the button were
            competing for the same line and left the text two words wide. */}
        <Reveal className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-xl">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Nauczyciele
            </p>
            <h2
              id="teachers-heading"
              className="mt-3 text-balance text-2xl font-bold leading-tight tracking-tight text-foreground sm:text-3xl"
            >
              Praktycy, nie wykładowcy
            </h2>
            <p className="mt-3 text-balance leading-relaxed text-muted-foreground">
              Każdy profil przechodzi ręczną weryfikację doświadczenia zawodowego, zanim trafi
              na giełdę.
            </p>
          </div>

          <Link href="/marketplace" className="shrink-0">
            <Button variant="outline" className="group h-10 px-5">
              Zobacz wszystkich
              <ArrowRight
                className="ml-1 h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5"
                aria-hidden="true"
              />
            </Button>
          </Link>
        </Reveal>

        <ul className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {preview.map((teacher, i) => (
            /* `min-w-0` matters: grid items default to `min-width: auto`,
               and the card's `truncate` skill line is `white-space: nowrap`,
               so its min-content width pushed the cell past the viewport at
               375px. Capping the item lets the ellipsis do its job. */
            <Reveal as="li" key={teacher.id} delay={i * 90} className="flex min-w-0">
              <TeacherCard
                teacher={teacher}
                featured={teacher.featured}
                className="w-full bg-card/90 shadow-[0_18px_60px_-42px_rgba(0,0,0,0.9)]"
              />
            </Reveal>
          ))}
        </ul>
      </div>
    </section>
  )
}
