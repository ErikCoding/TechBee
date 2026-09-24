export class EmailVerificationRequestError extends Error {
  status: number
  retryAfterSeconds?: number

  constructor(message: string, status: number, retryAfterSeconds?: number) {
    super(message)
    this.name = 'EmailVerificationRequestError'
    this.status = status
    this.retryAfterSeconds = retryAfterSeconds
  }
}

type FetchLike = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>

export async function requestEmailVerificationEmail(idToken: string, fetchImpl: FetchLike = fetch): Promise<void> {
  const res = await fetchImpl('/api/auth/send-verification-email', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${idToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({}),
  })

  if (res.ok) return

  const retryAfterHeader = res.headers.get('retry-after')
  const retryAfterSeconds = retryAfterHeader ? Number(retryAfterHeader) : undefined
  const body = await res.json().catch(() => null) as { error?: unknown } | null
  const fallback = res.status === 429
    ? 'Zbyt wiele prób wysyłki. Spróbuj ponownie za chwilę.'
    : 'Nie udało się wysłać maila weryfikacyjnego.'
  const message = typeof body?.error === 'string' ? body.error : fallback
  throw new EmailVerificationRequestError(
    res.status === 429 ? `too-many-requests: ${message}` : message,
    res.status,
    Number.isFinite(retryAfterSeconds) ? retryAfterSeconds : undefined,
  )
}
