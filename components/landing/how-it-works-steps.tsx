'use client'

import { useEffect, useRef, useState } from 'react'
import { Search, CalendarCheck, Video, ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'

const steps = [
  {
    icon: Search,
    title: 'Znajdź nauczyciela',
    description: 'Filtruj giełdę po dziedzinie, cenie, ocenie i dostępności. Profile są weryfikowane ręcznie.',
  },
  {
    icon: CalendarCheck,
    title: 'Zarezerwuj lekcję',
    description: 'Wybierz termin z kalendarza nauczyciela i opłać go bezpiecznie przez Stripe.',
  },
  {
    icon: Video,
    title: 'Ucz się online',
    description: 'Lekcja odbywa się w przeglądarce — wideo, czat i udostępnianie ekranu w jednym miejscu.',
  },
]

/**
 * The three steps as a left-rail timeline: a marker ("korek") and
 * connecting line down the left edge, title + description at the
 * matching height on the right — rather than the earlier centred stack
 * with the description underneath each icon.
 *
 * Each per-step block is its own single-row grid (`marker column` +
 * `text column`), so the left column stretches to exactly the height of
 * the text beside it via grid's default row-stretch — no manual height
 * sync needed. Stacking the blocks with zero gap lets the connecting
 * line run straight from one marker's row into the next one's marker,
 * unbroken.
 *
 * A single IntersectionObserver marks a step "reached" once it crosses
 * the middle of the viewport, only ever advancing. Three states now
 * read differently instead of a flat lit/dimmed toggle: a completed
 * step (`index < reached`) sits solid; the current one (`index ===
 * reached`) gets the brand's pulse-ring radiating outward, marking
 * "you are here"; anything after stays dimmed. The connecting line
 * fills top-down as its step completes, the arrow floats once the line
 * above it is full, and each marker scales in from the previous one's
 * completion — a small chain reaction down the rail — while its text
 * block slides in from the right, rather than everything just
 * fading/dimming in place.
 *
 * Falls back to everything-lit when IntersectionObserver is missing.
 */
export function HowItWorksSteps() {
  const [reached, setReached] = useState(0)
  const itemRefs = useRef<(HTMLDivElement | null)[]>([])

  useEffect(() => {
    if (typeof IntersectionObserver === 'undefined') {
      setReached(steps.length - 1)
      return
    }
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue
          const index = Number((entry.target as HTMLElement).dataset.index)
          setReached((prev) => (index > prev ? index : prev))
        }
      },
      { rootMargin: '-40% 0px -45% 0px', threshold: 0 },
    )
    const nodes = itemRefs.current.filter((n): n is HTMLDivElement => n !== null)
    nodes.forEach((node) => observer.observe(node))
    return () => observer.disconnect()
  }, [])

  return (
    <div className="mx-auto flex max-w-2xl flex-col">
      {steps.map((step, index) => {
        const Icon = step.icon
        const isLast = index === steps.length - 1
        const completed = index < reached
        const current = index === reached
        const active = index <= reached

        return (
          <div
            key={step.title}
            data-index={index}
            ref={(node) => {
              itemRefs.current[index] = node
            }}
            className="grid grid-cols-[3.25rem_1fr] gap-x-5 sm:grid-cols-[3.75rem_1fr] sm:gap-x-7"
          >
            {/* left rail: marker + connecting line/arrow down to the next step */}
            <div className="relative flex flex-col items-center">
              <span
                className={cn(
                  'relative flex h-12 w-12 shrink-0 items-center justify-center rounded-full border transition-all duration-500 motion-reduce:transition-none sm:h-14 sm:w-14',
                  active
                    ? 'scale-100 border-primary bg-primary text-primary-foreground opacity-100'
                    : 'scale-90 border-border bg-card text-muted-foreground opacity-70',
                  current && 'motion-safe:animate-pulse-ring',
                )}
              >
                <Icon className="h-4.5 w-4.5 sm:h-5 sm:w-5" aria-hidden="true" />
              </span>

              {!isLast && (
                <div className="relative mt-1 w-px flex-1 overflow-hidden rounded-full bg-border" aria-hidden="true">
                  <div
                    className={cn(
                      'absolute inset-x-0 top-0 w-px bg-primary transition-[height] duration-700 ease-out motion-reduce:transition-none',
                      completed || current ? 'h-full' : 'h-0',
                    )}
                  />
                  <ChevronDown
                    className={cn(
                      'absolute left-1/2 top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 transition-all duration-500 motion-reduce:transition-none',
                      completed
                        ? 'text-primary opacity-100 motion-safe:animate-float'
                        : 'text-muted-foreground/40 opacity-70',
                    )}
                    style={completed ? { animationDuration: '2.4s' } : undefined}
                  />
                </div>
              )}
            </div>

            {/* right column: title + description at the marker's height */}
            <div className={cn('pt-1.5', isLast ? 'pb-0' : 'pb-10 sm:pb-12')}>
              <div
                className={cn(
                  'transition-all duration-500 motion-reduce:transition-none',
                  active ? 'translate-x-0 opacity-100' : 'translate-x-2 opacity-60',
                )}
              >
                <span
                  className={cn(
                    'text-xs font-bold tabular-nums tracking-wide transition-colors duration-500',
                    active ? 'text-primary' : 'text-muted-foreground/60',
                  )}
                >
                  KROK {index + 1}
                </span>
                <h3
                  className={cn(
                    'mt-1.5 text-lg font-semibold transition-colors duration-500 sm:text-xl',
                    active ? 'text-foreground' : 'text-muted-foreground',
                  )}
                >
                  {step.title}
                </h3>
                <p
                  className={cn(
                    'mt-2 max-w-sm text-sm leading-relaxed transition-colors duration-500',
                    active ? 'text-muted-foreground' : 'text-muted-foreground/50',
                  )}
                >
                  {step.description}
                </p>
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
