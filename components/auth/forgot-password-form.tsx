'use client'

import { useState } from 'react'
import Link from 'next/link'
import { AlertCircle, CheckCircle2, Loader2, Mail } from 'lucide-react'
import { AuthShell } from '@/components/auth/auth-shell'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { requestPasswordResetEmail } from '@/lib/account-security-client'

export function ForgotPasswordForm() {
  const [email, setEmail] = useState('')
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    setMessage(null)
    setError(null)
    setLoading(true)
    try {
      const result = await requestPasswordResetEmail(email)
      setMessage(result.message)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Nie udało się wysłać instrukcji zmiany hasła.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthShell
      title="Zmień hasło"
      subtitle="Podaj adres e-mail konta Runbee"
      footer={
        <>
          Pamiętasz hasło?{' '}
          <Link href="/login" className="font-medium text-foreground underline underline-offset-4 hover:text-primary">
            Zaloguj się
          </Link>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="reset-email" className="text-xs font-medium text-foreground">Adres e-mail</label>
          <Input id="reset-email" type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="ty@przyklad.pl" />
        </div>

        {message && (
          <div className="flex items-start gap-2 rounded-lg border border-success/30 bg-success-surface px-3 py-2 text-xs text-success-on-surface">
            <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            {message}
          </div>
        )}

        {error && (
          <div className="flex items-start gap-2 rounded-lg bg-destructive/10 px-3 py-2 text-xs text-destructive">
            <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            {error}
          </div>
        )}

        <Button type="submit" disabled={loading} className="mt-1 font-semibold">
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
          Wyślij instrukcję
        </Button>
      </form>
    </AuthShell>
  )
}
