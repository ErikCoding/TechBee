'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { Loader2, LogIn, AlertCircle } from 'lucide-react'
import { AuthShell } from '@/components/auth/auth-shell'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/lib/auth-context'
import { demoAccounts } from '@/services/auth.service'
import { isFirebaseConfigured } from '@/lib/firebase'
import { dashboardPathForRole } from '@/lib/utils'

export function LoginForm() {
  const { login } = useAuth()
  const router = useRouter()
  const searchParams = useSearchParams()
  const redirect = searchParams.get('redirect')

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      const user = await login({ email, password })
      router.push(redirect ?? dashboardPathForRole(user.role))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Nie udało się zalogować.')
      setLoading(false)
    }
  }

  return (
    <AuthShell
      title="Zaloguj się do TechBee"
      subtitle="Wróć do swoich lekcji, portfela i BeePoints"
      footer={
        <>
          Nie masz konta?{' '}
          <Link href="/register" className="font-medium text-foreground underline underline-offset-4 hover:text-[#F4B400]">
            Zarejestruj się
          </Link>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="email" className="text-xs font-medium text-foreground">Adres e-mail</label>
          <Input id="email" type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="ty@przyklad.pl" />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="password" className="text-xs font-medium text-foreground">Hasło</label>
          <Input id="password" type="password" required autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" />
        </div>

        {error && (
          <div className="flex items-start gap-2 rounded-lg bg-destructive/10 px-3 py-2 text-xs text-destructive">
            <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            {error}
          </div>
        )}

        <Button type="submit" disabled={loading} className="mt-1 bg-[#F4B400] text-[#0A0A0A] hover:bg-[#FBBF24] font-semibold">
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogIn className="h-4 w-4" />}
          Zaloguj się
        </Button>
      </form>

      {!isFirebaseConfigured && (
        <div className="mt-6 border-t border-border pt-5">
          <p className="text-center text-xs font-medium text-muted-foreground">Szybki podgląd bez rejestracji</p>
          <div className="mt-3 flex flex-col gap-2 sm:flex-row">
            {demoAccounts.map((acc) => (
              <button
                key={acc.email}
                type="button"
                onClick={() => { setEmail(acc.email); setPassword(acc.password) }}
                className="flex-1 rounded-xl border border-border px-3 py-2 text-left text-xs transition-colors hover:border-[#F4B400]/50 hover:bg-muted/50"
              >
                <span className="block font-medium text-foreground">{acc.label}</span>
                <span className="text-muted-foreground">{acc.email}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </AuthShell>
  )
}
