'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { Loader2, UserPlus, AlertCircle, GraduationCap, Wrench, Users, MailCheck } from 'lucide-react'
import { AuthShell } from '@/components/auth/auth-shell'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/lib/auth-context'
import { requireEmailVerification } from '@/lib/email-verification'
import { cn, dashboardPathForRole } from '@/lib/utils'
import type { PublicUserRole } from '@/lib/types'

const roleOptions: { value: PublicUserRole; label: string; description: string; icon: React.ElementType }[] = [
  { value: 'student', label: 'Jestem uczniem', description: 'Chcę uczyć się od ekspertów', icon: GraduationCap },
  { value: 'teacher', label: 'Jestem nauczycielem', description: 'Chcę uczyć i zarabiać', icon: Wrench },
  { value: 'parent', label: 'Jestem rodzicem', description: 'Chcę nadzorować naukę dziecka', icon: Users },
]

export function RegisterForm() {
  const { register } = useAuth()
  const router = useRouter()
  const searchParams = useSearchParams()
  const roleParam = searchParams.get('role')
  const initialRole: PublicUserRole = roleParam === 'teacher' || roleParam === 'parent' ? roleParam : 'student'

  const [role, setRole] = useState<PublicUserRole>(initialRole)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [verificationSentTo, setVerificationSentTo] = useState<string | null>(null)
  const [verificationSendFailed, setVerificationSendFailed] = useState(false)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (password.length < 6) {
      setError('Hasło musi mieć co najmniej 6 znaków.')
      return
    }
    setLoading(true)
    try {
      const user = await register({ name, email, password, role })
      if (requireEmailVerification && user.emailVerified === false) {
        setVerificationSentTo(user.email)
        setVerificationSendFailed(user.verificationEmailSent === false)
        setLoading(false)
        return
      }
      router.push(dashboardPathForRole(user.role))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Nie udało się utworzyć konta.')
      setLoading(false)
    }
  }

  return (
    <AuthShell
      title="Załóż konto Runbee"
      subtitle="Oglądać ofertę możesz bez konta — do rezerwacji, portfela i BeePoints potrzebujesz konta"
      footer={
        <>
          Masz już konto?{' '}
          <Link href="/login" className="font-medium text-foreground underline underline-offset-4 hover:text-primary">
            Zaloguj się
          </Link>
        </>
      }
    >
      {verificationSentTo ? (
        <div className="flex flex-col items-center gap-4 rounded-2xl border border-border bg-card p-6 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-accent">
            <MailCheck className="h-5 w-5 text-bee-yellow-dark" aria-hidden="true" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-foreground">Sprawdź skrzynkę</h2>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              {verificationSendFailed
                ? `Konto zostało utworzone dla ${verificationSentTo}, ale nie udało się wysłać wiadomości weryfikacyjnej. Przejdź do logowania i użyj opcji ponownej wysyłki.`
                : `Wysłaliśmy link potwierdzający na ${verificationSentTo}. Konto będzie wpuszczane do panelu dopiero po potwierdzeniu adresu.`}
            </p>
          </div>
          <Button onClick={() => router.push('/login')} className="w-full font-semibold">
            Przejdź do logowania
          </Button>
        </div>
      ) : (
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        {/* Account type */}
        <div>
          <p className="mb-2 text-xs font-medium text-foreground">Typ konta</p>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            {roleOptions.map((opt) => {
              const Icon = opt.icon
              const active = role === opt.value
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setRole(opt.value)}
                  aria-pressed={active}
                  className={cn(
                    'flex flex-col items-start gap-1.5 rounded-xl border p-3 text-left transition-all',
                    active
                      ? 'border-primary bg-accent'
                      : 'border-border hover:border-foreground/30',
                  )}
                >
                  <Icon className={cn('h-4 w-4', active ? 'text-bee-yellow-dark' : 'text-muted-foreground')} aria-hidden="true" />
                  <span className={cn('text-xs font-semibold', active ? 'text-accent-foreground' : 'text-foreground')}>{opt.label}</span>
                  <span className="text-[11px] leading-snug text-muted-foreground">{opt.description}</span>
                </button>
              )
            })}
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="name" className="text-xs font-medium text-foreground">Imię i nazwisko</label>
          <Input id="name" required autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Jan Kowalski" />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="reg-email" className="text-xs font-medium text-foreground">Adres e-mail</label>
          <Input id="reg-email" type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="ty@przyklad.pl" />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="reg-password" className="text-xs font-medium text-foreground">Hasło</label>
          <Input id="reg-password" type="password" required autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Min. 6 znaków" />
        </div>

        {error && (
          <div className="flex items-start gap-2 rounded-lg bg-destructive/10 px-3 py-2 text-xs text-destructive">
            <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            {error}
          </div>
        )}

        <Button type="submit" disabled={loading} className="mt-1 font-semibold">
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
          Utwórz konto
        </Button>
      </form>
      )}
    </AuthShell>
  )
}
