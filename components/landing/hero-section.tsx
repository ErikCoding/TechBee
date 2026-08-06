'use client'

import Link from 'next/link'
import { Search, ArrowRight, Star, Bot, CheckCircle2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useRouter } from 'next/navigation'
import { useState } from 'react'

const popularSearches = ['PLC Siemens', 'SolidWorks', 'G-code CNC', 'robotyka KUKA', 'Ignition SCADA']

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
    <section className="relative overflow-hidden bg-background pb-16 pt-28 md:pb-24 md:pt-36">
      {/* ── Animated gradient mesh background ── */}
      <div className="pointer-events-none absolute inset-0 -z-10" aria-hidden="true">
        <div
          className="animate-gradient absolute -top-1/3 left-1/2 h-[140%] w-[140%] -translate-x-1/2 opacity-[0.14] blur-3xl dark:opacity-[0.20]"
          style={{
            background:
              'radial-gradient(38% 38% at 22% 28%, #F4B400 0%, transparent 60%), radial-gradient(32% 32% at 78% 22%, #3B82F6 0%, transparent 60%), radial-gradient(36% 36% at 50% 78%, #8B5CF6 0%, transparent 60%)',
          }}
        />
        {/* faint grid texture */}
        <div
          className="absolute inset-0 opacity-[0.35] dark:opacity-[0.18]"
          style={{
            backgroundImage:
              'linear-gradient(to right, color-mix(in srgb, var(--foreground) 6%, transparent) 1px, transparent 1px), linear-gradient(to bottom, color-mix(in srgb, var(--foreground) 6%, transparent) 1px, transparent 1px)',
            backgroundSize: '56px 56px',
            maskImage: 'radial-gradient(ellipse 70% 55% at 50% 0%, black 40%, transparent 100%)',
            WebkitMaskImage: 'radial-gradient(ellipse 70% 55% at 50% 0%, black 40%, transparent 100%)',
          }}
        />
      </div>

      <div className="relative mx-auto max-w-4xl px-4 text-center md:px-8">
        {/* Eyebrow badge */}
        <div className="animate-fade-in-up inline-flex items-center gap-2 rounded-full border border-[#F4B400]/30 bg-[#FEF3C7]/80 px-4 py-1.5 glass dark:bg-[#3B2800]/60">
          <span className="relative flex h-1.5 w-1.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#F4B400] opacity-75" />
            <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-[#F4B400]" />
          </span>
          <span className="text-xs font-semibold text-[#78350F] dark:text-[#FBBF24]">
            300+ zweryfikowanych specjalistów technicznych
          </span>
        </div>

        {/* Headline */}
        <h1 className="animate-fade-in-up mt-6 text-balance text-4xl font-bold leading-[1.08] tracking-tight text-foreground md:text-5xl lg:text-6xl" style={{ animationDelay: '80ms' }}>
          Ucz się praktycznych umiejętności przemysłowych od{' '}
          <span className="relative inline-block">
            <span
              className="animate-gradient bg-clip-text text-transparent"
              style={{ backgroundImage: 'linear-gradient(90deg, #F4B400, #FBBF24, #F4B400)' }}
            >
              certyfikowanych ekspertów
            </span>
            <svg
              className="absolute -bottom-1 left-0 w-full"
              viewBox="0 0 200 8"
              fill="none"
              preserveAspectRatio="none"
              aria-hidden="true"
            >
              <path
                d="M2 6C40 2 80 1 100 1C120 1 160 2 198 6"
                stroke="#F4B400"
                strokeWidth="2.5"
                strokeLinecap="round"
                opacity="0.5"
              />
            </svg>
          </span>
        </h1>

        {/* Subtitle */}
        <p className="animate-fade-in-up mx-auto mt-5 max-w-2xl text-balance text-base leading-relaxed text-muted-foreground md:text-lg" style={{ animationDelay: '140ms' }}>
          PLC, CNC, CAD, robotyka i automatyka — indywidualne lekcje online prowadzone przez inżynierów z realnym doświadczeniem produkcyjnym.
        </p>

        {/* Search bar */}
        <form
          onSubmit={handleSearch}
          className="animate-fade-in-up glass mx-auto mt-8 flex max-w-xl items-center gap-2 rounded-2xl border border-border p-2 shadow-lg shadow-black/[0.03] transition-shadow focus-within:shadow-xl focus-within:shadow-[#F4B400]/10"
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
            className="group bg-[#F4B400] text-[#0A0A0A] hover:bg-[#FBBF24] font-semibold shrink-0 transition-transform active:scale-[0.97]"
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
              className="rounded-full border border-border bg-card/80 px-3 py-1 text-xs text-muted-foreground transition-all hover:-translate-y-0.5 hover:border-[#F4B400]/50 hover:text-foreground hover:shadow-sm"
            >
              {term}
            </button>
          ))}
        </div>

        {/* Social proof avatars */}
        <div className="animate-fade-in-up mt-10 flex flex-col items-center gap-3 sm:flex-row sm:justify-center" style={{ animationDelay: '300ms' }}>
          <div className="flex items-center">
            {avatarInitials.map((initials, i) => (
              <div
                key={initials}
                className="flex h-9 w-9 items-center justify-center rounded-full border-2 border-background text-xs font-bold text-white shadow-sm"
                style={{
                  backgroundColor: avatarColors[i],
                  marginLeft: i === 0 ? 0 : '-10px',
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

        {/* CTA links */}
        <div className="animate-fade-in-up mt-8 flex flex-wrap items-center justify-center gap-3" style={{ animationDelay: '360ms' }}>
          <Link href="/marketplace">
            <Button
              size="lg"
              className="bg-[#F4B400] text-[#0A0A0A] hover:bg-[#FBBF24] font-semibold px-8 shadow-md shadow-[#F4B400]/20 transition-all hover:-translate-y-0.5 hover:shadow-lg hover:shadow-[#F4B400]/30 active:translate-y-0"
            >
              Przeglądaj nauczycieli
            </Button>
          </Link>
          <Link href="/teach">
            <Button size="lg" variant="outline" className="px-8 transition-all hover:-translate-y-0.5">
              Zostań nauczycielem
            </Button>
          </Link>
        </div>
      </div>

      {/* ── Floating product visual ──
          Only shown ≥1024px (lg) — at narrower widths (tablets, split
          VS Code preview panes, small laptop windows) there isn't enough
          room to float cards beside the central stage without them
          overlapping its text, so we skip straight to the next section. */}
      <div className="relative mx-auto mt-16 hidden max-w-5xl px-8 lg:block" aria-hidden="true">
        {/* Fixed 820×300 stage: every card below has a hand-checked position
            so it never overlaps the central panel or another card. */}
        <div className="animate-fade-in-up relative mx-auto h-[300px] w-[820px]" style={{ animationDelay: '420ms' }}>
          {/* central glass stage — spans x:200–620 */}
          <div className="glass absolute left-1/2 top-1/2 h-[200px] w-[420px] -translate-x-1/2 -translate-y-1/2 rounded-[28px] border border-border shadow-2xl shadow-black/[0.04]">
            <div
              className="animate-gradient absolute inset-0 rounded-[28px] opacity-[0.08]"
              style={{ backgroundImage: 'linear-gradient(120deg, #F4B400, #3B82F6, #8B5CF6, #F4B400)' }}
            />
            <div className="relative flex h-full flex-col items-center justify-center gap-3 px-8 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#F4B400]/15">
                <Bot className="h-6 w-6 text-[#B45309] dark:text-[#FBBF24]" aria-hidden="true" />
              </div>
              <p className="text-sm font-semibold text-foreground">Lekcje 1:1 na żywo, wideo + tablica + kod</p>
              <p className="text-xs text-muted-foreground">Programowanie PLC · CNC · CAD · Robotyka · Automatyka</p>
            </div>
          </div>

          {/* floating card — live lesson — spans x:0–176, y:24–84 */}
          <div className="glass animate-float absolute left-0 top-6 flex w-44 items-center gap-3 rounded-2xl border border-border px-4 py-3 shadow-lg" style={{ animationDelay: '0.3s' }}>
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

          {/* floating card — verified — spans x:8–184, y:238–298 */}
          <div className="glass animate-float-slow absolute bottom-2 left-2 flex w-44 items-center gap-2 rounded-2xl border border-border px-4 py-3 shadow-lg" style={{ animationDelay: '0.9s' }}>
            <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" aria-hidden="true" />
            <div className="min-w-0 text-left">
              <p className="truncate text-xs font-semibold text-foreground">Zweryfikowany ekspert</p>
              <p className="truncate text-[11px] text-muted-foreground">Sprawdzone doświadczenie</p>
            </div>
          </div>

          {/* floating card — rating — spans x:660–820, y:0–55 */}
          <div className="glass animate-float-slow absolute right-0 top-0 flex w-40 items-center gap-2 rounded-2xl border border-border px-4 py-3 shadow-lg">
            <Star className="h-4 w-4 shrink-0 fill-[#F4B400] stroke-none" aria-hidden="true" />
            <div className="min-w-0 text-left">
              <p className="text-xs font-semibold text-foreground">4.9 / 5.0</p>
              <p className="truncate text-[11px] text-muted-foreground">6200+ opinii</p>
            </div>
          </div>

          {/* floating card — BeePoints — spans x:644–820, y:216–276 */}
          <div className="glass animate-float absolute bottom-6 right-0 flex w-44 items-center gap-2 rounded-2xl border border-border px-4 py-3 shadow-lg" style={{ animationDelay: '0.6s' }}>
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#FEF3C7] dark:bg-[#3B2800]">
              <Star className="h-3.5 w-3.5 fill-[#F4B400] stroke-none" aria-hidden="true" />
            </div>
            <div className="min-w-0 text-left">
              <p className="truncate text-xs font-semibold text-foreground">+180 BeePoints</p>
              <p className="truncate text-[11px] text-muted-foreground">Po ukończonej lekcji</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
