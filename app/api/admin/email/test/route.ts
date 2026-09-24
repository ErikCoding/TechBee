import { timingSafeEqual } from 'crypto'
import { NextResponse } from 'next/server'
import { sendTransactionalEmail, textToEmailParagraphs } from '@/lib/email/transactional-email.server'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

function isAuthorized(authorization: string | null, secret: string | undefined): { ok: true } | { ok: false; status: number; error: string } {
  if (!secret?.trim()) {
    return { ok: false, status: 503, error: 'EMAIL_TEST_SECRET is not configured.' }
  }

  const prefix = 'Bearer '
  if (!authorization?.startsWith(prefix)) {
    return { ok: false, status: 401, error: 'Unauthorized.' }
  }

  const token = authorization.slice(prefix.length).trim()
  const expected = secret.trim()
  const tokenBuffer = Buffer.from(token)
  const expectedBuffer = Buffer.from(expected)
  if (tokenBuffer.length !== expectedBuffer.length || !timingSafeEqual(tokenBuffer, expectedBuffer)) {
    return { ok: false, status: 401, error: 'Unauthorized.' }
  }

  return { ok: true }
}

export async function POST(request: Request) {
  const auth = isAuthorized(request.headers.get('authorization'), process.env.EMAIL_TEST_SECRET)
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const body = await request.json().catch(() => null)
  if (!body || typeof body !== 'object') {
    return NextResponse.json({ error: 'Nieprawidłowe żądanie.' }, { status: 400 })
  }

  const to = String((body as { to?: unknown }).to ?? '').trim().toLowerCase()
  if (!EMAIL_RE.test(to)) {
    return NextResponse.json({ error: 'Podaj poprawny adres e-mail odbiorcy.' }, { status: 400 })
  }

  const text = [
    'Cześć!',
    'To jest kontrolny mail transakcyjny Runbee wysłany przez Resend. Pokazuje bazowy template, którego później użyjemy do ważnych wiadomości produktowych.',
    'Jeżeli widzisz tę wiadomość, domena mail.runbee.pl, klucz API i server-side wysyłka działają poprawnie.',
  ].join('\n\n')

  try {
    const result = await sendTransactionalEmail({
      to,
      subject: 'Test maili transakcyjnych Runbee',
      title: 'Test maili transakcyjnych Runbee',
      preheader: 'Kontrolna wiadomość wysłana przez Resend.',
      contentHtml: textToEmailParagraphs(text),
      details: [
        { label: 'Data', value: '25 września 2026' },
        { label: 'Godzina', value: '18:00' },
        { label: 'Przedmiot', value: 'Matematyka' },
        { label: 'Nauczyciel', value: 'Jan Kowalski' },
      ],
      text,
      cta: {
        label: 'Otwórz Runbee',
        href: 'https://runbee.pl',
      },
      secondaryText: 'To przykładowy mail testowy. Nie oznacza jeszcze uruchomienia żadnych automatycznych wiadomości dla użytkowników.',
    })

    return NextResponse.json({ ok: true, id: result.id })
  } catch {
    return NextResponse.json({ error: 'Nie udało się wysłać testowego maila.' }, { status: 500 })
  }
}
