'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { ActionCodeOperation, applyActionCode, checkActionCode, confirmPasswordReset, reload, verifyPasswordResetCode } from 'firebase/auth'
import { AlertCircle, CheckCircle2, Loader2, LockKeyhole } from 'lucide-react'
import { AuthShell } from '@/components/auth/auth-shell'
import { Button } from '@/components/ui/button'
import { buttonVariants } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { auth, isFirebaseConfigured } from '@/lib/firebase'
import { useAuth } from '@/lib/auth-context'
import { completeEmailChangeAction } from '@/lib/account-security-core'
import { AccountSecurityRequestError, syncEmailChangeAfterAction } from '@/lib/account-security-client'

type ActionState = 'checking' | 'ready' | 'submitting' | 'success' | 'error'

function safeFirebaseActionError(error: unknown): string {
  if (error instanceof AccountSecurityRequestError) return error.message
  const code = typeof error === 'object' && error && 'code' in error ? String((error as { code?: unknown }).code) : ''
  if (code === 'auth/expired-action-code') return 'Ten link wygasł. Poproś o nowy link i spróbuj ponownie.'
  if (code === 'auth/invalid-action-code') return 'Ten link jest nieważny albo został już użyty.'
  if (code === 'auth/weak-password') return 'Nowe hasło jest zbyt słabe.'
  return 'Nie udało się potwierdzić tej operacji. Spróbuj ponownie.'
}

export function AuthActionHandler() {
  const { refreshVerification } = useAuth()
  const searchParams = useSearchParams()
  const mode = searchParams.get('mode')
  const oobCode = searchParams.get('oobCode')
  const [state, setState] = useState<ActionState>('checking')
  const [email, setEmail] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [password, setPassword] = useState('')
  const [passwordRepeat, setPasswordRepeat] = useState('')

  const isPasswordReset = mode === 'resetPassword'
  const isEmailChange = mode === 'verifyAndChangeEmail'

  useEffect(() => {
    let cancelled = false
    async function checkAction() {
      setState('checking')
      setError(null)
      if (!isFirebaseConfigured || !auth || !oobCode || (!isPasswordReset && !isEmailChange)) {
        setError('Ten link jest nieważny.')
        setState('error')
        return
      }

      try {
        if (isPasswordReset) {
          const actionEmail = await verifyPasswordResetCode(auth, oobCode)
          if (!cancelled) setEmail(actionEmail)
        } else {
          const info = await checkActionCode(auth, oobCode)
          if (info.operation !== ActionCodeOperation.VERIFY_AND_CHANGE_EMAIL) {
            throw new Error('Unexpected action.')
          }
          if (!cancelled) setEmail(info.data.email ?? null)
        }
        if (!cancelled) setState('ready')
      } catch (err) {
        if (!cancelled) {
          setError(safeFirebaseActionError(err))
          setState('error')
        }
      }
    }
    void checkAction()
    return () => { cancelled = true }
  }, [isEmailChange, isPasswordReset, oobCode])

  const title = useMemo(() => {
    if (isPasswordReset) return 'Ustaw nowe hasło'
    if (isEmailChange) return 'Potwierdź nowy adres e-mail'
    return 'Potwierdzenie konta'
  }, [isEmailChange, isPasswordReset])

  async function submitPasswordReset(event: React.FormEvent) {
    event.preventDefault()
    if (!auth || !oobCode) return
    setError(null)
    if (password.length < 6) {
      setError('Hasło musi mieć co najmniej 6 znaków.')
      return
    }
    if (password !== passwordRepeat) {
      setError('Hasła nie są takie same.')
      return
    }
    setState('submitting')
    try {
      await confirmPasswordReset(auth, oobCode, password)
      setState('success')
    } catch (err) {
      setError(safeFirebaseActionError(err))
      setState('ready')
    }
  }

  async function confirmEmailChange() {
    if (!auth || !oobCode) return
    const firebaseAuth = auth
    setError(null)
    setState('submitting')
    try {
      await completeEmailChangeAction({
        applyFirebaseActionCode: () => applyActionCode(firebaseAuth, oobCode),
        syncFirestoreEmail: () => syncEmailChangeAfterAction(oobCode),
        reloadFirebaseUser: () => firebaseAuth.currentUser ? reload(firebaseAuth.currentUser) : Promise.resolve(),
        refreshSessionUser: () => refreshVerification(),
      })
      setState('success')
    } catch (err) {
      setError(safeFirebaseActionError(err))
      setState('ready')
    }
  }

  return (
    <AuthShell
      title={title}
      subtitle={isPasswordReset ? 'Wybierz nowe hasło do konta Runbee' : 'Dokończ bezpieczną zmianę adresu'}
      footer={
        <Link href="/login" className="font-medium text-foreground underline underline-offset-4 hover:text-primary">
          Przejdź do logowania
        </Link>
      }
    >
      {state === 'checking' && (
        <div className="flex items-center justify-center gap-2 rounded-xl border border-border bg-muted/35 px-4 py-5 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          Sprawdzamy link...
        </div>
      )}

      {state === 'error' && (
        <div className="flex items-start gap-2 rounded-lg bg-destructive/10 px-3 py-2 text-xs text-destructive">
          <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          {error}
        </div>
      )}

      {state === 'success' && (
        <div className="flex flex-col gap-4 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-success-surface text-success-on-surface">
            <CheckCircle2 className="h-5 w-5" aria-hidden="true" />
          </div>
          <div>
            <p className="text-sm font-semibold text-foreground">
              {isPasswordReset ? 'Hasło zostało zmienione.' : 'Adres e-mail został potwierdzony.'}
            </p>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
              Możesz teraz wrócić do Runbee i kontynuować pracę.
            </p>
          </div>
          <Link href="/login" className={buttonVariants({ className: 'font-semibold' })}>Zaloguj się</Link>
        </div>
      )}

      {state !== 'checking' && state !== 'success' && isPasswordReset && (
        <form onSubmit={submitPasswordReset} className="flex flex-col gap-4">
          {email && <p className="text-center text-xs text-muted-foreground">Zmiana hasła dla: <span className="font-medium text-foreground">{email}</span></p>}
          <div className="flex flex-col gap-1.5">
            <label htmlFor="new-password" className="text-xs font-medium text-foreground">Nowe hasło</label>
            <Input id="new-password" type="password" autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Min. 6 znaków" required />
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="new-password-repeat" className="text-xs font-medium text-foreground">Powtórz nowe hasło</label>
            <Input id="new-password-repeat" type="password" autoComplete="new-password" value={passwordRepeat} onChange={(event) => setPasswordRepeat(event.target.value)} required />
          </div>
          {error && (
            <div className="flex items-start gap-2 rounded-lg bg-destructive/10 px-3 py-2 text-xs text-destructive">
              <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              {error}
            </div>
          )}
          <Button type="submit" disabled={state === 'submitting'} className="font-semibold">
            {state === 'submitting' ? <Loader2 className="h-4 w-4 animate-spin" /> : <LockKeyhole className="h-4 w-4" />}
            Zmień hasło
          </Button>
        </form>
      )}

      {state !== 'checking' && state !== 'success' && isEmailChange && (
        <div className="flex flex-col gap-4">
          <div className="rounded-xl border border-border bg-muted/35 px-4 py-3 text-sm leading-relaxed text-muted-foreground">
            Potwierdzenie zakończy zmianę adresu e-mail konta Runbee. Bez tego kroku obecny adres pozostanie aktywny.
          </div>
          {error && (
            <div className="flex items-start gap-2 rounded-lg bg-destructive/10 px-3 py-2 text-xs text-destructive">
              <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              {error}
            </div>
          )}
          <Button type="button" onClick={confirmEmailChange} disabled={state === 'submitting'} className="font-semibold">
            {state === 'submitting' ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
            Potwierdź zmianę adresu
          </Button>
        </div>
      )}
    </AuthShell>
  )
}
