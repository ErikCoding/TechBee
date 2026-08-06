import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import { getFeaturedTeachers } from '@/services/teachers.service'
import { TeacherCard } from '@/components/shared/teacher-card'
import { Reveal } from '@/components/shared/reveal'

export async function FeaturedTeachersSection() {
  const featuredTeachers = await getFeaturedTeachers()

  return (
    <section className="section-pad bg-[var(--surface)]" id="teachers" aria-labelledby="teachers-heading">
      <div className="mx-auto max-w-7xl px-4 md:px-8">
        {/* Header */}
        <Reveal className="flex flex-col gap-1 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-sm font-semibold text-[#F4B400] uppercase tracking-wide">
              Najlepsi instruktorzy
            </p>
            <h2
              id="teachers-heading"
              className="mt-1 text-3xl font-bold tracking-tight text-foreground text-balance"
            >
              Ucz się od najlepszych w branży
            </h2>
            <p className="mt-2 max-w-xl text-muted-foreground text-balance">
              Każdy nauczyciel przechodzi ręczną weryfikację: sprawdzamy doświadczenie, kompetencje techniczne i lekcję próbną.
            </p>
          </div>
          <Link
            href="/marketplace"
            className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground md:mt-0 shrink-0"
          >
            Przeglądaj wszystkich nauczycieli
            <ArrowRight className="h-4 w-4" />
          </Link>
        </Reveal>

        {/* Cards */}
        <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {featuredTeachers.map((teacher, i) => (
            <Reveal key={teacher.id} delay={i * 80}>
              <TeacherCard teacher={teacher} featured />
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  )
}
