'use client'

import { Star, BadgeCheck } from 'lucide-react'
import { Switch } from '@/components/ui/switch'
import { CategoryIcon } from '@/components/shared/category-icon'
import { WEEKDAYS, type MarketplaceFilters } from '@/components/marketplace/marketplace-filters'
import { cn } from '@/lib/utils'
import type { Category } from '@/lib/types'

interface Props {
  filters: MarketplaceFilters
  onChange: (patch: Partial<MarketplaceFilters>) => void
  categories: Category[]
  facets: { minRate: number; maxRate: number; languages: string[] }
  /** Result count per category for the current non-category filters, so a student never picks a dead end. */
  categoryCounts: Record<string, number>
  totalCount: number
}

function Group({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="border-t border-border py-4 first:border-t-0 first:pt-0">
      <h3 className="mb-2.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</h3>
      {children}
    </div>
  )
}

/**
 * The filter controls, rendered identically inside the desktop rail and
 * the mobile sheet.
 *
 * Only fields that exist on `Teacher` are offered. Category rows carry
 * live result counts computed against the *other* active filters, which
 * is what stops the classic marketplace dead end where every remaining
 * option returns nothing.
 */
export function MarketplaceFilterPanel({
  filters,
  onChange,
  categories,
  facets,
  categoryCounts,
  totalCount,
}: Props) {
  const priceValue = filters.maxPrice ?? facets.maxRate

  return (
    <div className="flex flex-col">
      <Group label="Dziedzina">
        <ul className="flex flex-col gap-0.5">
          <li>
            <button
              type="button"
              onClick={() => onChange({ category: null })}
              aria-pressed={filters.category === null}
              className={cn(
                'flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm transition-colors',
                filters.category === null ? 'bg-accent font-medium text-accent-foreground' : 'text-foreground hover:bg-muted',
              )}
            >
              <span className="min-w-0 flex-1 truncate">Wszystkie dziedziny</span>
              <span className="shrink-0 text-xs text-muted-foreground">{totalCount}</span>
            </button>
          </li>
          {categories.map((cat) => {
            const count = categoryCounts[cat.id] ?? 0
            const active = filters.category === cat.id
            return (
              <li key={cat.id}>
                <button
                  type="button"
                  onClick={() => onChange({ category: active ? null : cat.id })}
                  aria-pressed={active}
                  disabled={count === 0 && !active}
                  className={cn(
                    'flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm transition-colors',
                    active ? 'bg-accent font-medium text-accent-foreground' : 'text-foreground hover:bg-muted',
                    count === 0 && !active && 'cursor-not-allowed opacity-40 hover:bg-transparent',
                  )}
                >
                  <span className={cn('flex h-5 w-5 shrink-0 items-center justify-center rounded', cat.colorClass)}>
                    <CategoryIcon name={cat.icon} className="h-3 w-3" />
                  </span>
                  <span className="min-w-0 flex-1 truncate">{cat.name}</span>
                  <span className="shrink-0 text-xs text-muted-foreground">{count}</span>
                </button>
              </li>
            )
          })}
        </ul>
      </Group>

      <Group label="Cena za godzinę">
        <label htmlFor="filter-price" className="sr-only">
          Maksymalna cena za godzinę
        </label>
        <input
          id="filter-price"
          type="range"
          min={facets.minRate}
          max={facets.maxRate}
          step={10}
          value={priceValue}
          onChange={(e) => {
            const next = Number(e.target.value)
            onChange({ maxPrice: next >= facets.maxRate ? null : next })
          }}
          className="w-full accent-primary"
        />
        <div className="mt-1 flex items-center justify-between text-xs text-muted-foreground">
          <span>{facets.minRate} zł</span>
          <span className="font-semibold text-foreground">
            {filters.maxPrice === null ? `do ${facets.maxRate} zł` : `do ${filters.maxPrice} zł`}
          </span>
        </div>
      </Group>

      <Group label="Ocena">
        <div className="flex flex-wrap gap-1.5">
          {[null, 4, 4.5].map((value) => {
            const active = filters.minRating === value
            return (
              <button
                key={String(value)}
                type="button"
                onClick={() => onChange({ minRating: value })}
                aria-pressed={active}
                className={cn(
                  'inline-flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-colors',
                  active ? 'border-primary bg-accent text-accent-foreground' : 'border-border text-foreground hover:bg-muted',
                )}
              >
                {value === null ? (
                  'Każda'
                ) : (
                  <>
                    <Star className="h-3 w-3 fill-primary stroke-none" aria-hidden="true" />
                    {value}+
                  </>
                )}
              </button>
            )
          })}
        </div>
      </Group>

      <Group label="Dostępność">
        <div className="flex flex-wrap gap-1.5">
          {WEEKDAYS.map((day) => {
            const active = filters.days.includes(day.value)
            return (
              <button
                key={day.value}
                type="button"
                onClick={() =>
                  onChange({
                    days: active ? filters.days.filter((d) => d !== day.value) : [...filters.days, day.value],
                  })
                }
                aria-pressed={active}
                aria-label={`Dostępny w dzień: ${day.full}`}
                className={cn(
                  'h-8 w-11 rounded-lg border text-xs font-medium transition-colors',
                  active ? 'border-primary bg-accent text-accent-foreground' : 'border-border text-foreground hover:bg-muted',
                )}
              >
                {day.label}
              </button>
            )
          })}
        </div>
      </Group>

      {facets.languages.length > 1 && (
        <Group label="Język lekcji">
          <div className="flex flex-wrap gap-1.5">
            {facets.languages.map((lang) => {
              const active = filters.language === lang
              return (
                <button
                  key={lang}
                  type="button"
                  onClick={() => onChange({ language: active ? null : lang })}
                  aria-pressed={active}
                  className={cn(
                    'rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-colors',
                    active ? 'border-primary bg-accent text-accent-foreground' : 'border-border text-foreground hover:bg-muted',
                  )}
                >
                  {lang}
                </button>
              )
            })}
          </div>
        </Group>
      )}

      <Group label="Weryfikacja">
        <label
          htmlFor="filter-verified"
          className="flex cursor-pointer items-center justify-between gap-3 rounded-lg py-1"
        >
          <span className="flex items-center gap-2 text-sm text-foreground">
            <BadgeCheck className="h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
            Tylko zweryfikowani
          </span>
          <Switch
            id="filter-verified"
            checked={filters.verifiedOnly}
            onCheckedChange={(checked) => onChange({ verifiedOnly: checked === true })}
            className="shrink-0"
          />
        </label>
      </Group>
    </div>
  )
}
