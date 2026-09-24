import { PASSWORD_RESET_SUCCESS_MESSAGE } from '@/lib/account-security-core'

export class AccountSecurityRequestError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly retryAfterSeconds?: number,
    public readonly code?: string,
  ) {
    super(message)
    this.name = 'AccountSecurityRequestError'
  }
}

async function parseErrorResponse(res: Response): Promise<{ message: string; code?: string; retryAfterSeconds?: number }> {
  let body: Record<string, unknown> = {}
  try {
    body = await res.json() as Record<string, unknown>
  } catch {
    body = {}
  }
  const retryAfterHeader = res.headers.get('Retry-After')
  const retryAfterSeconds = Number(body.retryAfterSeconds ?? retryAfterHeader)
  return {
    message: typeof body.error === 'string' ? body.error : 'Operacja nie powiodła się.',
    code: typeof body.code === 'string' ? body.code : undefined,
    retryAfterSeconds: Number.isFinite(retryAfterSeconds) ? retryAfterSeconds : undefined,
  }
}

export async function requestPasswordResetEmail(
  email: string,
  fetchImpl: typeof fetch = fetch,
): Promise<{ message: string }> {
  const res = await fetchImpl('/api/auth/password-reset', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email }),
  })

  if (!res.ok) {
    const parsed = await parseErrorResponse(res)
    throw new AccountSecurityRequestError(parsed.message, res.status, parsed.retryAfterSeconds, parsed.code)
  }

  let body: Record<string, unknown> = {}
  try {
    body = await res.json() as Record<string, unknown>
  } catch {
    body = {}
  }
  return { message: typeof body.message === 'string' ? body.message : PASSWORD_RESET_SUCCESS_MESSAGE }
}

export async function requestEmailChangeVerification(
  idToken: string,
  newEmail: string,
  fetchImpl: typeof fetch = fetch,
): Promise<void> {
  const res = await fetchImpl('/api/auth/request-email-change', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${idToken}`,
    },
    body: JSON.stringify({ newEmail }),
  })

  if (!res.ok) {
    const parsed = await parseErrorResponse(res)
    throw new AccountSecurityRequestError(parsed.message, res.status, parsed.retryAfterSeconds, parsed.code)
  }
}

export async function requestPasswordChangedNotification(
  idToken: string,
  fetchImpl: typeof fetch = fetch,
): Promise<void> {
  const res = await fetchImpl('/api/auth/password-changed-notification', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${idToken}`,
    },
    body: '{}',
  })

  if (!res.ok) {
    const parsed = await parseErrorResponse(res)
    throw new AccountSecurityRequestError(parsed.message, res.status, parsed.retryAfterSeconds, parsed.code)
  }
}

export async function syncEmailChangeAfterAction(
  oobCode: string,
  fetchImpl: typeof fetch = fetch,
): Promise<void> {
  const res = await fetchImpl('/api/auth/sync-email-change', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ oobCode }),
  })

  if (!res.ok) {
    const parsed = await parseErrorResponse(res)
    throw new AccountSecurityRequestError(parsed.message, res.status, parsed.retryAfterSeconds, parsed.code)
  }
}
