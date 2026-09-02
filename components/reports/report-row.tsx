'use client'

import { ChevronRight, Star } from 'lucide-react'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { StatusBadge } from '@/components/ui/status-badge'
import { REPORT_STATUS_CONFIG } from '@/components/reports/report-status'
import { cn } from '@/lib/utils'
import type { LessonReportCard } from '@/lib/types'

interface Props {
  card: LessonReportCard
  /** Who to show as the counterparty — a student sees the teacher, a teacher sees the student. */
  counterpartyName: string
  counterpartyColor: string
  /** Set on the parent dashboard when several children are linked. */
  contextLabel?: string
  actionable: boolean
  onOpen: () => void
}

/**
 * A report as one scannable row.
 *
 * Replaces the fixed-width chat card as the list representation. A card
 * grid gave every report the same weight and the same height whether it
 * needed a decision or was closed months ago; rows let a list be read
 * top-to-bottom, keep the status and the counterparty aligned in
 * columns, and stay compact enough that history doesn't dominate the
 * page. Full detail moves into ReportDetailDialog, opened from here.
 */
export function ReportRow({
  card,
  counterpartyName,
  counterpartyColor,
  contextLabel,
  actionable,
  onOpen,
}: Props) {
  const config = REPORT_STATUS_CONFIG[card.status]

  return (
    <li>
      <button
        type="button"
        onClick={onOpen}
        className={cn(
          'flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/40 sm:px-5',
          actionable && 'bg-warning-surface/40',
        )}
      >
        <Avatar className="h-9 w-9 shrink-0">
          <AvatarFallback color={counterpartyColor} className="text-[11px]">
            {counterpartyName.slice(0, 2).toUpperCase()}
          </AvatarFallback>
        </Avatar>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="truncate text-sm font-semibold text-foreground">{card.topic}</p>
            {contextLabel && (
              <span className="shrink-0 rounded-full bg-muted px-1.5 py-px text-[10px] font-medium text-muted-foreground">
                {contextLabel}
              </span>
            )}
          </div>
          <p className="truncate text-xs text-muted-foreground">
            {counterpartyName} · {card.price} zł
            <span className="hidden sm:inline">
              {' · '}
              <span className="inline-flex items-center gap-0.5 align-middle">
                <Star className="h-3 w-3 fill-primary stroke-none" aria-hidden="true" />
                {card.progressRating}/5
              </span>
            </span>
          </p>
        </div>

        {/* Status is the column a reader scans, so it keeps a fixed slot. */}
        <div className="hidden shrink-0 sm:block">
          <StatusBadge tone={config.tone} dot={false} className="text-[10px]">
            {config.shortLabel}
          </StatusBadge>
        </div>
        <span
          className={cn(
            'h-2 w-2 shrink-0 rounded-full sm:hidden',
            config.tone === 'warning' && 'bg-warning',
            config.tone === 'success' && 'bg-success',
            config.tone === 'error' && 'bg-destructive',
            config.tone === 'info' && 'bg-info',
            config.tone === 'neutral' && 'bg-muted-foreground',
          )}
          aria-label={config.shortLabel}
        />

        <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
      </button>
    </li>
  )
}
