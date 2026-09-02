import { Loader2 } from 'lucide-react'

import { cn } from '@/lib/utils'

const sizeClasses = {
  xs: 'h-3 w-3',
  sm: 'h-3.5 w-3.5',
  default: 'h-4 w-4',
  lg: 'h-6 w-6',
} as const

/**
 * The bare `<Loader2 className="animate-spin" />` pattern was repeated,
 * with slightly different sizes, in dozens of buttons/panels across the
 * app. This doesn't change any of those call sites' behavior — it just
 * gives new code (and files touched during the redesign) one consistent
 * spinner instead of another inline one-off.
 */
function Spinner({ size = 'default', className }: { size?: keyof typeof sizeClasses; className?: string }) {
  return <Loader2 className={cn('animate-spin text-current', sizeClasses[size], className)} aria-hidden="true" />
}

export { Spinner }
