import type { Teacher } from '@/lib/types'

/**
 * The marketplace's filtering rules, kept out of the components.
 *
 * Every filter below reads a field that already exists on `Teacher` —
 * nothing here is invented to make the sidebar look fuller. The
 * previous marketplace only offered free-text search plus a category,
 * even though the catalogue carries price, rating, weekday availability,
 * language and a verification flag, all of which a student actually
 * chooses on.
 *
 * Pure functions with no React or Firestore involvement, so the same
 * rules can be unit-checked and reused if filtering ever moves
 * server-side.
 */

export const SORT_OPTIONS = [
  { value: 'featured', label: 'Wyróżnieni' },
  { value: 'rating', label: 'Najwyżej oceniani' },
  { value: 'price-asc', label: 'Cena: od najniższej' },
  { value: 'price-desc', label: 'Cena: od najwyższej' },
  { value: 'lessons', label: 'Najwięcej lekcji' },
] as const

export type SortValue = (typeof SORT_OPTIONS)[number]['value']

export const WEEKDAYS = [
  { value: 'Mon', label: 'Pon', full: 'poniedziałek' },
  { value: 'Tue', label: 'Wt', full: 'wtorek' },
  { value: 'Wed', label: 'Śr', full: 'środa' },
  { value: 'Thu', label: 'Czw', full: 'czwartek' },
  { value: 'Fri', label: 'Pt', full: 'piątek' },
  { value: 'Sat', label: 'Sob', full: 'sobota' },
  { value: 'Sun', label: 'Nd', full: 'niedziela' },
] as const

export interface MarketplaceFilters {
  query: string
  category: string | null
  /** Inclusive upper bound on `hourlyRate`; `null` means no cap. */
  maxPrice: number | null
  /** Inclusive lower bound on `rating`; `null` means any. */
  minRating: number | null
  /** Weekday codes as stored on `Teacher.availability`. A teacher matches if available on any selected day. */
  days: string[]
  language: string | null
  verifiedOnly: boolean
  sort: SortValue
}

export const EMPTY_FILTERS: MarketplaceFilters = {
  query: '',
  category: null,
  maxPrice: null,
  minRating: null,
  days: [],
  language: null,
  verifiedOnly: false,
  sort: 'featured',
}

/** Price/language bounds derived from the live catalogue, so controls never offer impossible values. */
export function deriveFacets(teachers: Teacher[]) {
  const rates = teachers.map((t) => t.hourlyRate)
  const languages = [...new Set(teachers.flatMap((t) => t.languages))].sort((a, b) => a.localeCompare(b, 'pl'))
  return {
    minRate: rates.length ? Math.min(...rates) : 0,
    maxRate: rates.length ? Math.max(...rates) : 0,
    languages,
  }
}

/** Everything except sorting — used both for the result list and for per-filter result counts. */
export function applyFilters(teachers: Teacher[], f: MarketplaceFilters): Teacher[] {
  let result = teachers

  if (f.query.trim()) {
    const q = f.query.toLowerCase()
    result = result.filter(
      (t) =>
        t.name.toLowerCase().includes(q) ||
        t.specialty.toLowerCase().includes(q) ||
        t.skills.some((s) => s.toLowerCase().includes(q)),
    )
  }
  if (f.category) result = result.filter((t) => t.categoryId === f.category)
  if (f.maxPrice !== null) result = result.filter((t) => t.hourlyRate <= f.maxPrice!)
  if (f.minRating !== null) result = result.filter((t) => t.rating >= f.minRating!)
  if (f.days.length > 0) result = result.filter((t) => f.days.some((d) => t.availability.includes(d)))
  if (f.language) result = result.filter((t) => t.languages.includes(f.language!))
  if (f.verifiedOnly) result = result.filter((t) => t.verified)

  return result
}

export function sortTeachers(teachers: Teacher[], sort: SortValue): Teacher[] {
  const result = [...teachers]
  switch (sort) {
    case 'rating':
      return result.sort((a, b) => b.rating - a.rating)
    case 'price-asc':
      return result.sort((a, b) => a.hourlyRate - b.hourlyRate)
    case 'price-desc':
      return result.sort((a, b) => b.hourlyRate - a.hourlyRate)
    case 'lessons':
      return result.sort((a, b) => b.lessons - a.lessons)
    default:
      return result.sort((a, b) => (b.featured ? 1 : 0) - (a.featured ? 1 : 0))
  }
}

/** How many filters are narrowing the list — drives the mobile button badge and the "clear all" affordance. */
export function countActiveFilters(f: MarketplaceFilters): number {
  return (
    (f.category ? 1 : 0) +
    (f.maxPrice !== null ? 1 : 0) +
    (f.minRating !== null ? 1 : 0) +
    (f.days.length > 0 ? 1 : 0) +
    (f.language ? 1 : 0) +
    (f.verifiedOnly ? 1 : 0)
  )
}

/**
 * Serialises filters into the URL.
 *
 * `q` and `category` keep the exact names the page already accepted, so
 * existing links from the homepage, the dashboards and the parent
 * "book for this child" flow keep working unchanged; the rest are new
 * and optional. Previously filter state lived only in React, so a
 * filtered view could not be shared, bookmarked, or returned to with
 * the back button.
 */
export function filtersToParams(f: MarketplaceFilters, extra?: Record<string, string>): URLSearchParams {
  const params = new URLSearchParams()
  if (f.query.trim()) params.set('q', f.query.trim())
  if (f.category) params.set('category', f.category)
  if (f.maxPrice !== null) params.set('maxPrice', String(f.maxPrice))
  if (f.minRating !== null) params.set('minRating', String(f.minRating))
  if (f.days.length) params.set('days', f.days.join(','))
  if (f.language) params.set('language', f.language)
  if (f.verifiedOnly) params.set('verified', '1')
  if (f.sort !== 'featured') params.set('sort', f.sort)
  for (const [key, value] of Object.entries(extra ?? {})) params.set(key, value)
  return params
}

export function filtersFromParams(params: {
  q?: string
  category?: string
  maxPrice?: string
  minRating?: string
  days?: string
  language?: string
  verified?: string
  sort?: string
}): MarketplaceFilters {
  const sort = SORT_OPTIONS.find((o) => o.value === params.sort)?.value ?? 'featured'
  return {
    query: params.q ?? '',
    category: params.category ?? null,
    maxPrice: params.maxPrice && !Number.isNaN(Number(params.maxPrice)) ? Number(params.maxPrice) : null,
    minRating: params.minRating && !Number.isNaN(Number(params.minRating)) ? Number(params.minRating) : null,
    days: params.days ? params.days.split(',').filter((d) => WEEKDAYS.some((w) => w.value === d)) : [],
    language: params.language ?? null,
    verifiedOnly: params.verified === '1',
    sort,
  }
}
