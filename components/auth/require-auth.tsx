'use client'

import { useEffect } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { Loader2 } from 'lucide-react'
import { useAuth } from '@/lib/auth-context'
import type { UserRole } from '@/lib/types'

interface RequireAuthProps {
  children: React.ReactNode
  /** If set, only this role may view the page — everyone else is sent to their own dashboard. */
  role?: UserRole
}

const dashboardFor: Record<UserRole, string> = {
  student: '/dashboard/student',
  teacher: '/dashboard/teacher',
  admin: '/admin',
}

/**
 * Client-side route guard for pages that require an account. There's no
 * real backend session yet, so this checks the mock auth state from
 * `AuthProvider` (backed by localStorage) and redirects when needed.
 * Once Firebase Auth is wired in, this can move to middleware-based
 * session checks without changing how pages use it.
 */
export function RequireAuth({ children, role }: RequireAuthProps) {
  const { user, status } = useAuth()
  const router = useRouter()
  const pathname = usePathname()

  const wrongRole = status === 'authenticated' && role && user?.role !== role

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.replace(`/login?redirect=${encodeURIComponent(pathname)}`)
    } else if (wrongRole && user) {
      router.replace(dashboardFor[user.role])
    }
  }, [status, wrongRole, user, router, pathname])

  if (status !== 'authenticated' || wrongRole) {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center gap-3 px-4 text-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" aria-hidden="true" />
        <p className="text-sm text-muted-foreground">Sprawdzanie dostępu do konta...</p>
      </div>
    )
  }

  return <>{children}</>
}
