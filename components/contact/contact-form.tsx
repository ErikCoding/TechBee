'use client'

import { useState } from 'react'
import { Loader2, Send, CheckCircle2 } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'

/** Demo-only: no backend wired up yet, just simulates a submit. */
export function ContactForm() {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [message, setMessage] = useState('')
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent'>('idle')

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setStatus('sending')
    setTimeout(() => setStatus('sent'), 700)
  }

  if (status === 'sent') {
    return (
      <div className="flex flex-col items-center gap-2 rounded-2xl border border-border bg-card p-8 text-center">
        <CheckCircle2 className="h-8 w-8 text-emerald-500" aria-hidden="true" />
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
      <Button type="submit" disabled={status === 'sending'} className="mt-1 bg-[#F4B400] text-[#0A0A0A] hover:bg-[#FBBF24] font-semibold">
        {status === 'sending' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        Wyślij wiadomość
      </Button>
    </form>
  )
}
