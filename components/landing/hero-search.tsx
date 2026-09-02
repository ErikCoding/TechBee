'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Search, ArrowRight, ChevronDown } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { Category } from '@/lib/types'

interface Props {
  categories: Category[]
  compact?: boolean
}

/**
 * The hero's search bar — the primary way into the catalogue.
 *
 * One pill-shaped control on desktop (query + category + submit,
 * dividers instead of separate boxes) that stacks cleanly on mobile.
 * Both fields are the exact params `/marketplace` already reads, so a
 * search here arrives as a live filter rather than dropping the visitor
 * on an unfiltered list.
 *
 * On mobile the two rows previously had mismatched insets — the query
 * row carried its own `px-3` beyond the form's padding, the
 * category/button row didn't, so the second row's left edge sat closer
 * to the pill border than the first row's. Both rows now share the same
 * horizontal inset so the whole control reads as one centred column.
 */
export function HeroSearch({ categories, compact = false }: Props) {
  const router = useRouter()
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState('')

  function submit(e: React.FormEvent) {
    e.preventDefault()
    const params = new URLSearchParams()
    if (query.trim()) params.set('q', query.trim())
    if (category) params.set('category', category)
    const qs = params.toString()
    router.push(qs ? `/marketplace?${qs}` : '/marketplace')
  }

  return (
    <form
      onSubmit={submit}
      role="search"
      className={[
        'flex w-full flex-col gap-1 rounded-2xl border border-border/90 bg-card/95 p-2.5 shadow-[0_22px_70px_-44px_rgba(0,0,0,0.95)] backdrop-blur transition-all duration-200 focus-within:border-primary/60 focus-within:shadow-[0_24px_80px_-42px_rgba(244,180,0,0.28)] lg:flex-row lg:items-center lg:gap-0 lg:rounded-full lg:p-1.5',
        compact ? 'max-w-xl' : 'max-w-2xl',
      ].join(' ')}
    >
      <div className="flex min-w-0 flex-1 items-center gap-3 px-3 sm:px-4">
        <Search className="h-4.5 w-4.5 shrink-0 text-muted-foreground" aria-hidden="true" />
        <label htmlFor="hero-search" className="sr-only">
          Czego chcesz się nauczyć?
        </label>
        <input
          id="hero-search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Czego chcesz się nauczyć?"
          className="h-12 w-full min-w-0 bg-transparent text-[15px] text-foreground outline-none placeholder:text-muted-foreground/75"
        />
      </div>

      <span className="mx-1 h-px w-full shrink-0 bg-border lg:mx-2 lg:h-7 lg:w-px" aria-hidden="true" />

      <div className="flex items-center gap-2 px-1 lg:shrink-0 lg:px-0">
        <div className="relative min-w-0 flex-1 lg:flex-none">
          <label htmlFor="hero-category" className="sr-only">
            Dziedzina
          </label>
          <select
            id="hero-category"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="h-12 w-full min-w-0 cursor-pointer appearance-none rounded-xl bg-transparent pl-3 pr-8 text-[15px] text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring/40 lg:w-44 lg:rounded-full lg:pl-3"
          >
            <option value="">Wszystkie dziedziny</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <ChevronDown
            className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
        </div>

        <Button
          type="submit"
          className="group h-12 shrink-0 rounded-xl px-6 text-[15px] font-semibold transition-transform duration-300 hover:-translate-y-0.5 lg:rounded-full"
        >
          Szukaj
          <ArrowRight
            className="ml-0.5 h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5"
            aria-hidden="true"
          />
        </Button>
      </div>
    </form>
  )
}
