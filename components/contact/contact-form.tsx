'use client'

import { useState } from 'react'
import { Loader2, Send, CheckCircle2 } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { FormError } from '@/components/ui/form-error'
import { submitContactMessage } from '@/services/support.service'

export function ContactForm() {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [subject, setSubject] = useState('')
  const [message, setMessage] = useState('')
  const [website, setWebsite] = useState('')
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent'>('idle')
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setStatus('sending')
    setError(null)
    try {
      await submitContactMessage({ name, email, subject, message, website })
      setStatus('sent')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Nie udało się wysłać wiadomości.')
      setStatus('idle')
    }
  }

  if (status === 'sent') {
    return (
      <div className="flex flex-col items-center gap-2 rounded-2xl border border-border bg-card p-8 text-center">
        <CheckCircle2 className="h-8 w-8 text-success" aria-hidden="true" />
        <p className="font-semibold text-foreground">Wiadomość wysłana</p>
        <p className="text-sm text-muted-foreground">Odpowiemy najszybciej, jak to możliwe — zwykle w ciągu 1 dnia roboczego.</p>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-6">
      <div className="flex flex-col gap-1.5">
        <label htmlFor="contact-name" className="text-xs font-medium text-foreground">Imię i nazwisko</label>
        <Input id="contact-name" required value={name} onChange={(e) => setName(e.target.value)} placeholder="Jan Kowalski" />
      </div>
      <div className="flex flex-col gap-1.5">
        <label htmlFor="contact-email" className="text-xs font-medium text-foreground">Adres e-mail</label>
        <Input id="contact-email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="ty@przyklad.pl" />
      </div>
      <div className="flex flex-col gap-1.5">
        <label htmlFor="contact-subject" className="text-xs font-medium text-foreground">Temat</label>
        <Input id="contact-subject" value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Krótko, czego dotyczy sprawa" />
      </div>
      <div className="flex flex-col gap-1.5">
        <label htmlFor="contact-message" className="text-xs font-medium text-foreground">Wiadomość</label>
        <textarea
          id="contact-message"
          required
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          rows={5}
          placeholder="W czym możemy pomóc?"
          className="w-full rounded-lg border border-input bg-transparent px-3 py-2 text-sm outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
        />
      </div>
      <input
        type="text"
        tabIndex={-1}
        autoComplete="off"
        value={website}
        onChange={(e) => setWebsite(e.target.value)}
        className="hidden"
        aria-hidden="true"
      />
      <FormError>{error}</FormError>
      <Button type="submit" disabled={status === 'sending'} className="mt-1 font-semibold">
        {status === 'sending' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        Wyślij wiadomość
      </Button>
    </form>
  )
}
