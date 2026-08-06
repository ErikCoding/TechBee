'use client'

import { useRouter } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { useAuth } from '@/lib/auth-context'
import { dashboardPathForRole } from '@/lib/utils'

interface BackButtonProps {
  /** Used only if there's no browser history to go back to (e.g. page opened directly via URL). Defaults to the user's own dashboard. */
  fallbackHref?: string
  label?: string
  className?: string
}

/** Goes back in browser history when possible, otherwise falls back to a fixed destination. */
export function BackButton({ fallbackHref, label = 'Wstecz', className }: BackButtonProps) {
  const router = useRouter()
  const { user } = useAuth()
  const fallback = fallbackHref ?? dashboardPathForRole(user?.role)

  function handleClick() {
    if (typeof window !== 'undefined' && window.history.length > 1) {
      router.back()
    } else {
      router.push(fallback)
    }
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      className={`mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground ${className ?? ''}`}
    >
      <ArrowLeft className="h-4 w-4" aria-hidden="true" />
      {label}
    </button>
  )
}
