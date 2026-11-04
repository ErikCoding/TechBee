'use client'

import { useState } from 'react'
import { AlertTriangle, CheckCircle2, Loader2, Send } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { FormError } from '@/components/ui/form-error'
import { useAuth } from '@/lib/auth-context'
import { PROBLEM_CATEGORIES, type ProblemCategoryId } from '@/lib/problem-report-core'
import { submitContactMessage } from '@/services/support.service'

type Props = { targetKind?: 'profile' | 'lesson'; targetId?: string; targetName?: string }

const TARGET_LABEL = { profile: 'Profil nauczyciela', lesson: 'Lekcja' } as const

export function ReportProblemForm({ targetKind, targetId, targetName }: Props) {
  const { user } = useAuth()
  const [category, setCategory] = useState<ProblemCategoryId | ''>('')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [message, setMessage] = useState('')
  const [website, setWebsite] = useState('')
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent'>('idle')
  const [error, setError] = useState<string | null>(null)

  const target = targetKind && targetId ? `${TARGET_LABEL[targetKind]}: ${targetName ? `${targetName} ` : ''}(${targetId})` : ''
  const isChildSafety = category === 'child_safety'

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!category) { setError('Wybierz rodzaj zgłoszenia.'); return }
    setStatus('sending')
    setError(null)
    try {
      await submitContactMessage({
        name: name || user?.name || '',
        email: email || user?.email || '',
        subject: 'Zgłoszenie problemu',
        message: user ? `${message}\n\n[Zgłaszający zalogowany: ${user.id}]` : message,
        website,
        source: 'report-problem',
        category,
        target,
      })
      setStatus('sent')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Nie udało się wysłać zgłoszenia.')
      setStatus('idle')
    }
  }

  if (status === 'sent') {
    return (
      <div className="flex flex-col items-center gap-2 rounded-2xl border border-border bg-card p-8 text-center">
        <CheckCircle2 className="h-8 w-8 text-success" aria-hidden="true" />
        <p className="font-semibold text-foreground">Zgłoszenie wysłane</p>
        <p className="text-sm text-muted-foreground">Potwierdzimy jego otrzymanie i wyjaśnimy sprawę. Zgłoszenia dotyczące bezpieczeństwa dzieci rozpatrujemy w pierwszej kolejności.</p>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-6">
      {target && (
        <p className="rounded-lg bg-muted/60 px-3 py-2 text-xs text-muted-foreground">
          <span className="font-semibold text-foreground">Dotyczy:</span> {target}
        </p>
      )}
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 text-xs font-medium text-foreground">Czego dotyczy zgłoszenie?</legend>
        {PROBLEM_CATEGORIES.map((c) => (
          <label key={c.id} className={`flex cursor-pointer items-center gap-2.5 rounded-lg border px-3 py-2 text-sm transition-colors ${category === c.id ? 'border-primary/60 bg-primary/5 text-foreground' : 'border-border text-muted-foreground hover:text-foreground'}`}>
            <input type="radio" name="category" value={c.id} checked={category === c.id} onChange={() => setCategory(c.id)} className="h-4 w-4 accent-primary" />
            {c.label}
          </label>
        ))}
      </fieldset>
      {isChildSafety && (
        <p role="note" className="flex items-start gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs leading-relaxed text-amber-200">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          Jeśli dziecko jest w bezpośrednim niebezpieczeństwie, zadzwoń najpierw pod numer alarmowy 112. Telefon zaufania dla dzieci i młodzieży: 116 111.
        </p>
      )}
      {!user && (
        <>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="report-name" className="text-xs font-medium text-foreground">Imię i nazwisko</label>
            <Input id="report-name" required value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="report-email" className="text-xs font-medium text-foreground">Adres e-mail</label>
            <Input id="report-email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
        </>
      )}
      <div className="flex flex-col gap-1.5">
        <label htmlFor="report-message" className="text-xs font-medium text-foreground">Opis (co się stało, kiedy, gdzie)</label>
        <textarea
          id="report-message"
          required
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          rows={5}
          className="w-full rounded-lg border border-input bg-transparent px-3 py-2 text-sm outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
        />
      </div>
      <input type="text" tabIndex={-1} autoComplete="off" value={website} onChange={(e) => setWebsite(e.target.value)} className="hidden" aria-hidden="true" />
      <FormError>{error}</FormError>
      <Button type="submit" disabled={status === 'sending'} className="font-semibold">
        {status === 'sending' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        Wyślij zgłoszenie
      </Button>
    </form>
  )
}
