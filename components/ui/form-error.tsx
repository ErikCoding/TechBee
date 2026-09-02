import * as React from 'react'
import { AlertCircle } from 'lucide-react'

import { cn } from '@/lib/utils'

/**
 * The `text-xs text-destructive` error line under a form field/submit
 * button, repeated identically across every modal (report, dispute,
 * change-request, review...). Adds an icon so it reads as an error at a
 * glance rather than by color alone (see accessibility requirement — don't
 * rely on color only to communicate status).
 */
function FormError({ children, className }: { children?: React.ReactNode; className?: string }) {
  if (!children) return null
  return (
    <p className={cn('flex items-start gap-1.5 text-xs text-destructive', className)} role="alert">
      <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
      <span>{children}</span>
    </p>
  )
}

export { FormError }
