'use client'

import { ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'

/** How many rows a collapsible group shows before "Pokaż więcej". */
export const COLLAPSED_ROWS = 3

/** Small "N newest visible, rest hidden" toggle shared by the teacher/parent report-history sections. */
export function ShowMoreButton({ expanded, hiddenCount, onToggle }: { expanded: boolean; hiddenCount: number; onToggle: () => void }) {
  if (hiddenCount <= 0) return null
  return (
    <button
      type="button"
      onClick={onToggle}
      className="mt-1 flex items-center gap-1 self-start text-xs font-medium text-muted-foreground hover:text-foreground"
    >
      <ChevronDown className={cn('h-3.5 w-3.5 transition-transform', expanded && 'rotate-180')} aria-hidden="true" />
      {expanded ? 'Pokaż mniej' : `Pokaż więcej (${hiddenCount})`}
    </button>
  )
}
