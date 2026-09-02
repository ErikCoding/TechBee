'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Search, SlidersHorizontal, X, SearchX, ChevronDown } from 'lucide-react'
import { TeacherCard } from '@/components/shared/teacher-card'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogBody, DialogFooter } from '@/components/ui/dialog'
import { MarketplaceFilterPanel } from '@/components/marketplace/marketplace-filter-panel'
import {
  applyFilters, sortTeachers, countActiveFilters, deriveFacets, filtersToParams,
  EMPTY_FILTERS, SORT_OPTIONS, WEEKDAYS,
  type MarketplaceFilters,
} from '@/components/marketplace/marketplace-filters'
import type { Category, Teacher } from '@/lib/types'

interface MarketplaceClientProps {
  teachers: Teacher[]
  categories: Category[]
  initialFilters: MarketplaceFilters
  /** Set when a parent arrived from their dashboard's "Zarezerwuj lekcję" button for a linked student — carried through to each teacher's profile link so the booking flow knows who it's for. */
  bookingFor?: { id: string; name: string }
}

/**
 * Teacher discovery.
 *
 * The previous marketplace was a page header with a search box, a row of
 * category chips, a sort dropdown, and a grid — filtering by category or
 * free text only, even though the catalogue carries price, rating,
 * availability, language and verification. Filter state lived purely in
 * React, so a filtered view could not be linked, bookmarked or reached
 * with the back button, and the sole empty state offered one blunt
 * "clear everything" button.
 *
 * Now: a sticky search band that stays reachable while scrolling, a
 * persistent filter rail on desktop, the same controls in a sheet on
 * mobile (where permanent filters would eat the results), removable
 * chips for whatever is currently narrowing the list, and URL-synced
 * state throughout.
 */
export function MarketplaceClient({ teachers, categories, initialFilters, bookingFor }: MarketplaceClientProps) {
  const router = useRouter()
  const [filters, setFilters] = useState<MarketplaceFilters>(initialFilters)
  const [sheetOpen, setSheetOpen] = useState(false)

  const facets = useMemo(() => deriveFacets(teachers), [teachers])

  // Keep the URL in step with the controls so a filtered view is shareable
  // and the back button works. `replace` avoids stacking a history entry
  // per keystroke; the booking-for params ride along untouched.
  useEffect(() => {
    const extra = bookingFor
      ? { bookingForId: bookingFor.id, bookingForName: bookingFor.name }
      : undefined
    const qs = filtersToParams(filters, extra).toString()
    router.replace(qs ? `/marketplace?${qs}` : '/marketplace', { scroll: false })
  }, [filters, bookingFor, router])

  const update = useCallback((patch: Partial<MarketplaceFilters>) => {
    setFilters((prev) => ({ ...prev, ...patch }))
  }, [])

  const results = useMemo(
    () => sortTeachers(applyFilters(teachers, filters), filters.sort),
    [teachers, filters],
  )

  /** Counts for each category under the *other* active filters, so options that would return nothing are visibly dead. */
  const categoryCounts = useMemo(() => {
    const withoutCategory = applyFilters(teachers, { ...filters, category: null })
    const counts: Record<string, number> = {}
    for (const cat of categories) {
      counts[cat.id] = withoutCategory.filter((t) => t.categoryId === cat.id).length
    }
    return counts
  }, [teachers, categories, filters, categories.length])

  const totalUnfilteredByCategory = useMemo(
    () => applyFilters(teachers, { ...filters, category: null }).length,
    [teachers, filters],
  )

  const activeCount = countActiveFilters(filters)
  const activeCategory = categories.find((c) => c.id === filters.category)

  /** One removable chip per narrowing filter — lets a student undo the specific thing that emptied the list. */
  const chips: { key: string; label: string; clear: () => void }[] = [
    ...(activeCategory ? [{ key: 'cat', label: activeCategory.name, clear: () => update({ category: null }) }] : []),
    ...(filters.maxPrice !== null
      ? [{ key: 'price', label: `do ${filters.maxPrice} zł/godz.`, clear: () => update({ maxPrice: null }) }]
      : []),
    ...(filters.minRating !== null
      ? [{ key: 'rating', label: `ocena ${filters.minRating}+`, clear: () => update({ minRating: null }) }]
      : []),
    ...(filters.days.length
      ? [{
          key: 'days',
          label: filters.days.map((d) => WEEKDAYS.find((w) => w.value === d)?.label ?? d).join(', '),
          clear: () => update({ days: [] }),
        }]
      : []),
    ...(filters.language ? [{ key: 'lang', label: filters.language, clear: () => update({ language: null }) }] : []),
    ...(filters.verifiedOnly
      ? [{ key: 'verified', label: 'zweryfikowani', clear: () => update({ verifiedOnly: false }) }]
      : []),
  ]

  function resetAll() {
    setFilters({ ...EMPTY_FILTERS, sort: filters.sort })
  }

  const filterPanel = (
    <MarketplaceFilterPanel
      filters={filters}
      onChange={update}
      categories={categories}
      facets={facets}
      categoryCounts={categoryCounts}
      totalCount={totalUnfilteredByCategory}
    />
  )

  return (
    <>
      {/* ── Search band: sticks under the navbar so search is never scrolled away ── */}
      <div className="sticky top-[57px] z-30 border-b border-border bg-background/95 backdrop-blur">
        <div className="mx-auto max-w-7xl px-4 py-3 md:px-8">
          {bookingFor && (
            <div className="mb-2.5 inline-flex items-center gap-1.5 rounded-full border border-primary/40 bg-accent px-3 py-1 text-xs font-medium text-accent-foreground">
              Rezerwujesz lekcję dla: {bookingFor.name}
            </div>
          )}

          <div className="flex items-center gap-2">
            <div className="relative min-w-0 flex-1">
              <Search
                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
                aria-hidden="true"
              />
              <label htmlFor="marketplace-search" className="sr-only">
                Szukaj nauczycieli
              </label>
              <input
                id="marketplace-search"
                value={filters.query}
                onChange={(e) => update({ query: e.target.value })}
                placeholder="Szukaj umiejętności, programu lub nazwiska…"
                className="h-10 w-full rounded-xl border border-border bg-card pl-9 pr-9 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground focus-visible:border-primary/60 focus-visible:ring-3 focus-visible:ring-ring/25"
              />
              {filters.query && (
                <button
                  type="button"
                  onClick={() => update({ query: '' })}
                  aria-label="Wyczyść wyszukiwanie"
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground transition-colors hover:text-foreground"
                >
                  <X className="h-3.5 w-3.5" aria-hidden="true" />
                </button>
              )}
            </div>

            {/* Filters live in a sheet on mobile; the rail covers desktop. */}
            <Button
              type="button"
              variant="outline"
              onClick={() => setSheetOpen(true)}
              className="h-10 shrink-0 lg:hidden"
            >
              <SlidersHorizontal className="h-4 w-4" aria-hidden="true" />
              Filtry
              {activeCount > 0 && (
                <span className="ml-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-[10px] font-bold text-primary-foreground">
                  {activeCount}
                </span>
              )}
            </Button>

            <div className="relative hidden shrink-0 sm:block">
              <label htmlFor="marketplace-sort" className="sr-only">
                Sortuj wyniki
              </label>
              <select
                id="marketplace-sort"
                value={filters.sort}
                onChange={(e) => update({ sort: e.target.value as MarketplaceFilters['sort'] })}
                className="h-10 cursor-pointer appearance-none rounded-xl border border-border bg-card pl-3 pr-8 text-sm text-foreground outline-none transition-colors focus-visible:border-primary/60 focus-visible:ring-3 focus-visible:ring-ring/25"
              >
                {SORT_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
              <ChevronDown
                className="pointer-events-none absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground"
                aria-hidden="true"
              />
            </div>
          </div>

          {/* Active filters, each individually removable. */}
          {chips.length > 0 && (
            <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
              {chips.map((chip) => (
                <button
                  key={chip.key}
                  type="button"
                  onClick={chip.clear}
                  className="group inline-flex items-center gap-1 rounded-full border border-primary/40 bg-accent px-2.5 py-1 text-xs font-medium text-accent-foreground transition-colors hover:border-primary"
                >
                  {chip.label}
                  <X className="h-3 w-3 opacity-60 transition-opacity group-hover:opacity-100" aria-hidden="true" />
                </button>
              ))}
              <button
                type="button"
                onClick={resetAll}
                className="rounded px-1.5 py-1 text-xs text-muted-foreground underline decoration-border underline-offset-4 transition-colors hover:text-foreground"
              >
                Wyczyść wszystko
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-4 py-6 md:px-8">
        <div className="grid gap-8 lg:grid-cols-[240px_minmax(0,1fr)] lg:gap-10">
          {/* ── Desktop filter rail ── */}
          <aside className="hidden lg:block">
            <div className="sticky top-[125px]">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-sm font-semibold text-foreground">Filtry</h2>
                {activeCount > 0 && (
                  <button
                    type="button"
                    onClick={resetAll}
                    className="rounded text-xs text-muted-foreground transition-colors hover:text-foreground"
                  >
                    Wyczyść
                  </button>
                )}
              </div>
              {filterPanel}
            </div>
          </aside>

          {/* ── Results ── */}
          <div className="min-w-0">
            <div className="mb-4 flex items-center justify-between gap-3">
              <p className="text-sm text-muted-foreground">
                <span className="font-semibold text-foreground">{results.length}</span>{' '}
                {results.length === 1 ? 'nauczyciel' : 'nauczycieli'}
                {activeCategory ? ` w dziedzinie ${activeCategory.name}` : ''}
              </p>
              {/* Sort is hidden in the band on the narrowest screens — surfaced here instead. */}
              <div className="relative sm:hidden">
                <label htmlFor="marketplace-sort-mobile" className="sr-only">
                  Sortuj wyniki
                </label>
                <select
                  id="marketplace-sort-mobile"
                  value={filters.sort}
                  onChange={(e) => update({ sort: e.target.value as MarketplaceFilters['sort'] })}
                  className="h-8 cursor-pointer appearance-none rounded-lg border border-border bg-card pl-2.5 pr-7 text-xs text-foreground outline-none"
                >
                  {SORT_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
                <ChevronDown
                  className="pointer-events-none absolute right-2 top-1/2 h-3 w-3 -translate-y-1/2 text-muted-foreground"
                  aria-hidden="true"
                />
              </div>
            </div>

            {results.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-border bg-card px-6 py-14 text-center">
                <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-muted">
                  <SearchX className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
                </div>
                <h3 className="mt-3 text-base font-semibold text-foreground">Brak nauczycieli dla tych kryteriów</h3>
                <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">
                  {chips.length > 0
                    ? 'Spróbuj poluzować jeden z filtrów — możesz usunąć je pojedynczo poniżej.'
                    : 'Spróbuj innego hasła — szukamy w nazwiskach, specjalizacjach i umiejętnościach.'}
                </p>

                {/* Recovery: remove one constraint at a time rather than starting over. */}
                {chips.length > 0 && (
                  <div className="mt-5 flex flex-wrap justify-center gap-1.5">
                    {chips.map((chip) => (
                      <button
                        key={chip.key}
                        type="button"
                        onClick={chip.clear}
                        className="group inline-flex items-center gap-1 rounded-full border border-border bg-background px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:border-primary/50"
                      >
                        Usuń: {chip.label}
                        <X className="h-3 w-3 opacity-60 transition-opacity group-hover:opacity-100" aria-hidden="true" />
                      </button>
                    ))}
                  </div>
                )}

                <Button variant="outline" onClick={resetAll} className="mt-5">
                  Wyczyść wszystkie filtry
                </Button>
              </div>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {results.map((teacher, i) => (
                  <div
                    key={teacher.id}
                    className="animate-fade-in-up"
                    style={{ animationDelay: `${Math.min(i, 8) * 40}ms` }}
                  >
                    <TeacherCard teacher={teacher} featured={teacher.featured} bookingFor={bookingFor} className="h-full" />
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Mobile filter sheet ── */}
      {sheetOpen && (
        <Dialog open onOpenChange={(open) => { if (!open) setSheetOpen(false) }}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Filtry</DialogTitle>
            </DialogHeader>
            <DialogBody>{filterPanel}</DialogBody>
            <DialogFooter>
              <div className="flex w-full gap-2">
                <Button variant="outline" onClick={resetAll} className="flex-1" disabled={activeCount === 0}>
                  Wyczyść
                </Button>
                <Button onClick={() => setSheetOpen(false)} className="flex-1 font-semibold">
                  Pokaż {results.length} {results.length === 1 ? 'wynik' : 'wyników'}
                </Button>
              </div>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </>
  )
}
