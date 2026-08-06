'use client'

import { useEffect, useRef, useState } from 'react'

interface AnimatedCounterProps {
  /** Numeric target value the counter animates up to. */
  value: number
  /** Text shown before the number, e.g. "" */
  prefix?: string
  /** Text shown after the number, e.g. "+", "%". */
  suffix?: string
  duration?: number
  className?: string
}

/**
 * Counts up from 0 to `value` once it scrolls into view. Used for
 * landing-page stats so numbers feel alive without being gimmicky.
 */
export function AnimatedCounter({ value, prefix = '', suffix = '', duration = 1400, className }: AnimatedCounterProps) {
  const ref = useRef<HTMLSpanElement | null>(null)
  const [display, setDisplay] = useState(0)
  const started = useRef(false)

  useEffect(() => {
    const node = ref.current
    if (!node) return

    const animate = () => {
      if (started.current) return
      started.current = true
      const startTime = performance.now()
      const step = (now: number) => {
        const progress = Math.min((now - startTime) / duration, 1)
        const eased = 1 - Math.pow(1 - progress, 3)
        setDisplay(Math.round(eased * value))
        if (progress < 1) requestAnimationFrame(step)
      }
      requestAnimationFrame(step)
    }

    if (typeof IntersectionObserver === 'undefined') {
      animate()
      return
    }
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          animate()
          observer.disconnect()
        }
      },
      { threshold: 0.4 },
    )
    observer.observe(node)
    return () => observer.disconnect()
  }, [value, duration])

  return (
    <span ref={ref} className={className}>
      {prefix}
      {display.toLocaleString('pl-PL')}
      {suffix}
    </span>
  )
}
