'use client'

import { type FormEvent, useEffect, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { AlertCircle, CheckCircle2, Loader2, LogOut, MailCheck, PencilLine, RefreshCw, Send } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useAuth } from '@/lib/auth-context'
import { requireEmailVerification } from '@/lib/email-verification'
import { needsEmailVerificationGate } from '@/lib/auth-guards'
import { EmailVerificationRequestError } from '@/lib/email-verification-client'
import { BeeLogo } from '@/components/shared/bee-logo'
import type { UserRole } from '@/lib/types'
import { AccountSecurityRequestError } from '@/lib/account-security-client'
import { requestCurrentUserEmailChange } from '@/services/auth.service'

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
  const { user, status, error, resendVerification, refreshVerification, logout } = useAuth()
  const router = useRouter()
  const pathname = usePathname()
  const [verificationMessage, setVerificationMessage] = useState<string | null>(null)
  const [verificationTone, setVerificationTone] = useState<'success' | 'error' | 'muted'>('muted')
  const [verificationState, setVerificationState] = useState<'idle' | 'sending' | 'sent' | 'checking' | 'verified' | 'rate-limited' | 'error'>('idle')
  const [emailChangeOpen, setEmailChangeOpen] = useState(false)
  const [newEmail, setNewEmail] = useState('')
  const [currentPassword, setCurrentPassword] = useState('')
  const [emailChangeState, setEmailChangeState] = useState<'idle' | 'submitting'>('idle')
  const [emailChangeError, setEmailChangeError] = useState<string | null>(null)

  const allowedRoles = role ? (Array.isArray(role) ? role : [role]) : null
  const wrongRole = status === 'authenticated' && allowedRoles !== null && !!user && !allowedRoles.includes(user.role)
  const needsEmailVerification = needsEmailVerificationGate(requireEmailVerification, status, user)

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.replace(`/login?redirect=${encodeURIComponent(pathname)}`)
    } else if (wrongRole && user) {
      router.replace(dashboardFor[user.role])
    }
  }, [status, wrongRole, user, router, pathname])

  async function handleResendVerification() {
    setVerificationState('sending')
    setVerificationMessage(null)
    setVerificationTone('muted')
    try {
      await resendVerification()
      setVerificationState('sent')
      setVerificationTone('success')
      setVerificationMessage('Wysłaliśmy nowy link weryfikacyjny.')
    } catch (err) {
      const rateLimited = err instanceof EmailVerificationRequestError && err.status === 429
      setVerificationState(rateLimited ? 'rate-limited' : 'error')
      setVerificationTone(rateLimited ? 'muted' : 'error')
      setVerificationMessage(rateLimited
        ? 'Nową wiadomość będzie można wysłać za chwilę.'
        : 'Nie udało się wysłać wiadomości. Spróbuj ponownie za chwilę.')
    }
  }

  async function handleRefreshVerification() {
    setVerificationState('checking')
    setVerificationMessage(null)
    setVerificationTone('muted')
    try {
      const fresh = await refreshVerification()
      if (fresh?.emailVerified) {
        setVerificationState('verified')
        setVerificationTone('success')
        setVerificationMessage('Adres e-mail został potwierdzony.')
      } else {
        setVerificationState('idle')
        setVerificationTone('muted')
        setVerificationMessage('Adres nie jest jeszcze potwierdzony. Sprawdź link w wiadomości e-mail.')
      }
    } catch {
      setVerificationState('error')
      setVerificationTone('error')
      setVerificationMessage('Nie udało się odświeżyć statusu. Spróbuj ponownie.')
    }
  }

  async function handleEmailChange(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setEmailChangeError(null)
    setVerificationMessage(null)
    setVerificationTone('muted')

    const normalizedEmail = newEmail.trim().toLowerCase()
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      setEmailChangeError('Podaj poprawny adres e-mail.')
      return
    }
    if (normalizedEmail === user?.email.trim().toLowerCase()) {
      setEmailChangeError('Nowy adres jest taki sam jak obecny.')
      return
    }

    setEmailChangeState('submitting')
    try {
      await requestCurrentUserEmailChange({ newEmail: normalizedEmail, currentPassword })
      setVerificationTone('success')
      setVerificationMessage('Wysłaliśmy link potwierdzający na nowy adres. Obecny adres pozostaje aktywny do czasu potwierdzenia zmiany.')
      setNewEmail('')
      setCurrentPassword('')
      setEmailChangeOpen(false)
    } catch (err) {
      if (err instanceof AccountSecurityRequestError && err.status === 429) {
        setEmailChangeError('Zbyt wiele prób. Spróbuj ponownie za chwilę.')
      } else {
        setEmailChangeError(err instanceof Error ? err.message : 'Nie udało się rozpocząć zmiany adresu e-mail.')
      }
    } finally {
      setEmailChangeState('idle')
    }
  }

  if (status === 'error') {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4 px-4 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-destructive/10 text-destructive">
          <AlertCircle className="h-5 w-5" aria-hidden="true" />
        </div>
        <div>
          <p className="text-sm font-semibold text-foreground">Nie udało się sprawdzić dostępu do konta.</p>
          <p className="mt-1 max-w-md text-sm text-muted-foreground">
            {error ?? 'Odśwież stronę albo zaloguj się ponownie.'}
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Button type="button" onClick={() => window.location.reload()} className="h-10 font-semibold">
            <RefreshCw className="h-4 w-4" aria-hidden="true" />
            Spróbuj ponownie
          </Button>
          <Button type="button" variant="outline" onClick={logout} className="h-10">
            <LogOut className="h-4 w-4" aria-hidden="true" />
            Wyloguj się
          </Button>
        </div>
      </div>
    )
  }

  if (needsEmailVerification) {
    return (
      <div className="flex min-h-[calc(100vh-3.5rem)] items-center justify-center px-4 py-10 sm:px-6">
        <section className="w-full max-w-lg overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
          <div className="border-b border-border bg-muted/35 px-5 py-4 sm:px-6">
            <BeeLogo size="md" />
          </div>
          <div className="px-5 py-7 text-center sm:px-8 sm:py-8">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-accent">
              {verificationState === 'verified' ? (
                <CheckCircle2 className="h-6 w-6 text-bee-yellow-dark" aria-hidden="true" />
              ) : (
                <MailCheck className="h-6 w-6 text-bee-yellow-dark" aria-hidden="true" />
              )}
            </div>
            <h1 className="mt-5 text-2xl font-bold tracking-tight text-foreground">Potwierdź swój adres e-mail</h1>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
              Na <span className="font-medium text-foreground">{user?.email}</span> wysłaliśmy wiadomość z linkiem weryfikacyjnym.
              Potwierdź adres, aby korzystać ze wszystkich funkcji Runbee.
            </p>

            {verificationMessage && (
              <p
                className={
                  verificationTone === 'success'
                    ? 'mt-4 rounded-xl border border-success/30 bg-success-surface px-3 py-2 text-sm text-success-on-surface'
                    : verificationTone === 'error'
                      ? 'mt-4 rounded-xl border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive'
                      : 'mt-4 rounded-xl border border-border bg-muted/45 px-3 py-2 text-sm text-muted-foreground'
                }
              >
                {verificationMessage}
              </p>
            )}

            <div className="mt-6 flex flex-col gap-2">
              <Button onClick={handleRefreshVerification} disabled={verificationState === 'checking'} className="h-10 w-full font-semibold">
                {verificationState === 'checking' ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                Sprawdziłem maila
              </Button>
              <Button variant="outline" onClick={handleResendVerification} disabled={verificationState === 'sending'} className="h-10 w-full">
                {verificationState === 'sending' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                Wyślij ponownie
              </Button>
              <Button type="button" variant="ghost" onClick={() => setEmailChangeOpen((open) => !open)} className="h-10 w-full">
                <PencilLine className="h-4 w-4" aria-hidden="true" />
                Mam literówkę w adresie
              </Button>
              {emailChangeOpen && (
                <form onSubmit={handleEmailChange} className="mt-2 rounded-xl border border-border bg-muted/35 p-4 text-left">
                  <p className="text-sm font-semibold text-foreground">Popraw adres e-mail</p>
                  <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                    Wyślemy link potwierdzający na nowy adres. Ze względów bezpieczeństwa wpisz obecne hasło.
                  </p>
                  <div className="mt-3 space-y-3">
                    <div>
                      <label htmlFor="verification-new-email" className="text-xs font-medium text-foreground">Nowy adres e-mail</label>
                      <Input
                        id="verification-new-email"
                        type="email"
                        autoComplete="email"
                        value={newEmail}
                        onChange={(event) => setNewEmail(event.target.value)}
                        required
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <label htmlFor="verification-current-password" className="text-xs font-medium text-foreground">Obecne hasło</label>
                      <Input
                        id="verification-current-password"
                        type="password"
                        autoComplete="current-password"
                        value={currentPassword}
                        onChange={(event) => setCurrentPassword(event.target.value)}
                        required
                        className="mt-1"
                      />
                    </div>
                  </div>
                  {emailChangeError && (
                    <p className="mt-3 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
                      {emailChangeError}
                    </p>
                  )}
                  <Button type="submit" disabled={emailChangeState === 'submitting'} className="mt-4 h-10 w-full font-semibold">
                    {emailChangeState === 'submitting' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                    Wyślij link na nowy adres
                  </Button>
                </form>
              )}
              <button type="button" onClick={logout} className="mt-2 inline-flex items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">
                <LogOut className="h-4 w-4" aria-hidden="true" />
                Wyloguj się
              </button>
            </div>
          </div>
        </section>
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
