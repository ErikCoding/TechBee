'use client'

import { useEffect, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { Loader2, MailCheck } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/lib/auth-context'
import { requireEmailVerification } from '@/lib/email-verification'
import type { UserRole } from '@/lib/types'

interface RequireAuthProps {
  children: React.ReactNode
  /** If set, only user(s) with this role (or one of these roles) may view the page — everyone else is sent to their own dashboard. */
  role?: UserRole | UserRole[]
}

const dashboardFor: Record<UserRole, string> = {
  student: '/dashboard/student',
  teacher: '/dashboard/teacher',
  admin: '/admin',
  parent: '/dashboard/parent',
}

/**
 * Client-side route guard for pages that require an account. There's no
 * real backend session yet, so this checks the mock auth state from
 * `AuthProvider` (backed by localStorage) and redirects when needed.
 * Once Firebase Auth is wired in, this can move to middleware-based
 * session checks without changing how pages use it.
 */
export function RequireAuth({ children, role }: RequireAuthProps) {
  const { user, status, resendVerification, refreshVerification, logout } = useAuth()
  const router = useRouter()
  const pathname = usePathname()
  const [verificationMessage, setVerificationMessage] = useState<string | null>(null)
  const [resending, setResending] = useState(false)

  const allowedRoles = role ? (Array.isArray(role) ? role : [role]) : null
  const wrongRole = status === 'authenticated' && allowedRoles !== null && !!user && !allowedRoles.includes(user.role)
  const needsEmailVerification = requireEmailVerification && status === 'authenticated' && !!user && user.emailVerified === false

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.replace(`/login?redirect=${encodeURIComponent(pathname)}`)
    } else if (wrongRole && user) {
      router.replace(dashboardFor[user.role])
    }
  }, [status, wrongRole, user, router, pathname])

  async function handleResendVerification() {
    setResending(true)
    setVerificationMessage(null)
    try {
      await resendVerification()
      setVerificationMessage('Wysłaliśmy nowy link. Jeśli testujesz kilka razy pod rząd, Firebase może chwilowo blokować kolejne wysyłki.')
    } catch (err) {
      const message = err instanceof Error && err.message.includes('too-many-requests')
        ? 'Firebase tymczasowo zablokował kolejne wysyłki. Odczekaj chwilę i nie klikaj ponownie kilka razy z rzędu.'
        : 'Nie udało się wysłać maila weryfikacyjnego. Sprawdź konfigurację Firebase Auth.'
      setVerificationMessage(message)
    } finally {
      setResending(false)
    }
  }

  if (needsEmailVerification) {
    return (
      <div className="mx-auto flex min-h-[60vh] max-w-md flex-col items-center justify-center gap-4 px-4 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-accent">
          <MailCheck className="h-5 w-5 text-bee-yellow-dark" aria-hidden="true" />
        </div>
        <div>
          <h1 className="text-lg font-semibold text-foreground">Potwierdź adres e-mail</h1>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            Wysłaliśmy link aktywacyjny na {user.email}. Po kliknięciu linku wróć tutaj i odśwież status konta.
          </p>
        </div>
        <div className="flex w-full flex-col gap-2 sm:flex-row">
          <Button variant="outline" onClick={handleResendVerification} disabled={resending} className="w-full">
            {resending ? 'Wysyłanie...' : 'Wyślij ponownie'}
          </Button>
          <Button onClick={refreshVerification} className="w-full font-semibold">Sprawdziłem maila</Button>
        </div>
        {verificationMessage && <p className="text-xs leading-relaxed text-muted-foreground">{verificationMessage}</p>}
        <button type="button" onClick={logout} className="text-xs text-muted-foreground underline underline-offset-4 hover:text-foreground">
          Użyj innego konta
        </button>
      </div>
    )
  }

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
