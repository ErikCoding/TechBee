import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import { getCategories } from '@/services/categories.service'
import { CategoryCard } from '@/components/shared/category-card'
import { Reveal } from '@/components/shared/reveal'

export async function CategoriesSection() {
  const categories = await getCategories()

  return (
    <section className="section-pad bg-background" id="categories" aria-labelledby="categories-heading">
      <div className="mx-auto max-w-7xl px-4 md:px-8">
        {/* Header */}
        <Reveal className="flex flex-col gap-1 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-sm font-semibold text-[#F4B400] uppercase tracking-wide">
              Specjalizacje
            </p>
            <h2
              id="categories-heading"
              className="mt-1 text-3xl font-bold tracking-tight text-foreground text-balance"
            >
              Wszystkie kluczowe dziedziny techniczne
            </h2>
            <p className="mt-2 text-muted-foreground max-w-xl text-balance">
              Od programowania PLC po hydraulikę i pneumatykę — znajdź dokładnie tę umiejętność przemysłową, której potrzebujesz.
            </p>
          </div>
          <Link
            href="/marketplace"
            className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground md:mt-0 shrink-0"
          >
            Zobacz wszystkie specjalizacje
            <ArrowRight className="h-4 w-4" />
          </Link>
        </Reveal>

        {/* Grid */}
        <div className="mt-10 grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
          {categories.map((cat, i) => (
            <Reveal key={cat.id} delay={i * 60}>
              <CategoryCard category={cat} />
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  )
}
