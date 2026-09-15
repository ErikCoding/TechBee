import { NextResponse } from 'next/server'
import { adminDb, isAdminConfigured } from '@/lib/firebase-admin'
import { collections } from '@/lib/firebase'
import type { SupportMessage } from '@/lib/types'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function clean(value: unknown, maxLength: number): string {
  return String(value ?? '').replace(/\s+/g, ' ').trim().slice(0, maxLength)
}

export async function POST(request: Request) {
  if (!isAdminConfigured || !adminDb) {
    return NextResponse.json({ error: 'Odbieranie wiadomości nie jest jeszcze skonfigurowane.' }, { status: 503 })
  }

  const body = await request.json().catch(() => null)
  if (!body || typeof body !== 'object') {
    return NextResponse.json({ error: 'Nieprawidłowe zgłoszenie.' }, { status: 400 })
  }

  // Honeypot for basic bots. Pretend it succeeded, but do not store it.
  if (clean((body as { website?: unknown }).website, 120)) {
    return NextResponse.json({ ok: true })
  }

  const name = clean((body as { name?: unknown }).name, 80)
  const email = clean((body as { email?: unknown }).email, 160).toLowerCase()
  const subject = clean((body as { subject?: unknown }).subject, 120) || 'Wiadomość ze strony'
  const message = String((body as { message?: unknown }).message ?? '').trim().slice(0, 4000)

  if (name.length < 2) {
    return NextResponse.json({ error: 'Podaj imię i nazwisko.' }, { status: 400 })
  }
  if (!EMAIL_RE.test(email)) {
    return NextResponse.json({ error: 'Podaj poprawny adres e-mail.' }, { status: 400 })
  }
  if (message.length < 10) {
    return NextResponse.json({ error: 'Wiadomość musi mieć co najmniej 10 znaków.' }, { status: 400 })
  }

  const now = Date.now()
  const record: Omit<SupportMessage, 'id'> = {
    name,
    email,
    subject,
    message,
    status: 'unread',
    createdAt: now,
    updatedAt: now,
    source: 'contact-page',
  }

  const ref = await adminDb.collection(collections.supportMessages).add(record)
  return NextResponse.json({ ok: true, id: ref.id })
}
