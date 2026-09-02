'use client'

import * as React from 'react'
import Link from 'next/link'
import { ChevronRight, CircleCheckBig } from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * The shared vocabulary behind the student, teacher and parent
 * dashboards.
 *
 * Consistency between the three screens comes from these primitives, not
 * from giving every role the same layout: each dashboard composes them
 * into whatever shape its workflow actually needs. Before this existed,
 * the "bordered section with a tinted header bar" pattern was hand-
 * written a dozen times with slightly different padding, heading sizes
 * and badge treatments, so the dashboards drifted apart every time one
 * of them was touched.
 */

// ─────────────────────────────────────────────────────────────
// Tone — one status vocabulary shared by panels, rows and badges.
// ─────────────────────────────────────────────────────────────

export type PanelTone = 'default' | 'attention' | 'positive' | 'primary' | 'critical'

const panelBorder: Record<PanelTone, string> = {
  default: 'border-border',
  attention: 'border-warning/40',
  positive: 'border-success/30',
  primary: 'border-primary/40',
  critical: 'border-destructive/30',
}

const panelHeader: Record<PanelTone, string> = {
  default: 'bg-muted/40',
  attention: 'bg-warning-surface',
  positive: 'bg-success-surface',
  primary: 'bg-accent',
  critical: 'bg-destructive/5',
}

const panelIcon: Record<PanelTone, string> = {
  default: 'text-muted-foreground',
  attention: 'text-warning-on-surface',
  positive: 'text-success-on-surface',
  primary: 'text-bee-yellow-dark',
  critical: 'text-destructive',
}

const countBadge: Record<PanelTone, string> = {
  default: 'bg-muted-foreground/15 text-muted-foreground',
  attention: 'bg-warning text-white',
  positive: 'bg-success text-white',
  primary: 'bg-primary text-primary-foreground',
  critical: 'bg-destructive text-white',
}

// ─────────────────────────────────────────────────────────────
// Page header — deliberately not a card. The panels below carry the
// borders; wrapping the greeting in one too produced the "cards inside
// cards" look the redesign brief rules out.
// ─────────────────────────────────────────────────────────────

export function DashboardHeader({
  eyebrow,
  title,
  status,
  action,
}: {
  eyebrow: string
  title: React.ReactNode
  status?: React.ReactNode
  action?: React.ReactNode
}) {
  return (
    <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{eyebrow}</p>
        <h1 className="mt-1 truncate text-xl font-bold text-foreground sm:text-2xl">{title}</h1>
        {status && <p className="mt-1 text-sm text-muted-foreground">{status}</p>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </header>
  )
}

// ─────────────────────────────────────────────────────────────
// Panel — the single section container for every dashboard.
// ─────────────────────────────────────────────────────────────

export function Panel({
  icon: Icon,
  title,
  tone = 'default',
  count,
  headerAction,
  children,
  className,
  bodyClassName,
}: {
  icon?: React.ElementType
  title: string
  tone?: PanelTone
  /** Rendered as a count pill on the right of the header when > 0. */
  count?: number
  /** Replaces the count pill — for links or controls that belong to the section. */
  headerAction?: React.ReactNode
  children: React.ReactNode
  className?: string
  bodyClassName?: string
}) {
  return (
    <section className={cn('overflow-hidden rounded-2xl border', panelBorder[tone], className)}>
      <div className={cn('flex items-center gap-2 px-5 py-3.5', panelHeader[tone])}>
        {Icon && <Icon className={cn('h-4 w-4 shrink-0', panelIcon[tone])} aria-hidden="true" />}
        <h2 className="min-w-0 truncate text-sm font-semibold text-foreground">{title}</h2>
        {headerAction ? (
          <div className="ml-auto shrink-0">{headerAction}</div>
        ) : count !== undefined && count > 0 ? (
          <span
            className={cn(
              'ml-auto flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full px-1.5 text-[10px] font-bold',
              countBadge[tone],
            )}
          >
            {count}
          </span>
        ) : null}
      </div>
      <div className={cn('bg-card', bodyClassName)}>{children}</div>
    </section>
  )
}

/** Full-width footer link inside a Panel — the "go to the full view" affordance. */
export function PanelFooterLink({
  href,
  icon: Icon,
  children,
}: {
  href: string
  icon?: React.ElementType
  children: React.ReactNode
}) {
  return (
    <Link
      href={href}
      className="flex items-center gap-2 border-t border-border px-5 py-2.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted/40 hover:text-foreground"
    >
      {Icon && <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />}
      {children}
      <ChevronRight className="ml-auto h-3.5 w-3.5 shrink-0" aria-hidden="true" />
    </Link>
  )
}

// ─────────────────────────────────────────────────────────────
// Attention row — one pending thing, one obvious action.
// ─────────────────────────────────────────────────────────────

export function AttentionRow({
  icon: Icon,
  tone = 'default',
  title,
  detail,
  action,
}: {
  icon: React.ElementType
  tone?: PanelTone
  title: string
  detail?: string
  action: React.ReactNode
}) {
  const iconWrap: Record<PanelTone, string> = {
    default: 'bg-muted text-muted-foreground',
    attention: 'bg-warning-surface text-warning-on-surface',
    positive: 'bg-success-surface text-success-on-surface',
    primary: 'bg-accent text-bee-yellow-dark',
    critical: 'bg-destructive/10 text-destructive',
  }

  return (
    <li className="flex flex-col gap-2.5 px-5 py-3.5 transition-colors hover:bg-muted/30 sm:flex-row sm:items-center sm:gap-4">
      <span className={cn('flex h-8 w-8 shrink-0 items-center justify-center rounded-lg', iconWrap[tone])}>
        <Icon className="h-4 w-4" aria-hidden="true" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-foreground">{title}</p>
        {detail && <p className="truncate text-xs text-muted-foreground">{detail}</p>}
      </div>
      <div className="shrink-0 sm:ml-auto">{action}</div>
    </li>
  )
}

/** The "nothing pending" counterpart to an attention panel. */
export function AllClearBanner({ message, hint }: { message: string; hint?: string }) {
  return (
    <section className="flex items-center gap-3 rounded-2xl border border-success/30 bg-success-surface px-5 py-3.5">
      <CircleCheckBig className="h-4 w-4 shrink-0 text-success-on-surface" aria-hidden="true" />
      <p className="text-sm text-foreground">
        <span className="font-semibold">{message}</span>
        {hint && <span className="text-muted-foreground"> {hint}</span>}
      </p>
    </section>
  )
}

// ─────────────────────────────────────────────────────────────
// Segmented tabs — counted filters that scroll instead of wrapping on
// narrow phones. Used wherever a dashboard has several lesson buckets.
// ─────────────────────────────────────────────────────────────

export function SegmentedTabs<T extends string>({
  tabs,
  value,
  onChange,
  label,
}: {
  tabs: { key: T; label: string; count: number }[]
  value: T
  onChange: (key: T) => void
  label: string
}) {
  return (
    <div role="tablist" aria-label={label} className="-mx-1 flex gap-1 overflow-x-auto px-1 sm:mx-0 sm:px-0">
      {tabs.map((t) => (
        <button
          key={t.key}
          type="button"
          role="tab"
          aria-selected={value === t.key}
          onClick={() => onChange(t.key)}
          className={cn(
            'flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors',
            value === t.key ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground',
          )}
        >
          {t.label}
          <span
            className={cn(
              'rounded-full px-1.5 py-px text-[10px] font-bold',
              value === t.key ? 'bg-accent text-accent-foreground' : 'bg-muted-foreground/15 text-muted-foreground',
            )}
          >
            {t.count}
          </span>
        </button>
      ))}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// Meta strip — the scheduling/identity facts of one entity, grouped
// instead of run together in a prose line.
// ─────────────────────────────────────────────────────────────

export function MetaStrip({
  items,
  className,
}: {
  items: { icon: React.ElementType; label: string; value: string }[]
  className?: string
}) {
  return (
    <dl
      className={cn(
        'grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-border bg-border',
        items.length >= 4 ? 'sm:grid-cols-4' : 'sm:grid-cols-3',
        className,
      )}
    >
      {items.map(({ icon: Icon, label, value }) => (
        <div key={label} className="flex items-center gap-2 bg-card px-3 py-2.5">
          <Icon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
          <div className="min-w-0">
            <dt className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</dt>
            <dd className="truncate text-xs font-semibold text-foreground">{value}</dd>
          </div>
        </div>
      ))}
    </dl>
  )
}

// ─────────────────────────────────────────────────────────────
// Compact stat row — passive totals, deliberately small. Vanity metrics
// should never outrank an action on any of the dashboards.
// ─────────────────────────────────────────────────────────────

export function StatRow({
  items,
  className,
}: {
  items: { icon: React.ElementType; label: string; value: React.ReactNode }[]
  className?: string
}) {
  return (
    <div
      className={cn(
        'grid divide-x divide-border bg-card',
        items.length === 4 ? 'grid-cols-2 sm:grid-cols-4' : items.length === 2 ? 'grid-cols-2' : 'grid-cols-3',
        items.length === 4 && 'divide-y sm:divide-y-0',
        className,
      )}
    >
      {items.map(({ icon: Icon, label, value }) => (
        <div key={label} className="flex flex-col items-center gap-0.5 px-2 py-3.5 text-center">
          <Icon className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
          <p className="truncate text-base font-bold leading-tight text-foreground">{value}</p>
          <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
        </div>
      ))}
    </div>
  )
}
