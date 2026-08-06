'use client'

import { useEffect, useRef, useState } from 'react'
import { cn } from '@/lib/utils'

interface RevealProps {
  children: React.ReactNode
  className?: string
  /** Stagger delay in ms, handy inside a mapped list. */
  delay?: number
  as?: 'div' | 'li'
}

/**
 * Fades + slides children into view the first time they cross the
 * viewport. Falls back to always-visible if IntersectionObserver is
 * unavailable, and respects prefers-reduced-motion via CSS (see
 * app/globals.css `.reveal`).
 */
export function Reveal({ children, className, delay = 0, as = 'div' }: RevealProps) {
  const ref = useRef<HTMLDivElement | null>(null)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const node = ref.current
    if (!node) return
    if (typeof IntersectionObserver === 'undefined') {
      setVisible(true)
      return
    }
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true)
          observer.disconnect()
        }
      },
      { threshold: 0.15, rootMargin: '0px 0px -40px 0px' },
    )
    observer.observe(node)
    return () => observer.disconnect()
  }, [])

  const Comp = as
  return (
    <Comp
      ref={ref as React.RefObject<HTMLDivElement & HTMLLIElement>}
      className={cn('reveal', visible && 'reveal-visible', className)}
      style={{ transitionDelay: visible ? `${delay}ms` : '0ms' }}
    >
      {children}
    </Comp>
  )
}
