import * as React from 'react'

import { cn } from '@/lib/utils'

/**
 * Each pill pairs a pale surface with the matching `*-on-surface` text
 * token.
 *
 * These used to use `*-foreground`, which is white — right on the solid
 * `--success` / `--warning` / `--info` fill, but catastrophic on the pale
 * surface these badges actually sit on: the confirmed-report badge was
 * white on #ECFDF5, a contrast ratio of 1.05:1, i.e. unreadable in light
 * mode. A `dark:` override patched dark mode only, which is why the
 * problem stayed invisible during dark-theme work.
 *
 * `*-on-surface` resolves to a dark hue in light mode (7.3:1+) and to the
 * light hue in dark mode (7.65:1), so one class is correct in both and
 * the `dark:` overrides are gone.
 */
const toneClasses = {
  success: 'bg-success-surface text-success-on-surface [&_[data-dot]]:bg-success',
  warning: 'bg-warning-surface text-warning-on-surface [&_[data-dot]]:bg-warning',
  error: 'bg-destructive/10 text-destructive [&_[data-dot]]:bg-destructive',
  info: 'bg-info-surface text-info-on-surface [&_[data-dot]]:bg-info',
  neutral: 'bg-muted text-muted-foreground [&_[data-dot]]:bg-muted-foreground',
} as const

export type StatusTone = keyof typeof toneClasses

/**
 * The "colored pill with a dot" status indicator — used for lesson status,
 * report status, dispute status, payout status — was previously a
 * different one-off `className` string per usage (amber-500/10,
 * emerald-500/10, ...). One shared component keyed by a small `tone`
 * vocabulary instead, so status colors stay consistent app-wide and follow
 * the success/warning/error/info tokens rather than raw Tailwind colors.
 */
function StatusBadge({
  tone,
  children,
  className,
  dot = true,
}: {
  tone: StatusTone
  children: React.ReactNode
  className?: string
  dot?: boolean
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium',
        toneClasses[tone],
        className,
      )}
    >
      {dot && <span data-dot className="h-1.5 w-1.5 shrink-0 rounded-full" aria-hidden="true" />}
      {children}
    </span>
  )
}

export { StatusBadge }
