'use client'

import { useState, useMemo } from 'react'
import { Search, SlidersHorizontal, X } from 'lucide-react'
import { TeacherCard } from '@/components/shared/teacher-card'
import { CategoryCard } from '@/components/shared/category-card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { Category, Teacher } from '@/lib/types'

const sortOptions = [
  { value: 'featured', label: 'Wyróżnieni' },
  { value: 'rating', label: 'Najwyżej oceniani' },
  { value: 'price-asc', label: 'Cena: od najniższej' },
  { value: 'price-desc', label: 'Cena: od najwyższej' },
  { value: 'lessons', label: 'Najwięcej lekcji' },
]

interface MarketplaceClientProps {
  teachers: Teacher[]
  categories: Category[]
  initialQuery?: string
  initialCategory?: string
}

export function MarketplaceClient({ teachers, categories, initialQuery = '', initialCategory }: MarketplaceClientProps) {
  const [query, setQuery] = useState(initialQuery)
  const [selectedCategory, setSelectedCategory] = useState<string | null>(initialCategory ?? null)
  const [sortBy, setSortBy] = useState('featured')
  const [showFilters, setShowFilters] = useState(false)

  const filtered = useMemo(() => {
    let result = [...teachers]
    if (query.trim()) {
      const q = query.toLowerCase()
      result = result.filter(
        (t) =>
          t.name.toLowerCase().includes(q) ||
          t.specialty.toLowerCase().includes(q) ||
          t.skills.some((s) => s.toLowerCase().includes(q)),
      )
    }
    if (selectedCategory) {
      result = result.filter((t) => t.categoryId === selectedCategory)
    }
    switch (sortBy) {
      case 'rating':
        result.sort((a, b) => b.rating - a.rating)
        break
      case 'price-asc':
        result.sort((a, b) => a.hourlyRate - b.hourlyRate)
        break
      case 'price-desc':
        result.sort((a, b) => b.hourlyRate - a.hourlyRate)
        break
      case 'lessons':
        result.sort((a, b) => b.lessons - a.lessons)
        break
      default:
        result.sort((a, b) => (b.featured ? 1 : 0) - (a.featured ? 1 : 0))
    }
    return result
  }, [teachers, query, selectedCategory, sortBy])

  return (
    <>
      {/* Page header */}
      <div className="border-b border-border bg-card">
        <div className="mx-auto max-w-7xl px-4 py-10 md:px-8">
          <h1 className="text-3xl font-bold tracking-tight text-foreground">
            Znajdź eksperta technicznego
          </h1>
          <p className="mt-1 text-muted-foreground">
            {teachers.length} zweryfikowanych specjalistów w {categories.length} dziedzinach przemysłowych
          </p>

          {/* Search + filter bar */}
          <div className="mt-5 flex gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Szukaj umiejętności, programu lub nazwiska nauczyciela..."
                className="pl-9"
                aria-label="Szukaj nauczycieli"
              />
            </div>
            <Button
              variant="outline"
              onClick={() => setShowFilters(!showFilters)}
              className={cn(showFilters && 'border-[#F4B400] text-[#F4B400]')}
            >
              <SlidersHorizontal className="mr-2 h-4 w-4" />
              Filtry
            </Button>
          </div>

          {/* Sort pills */}
          <div className="mt-3 flex flex-wrap gap-2">
            {sortOptions.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setSortBy(opt.value)}
                className={cn(
                  'rounded-full border px-3.5 py-1 text-xs font-medium transition-colors',
                  sortBy === opt.value
                    ? 'border-[#F4B400] bg-[#FEF3C7] text-[#78350F] dark:bg-[#3B2800] dark:text-[#FBBF24]'
                    : 'border-border text-muted-foreground hover:border-foreground/30 hover:text-foreground',
                )}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-4 py-8 md:px-8">
        {/* Category chips */}
        <div className="mb-6 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setSelectedCategory(null)}
            className={cn(
              'inline-flex items-center rounded-full border px-4 py-1.5 text-xs font-medium transition-colors',
              selectedCategory === null
                ? 'border-[#F4B400] bg-[#FEF3C7] text-[#78350F] dark:bg-[#3B2800] dark:text-[#FBBF24]'
                : 'border-border text-muted-foreground hover:text-foreground',
            )}
          >
            Wszystkie specjalizacje
          </button>
          {categories.map((cat) => (
            <button
              key={cat.id}
              type="button"
              onClick={() => setSelectedCategory(cat.id === selectedCategory ? null : cat.id)}
              className={cn(
                'inline-flex items-center gap-1.5 rounded-full border px-4 py-1.5 text-xs font-medium transition-colors',
                selectedCategory === cat.id
                  ? 'border-[#F4B400] bg-[#FEF3C7] text-[#78350F] dark:bg-[#3B2800] dark:text-[#FBBF24]'
                  : 'border-border text-muted-foreground hover:text-foreground',
              )}
            >
              {cat.name}
              {selectedCategory === cat.id && (
                <X className="h-3 w-3" aria-hidden="true" />
              )}
            </button>
          ))}
        </div>

        {/* Results header */}
        <div className="mb-5 flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Znaleziono <span className="font-semibold text-foreground">{filtered.length}</span> nauczycieli
          </p>
          {(query || selectedCategory) && (
            <button
              type="button"
              onClick={() => { setQuery(''); setSelectedCategory(null) }}
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
            >
              <X className="h-3 w-3" />
              Wyczyść filtry
            </button>
          )}
        </div>

        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <p className="text-lg font-semibold text-foreground">Nie znaleziono nauczycieli</p>
            <p className="mt-1 text-sm text-muted-foreground">Spróbuj zmienić wyszukiwanie lub filtry.</p>
            <Button
              variant="outline"
              className="mt-4"
              onClick={() => { setQuery(''); setSelectedCategory(null) }}
            >
              Wyczyść wszystkie filtry
            </Button>
          </div>
        ) : (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {filtered.map((teacher, i) => (
              <div key={teacher.id} className="animate-fade-in-up" style={{ animationDelay: `${Math.min(i, 8) * 50}ms` }}>
                <TeacherCard teacher={teacher} featured={teacher.featured} />
              </div>
            ))}
          </div>
        )}

        {/* Browse by category */}
        {!query && !selectedCategory && (
          <div className="mt-16">
            <h2 className="text-xl font-bold text-foreground">Przeglądaj według specjalizacji</h2>
            <div className="mt-5 grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
              {categories.map((cat) => (
                <CategoryCard key={cat.id} category={cat} />
              ))}
            </div>
          </div>
        )}
      </div>
    </>
  )
}
