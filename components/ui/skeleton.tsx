import * as React from 'react'

import { cn } from '@/lib/utils'

/**
 * Thin wrapper around the `.skeleton` shimmer utility already defined in
 * globals.css — most loading states in this app used `animate-pulse
 * rounded-2xl bg-muted` inline instead of that utility. Use this instead of
 * either from now on so every loading placeholder shimmers the same way.
 */
function Skeleton({ className, ...props }: React.ComponentProps<'div'>) {
  return <div data-slot="skeleton" className={cn('skeleton rounded-lg', className)} {...props} />
}

export { Skeleton }
