'use client'

import Link from 'next/link'
import { Search, ArrowRight, Star, Bot } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useRouter } from 'next/navigation'
import { useState } from 'react'

const popularSearches = ['PLC Siemens', 'SolidWorks', 'G-code CNC', 'robotyka KUKA']

const avatarColors = ['#3B82F6', '#10B981', '#8B5CF6', '#EF4444', '#0EA5E9']
const avatarInitials = ['MK', 'AW', 'KZ', 'JK', 'RN']

export function HeroSection() {
  const router = useRouter()
  const [query, setQuery] = useState('')

  function handleSearch(e: React.FormEvent) {
    e.preventDefault()
    if (query.trim()) {
      router.push(`/marketplace?q=${encodeURIComponent(query.trim())}`)
    } else {
      router.push('/marketplace')
    }
  }

  return (
    <section className="relative overflow-hidden bg-background pb-16 pt-28 md:pb-20 md:pt-32">
      {/* ── Soft single-gradient backdrop — one calm glow, no grid texture, no animation ── */}
      <div className="pointer-events-none absolute inset-0 -z-10" aria-hidden="true">
        <div
          className="absolute -top-1/3 left-1/2 h-[120%] w-[120%] -translate-x-1/2 opacity-[0.10] blur-3xl dark:opacity-[0.16]"
          style={{
            background: 'radial-gradient(40% 40% at 50% 30%, #F4B400 0%, transparent 65%)',
          }}
        />
      </div>

      <div className="relative mx-auto max-w-3xl px-4 text-center md:px-8">
        {/* Eyebrow badge */}
        <div className="animate-fade-in-up inline-flex items-center gap-2 rounded-full border border-[#F4B400]/30 bg-[#FEF3C7]/80 px-4 py-1.5 dark:bg-[#3B2800]/60">
          <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-[#F4B400]" />
          <span className="text-xs font-semibold text-[#78350F] dark:text-[#FBBF24]">
            300+ zweryfikowanych specjalistów technicznych
          </span>
        </div>

        {/* Headline */}
        <h1 className="animate-fade-in-up mt-6 text-balance text-4xl font-bold leading-[1.1] tracking-tight text-foreground md:text-5xl" style={{ animationDelay: '80ms' }}>
          Ucz się praktycznych umiejętności przemysłowych od{' '}
          <span className="text-[#F4B400]">certyfikowanych ekspertów</span>
        </h1>

        {/* Subtitle */}
        <p className="animate-fade-in-up mx-auto mt-4 max-w-xl text-balance text-base leading-relaxed text-muted-foreground" style={{ animationDelay: '140ms' }}>
          PLC, CNC, CAD, robotyka i automatyka — indywidualne lekcje online prowadzone przez inżynierów z realnym doświadczeniem produkcyjnym.
        </p>

        {/* Search bar */}
        <form
          onSubmit={handleSearch}
          className="animate-fade-in-up mx-auto mt-7 flex max-w-lg items-center gap-2 rounded-2xl border border-border bg-card p-2 shadow-sm transition-shadow focus-within:shadow-md"
          style={{ animationDelay: '200ms' }}
          role="search"
        >
          <Search className="ml-2 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Szukaj umiejętności, programu lub nauczyciela..."
            className="flex-1 border-0 bg-transparent text-sm shadow-none focus-visible:ring-0 focus-visible:ring-offset-0"
            aria-label="Szukaj umiejętności technicznej lub nauczyciela"
          />
          <Button
            type="submit"
            className="group bg-[#F4B400] text-[#0A0A0A] hover:bg-[#FBBF24] font-semibold shrink-0"
          >
            Szukaj
            <ArrowRight className="ml-1 h-4 w-4 transition-transform group-hover:translate-x-0.5" />
          </Button>
        </form>

        {/* Popular searches */}
        <div className="animate-fade-in-up mt-4 flex flex-wrap items-center justify-center gap-2" style={{ animationDelay: '240ms' }}>
          <span className="text-xs text-muted-foreground">Popularne:</span>
          {popularSearches.map((term) => (
            <button
              key={term}
              type="button"
              onClick={() => router.push(`/marketplace?q=${encodeURIComponent(term)}`)}
              className="rounded-full border border-border px-3 py-1 text-xs text-muted-foreground transition-colors hover:border-[#F4B400]/50 hover:text-foreground"
            >
              {term}
            </button>
          ))}
        </div>

        {/* CTA links */}
        <div className="animate-fade-in-up mt-8 flex flex-wrap items-center justify-center gap-3" style={{ animationDelay: '300ms' }}>
          <Link href="/marketplace">
            <Button
              size="lg"
              className="bg-[#F4B400] text-[#0A0A0A] hover:bg-[#FBBF24] font-semibold px-8 shadow-sm"
            >
              Przeglądaj nauczycieli
            </Button>
          </Link>
          <Link href="/teach">
            <Button size="lg" variant="outline" className="px-8">
              Zostań nauczycielem
            </Button>
          </Link>
        </div>

        {/* Social proof */}
        <div className="animate-fade-in-up mt-8 flex flex-col items-center gap-3 sm:flex-row sm:justify-center" style={{ animationDelay: '360ms' }}>
          <div className="flex items-center">
            {avatarInitials.map((initials, i) => (
              <div
                key={initials}
                className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-background text-[11px] font-bold text-white"
                style={{
                  backgroundColor: avatarColors[i],
                  marginLeft: i === 0 ? 0 : '-8px',
                  zIndex: avatarInitials.length - i,
                  position: 'relative',
                }}
                aria-hidden="true"
              >
                {initials}
              </div>
            ))}
          </div>
          <div className="text-sm text-muted-foreground">
            <span className="font-semibold text-foreground">8400+</span> uczniów uczy się w tym miesiącu
          </div>
        </div>
      </div>

      {/* ── Product visual — one calm panel with two supporting cards, only ≥1024px ── */}
      <div className="relative mx-auto mt-16 hidden max-w-3xl px-8 lg:block" aria-hidden="true">
        <div className="animate-fade-in-up relative mx-auto h-[220px] w-[640px]" style={{ animationDelay: '420ms' }}>
          <div className="absolute left-1/2 top-1/2 h-[180px] w-[380px] -translate-x-1/2 -translate-y-1/2 rounded-[24px] border border-border bg-card shadow-lg shadow-black/[0.03]">
            <div className="flex h-full flex-col items-center justify-center gap-3 px-8 text-center">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#F4B400]/15">
                <Bot className="h-5 w-5 text-[#B45309] dark:text-[#FBBF24]" aria-hidden="true" />
              </div>
              <p className="text-sm font-semibold text-foreground">Lekcje 1:1 na żywo, wideo + tablica + kod</p>
              <p className="text-xs text-muted-foreground">Programowanie PLC · CNC · CAD · Robotyka · Automatyka</p>
            </div>
          </div>

          {/* floating card — live lesson */}
          <div className="animate-float absolute left-0 top-4 flex w-44 items-center gap-3 rounded-2xl border border-border bg-card px-4 py-3 shadow-md" style={{ animationDelay: '0.3s' }}>
            <div className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-xs font-bold text-white" style={{ backgroundColor: '#3B82F6' }}>
              MK
              <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full border-2 border-card bg-emerald-500" />
            </div>
            <div className="min-w-0 text-left">
              <p className="truncate text-xs font-semibold text-foreground">Marek Kowalski</p>
              <p className="flex items-center gap-1 text-[11px] text-emerald-600 dark:text-emerald-400">
                <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500" /> Na żywo · PLC
              </p>
            </div>
          </div>

          {/* floating card — rating */}
          <div className="animate-float-slow absolute right-0 top-2 flex w-40 items-center gap-2 rounded-2xl border border-border bg-card px-4 py-3 shadow-md" style={{ animationDelay: '0.6s' }}>
            <Star className="h-4 w-4 shrink-0 fill-[#F4B400] stroke-none" aria-hidden="true" />
            <div className="min-w-0 text-left">
              <p className="text-xs font-semibold text-foreground">4.9 / 5.0</p>
              <p className="truncate text-[11px] text-muted-foreground">6200+ opinii</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
