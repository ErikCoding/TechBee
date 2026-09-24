import type { ActionCodeSettings, UserRecord } from 'firebase-admin/auth'

export const RECENT_LOGIN_MAX_AGE_MS = 5 * 60 * 1000
const PASSWORD_RESET_SUCCESS_MESSAGE = 'Jeśli konto z tym adresem istnieje, wysłaliśmy wiadomość z instrukcją zmiany hasła.'

export type PendingEmailChangeForSync = {
  uid: string
  currentEmail: string
  newEmail: string
  oobCodeHash: string
  createdAt: number
  expiresAt: number
  consumedAt?: number
}

type RateLimitResult = {
  allowed: boolean
  retryAfterSeconds?: number
}

type VerifiedToken = {
  uid: string
  auth_time?: number
}

type PasswordResetDeps = {
  actionCodeSettings: ActionCodeSettings
  siteUrl: string
  now?: () => number
  checkRateLimit: (identifier: string, now: number) => Promise<RateLimitResult>
  getUserByEmail: (email: string) => Promise<UserRecord>
  generatePasswordResetLink: (email: string, actionCodeSettings: ActionCodeSettings) => Promise<string>
  sendPasswordResetEmail: (input: { to: string; resetLink: string }) => Promise<unknown>
}

type RequestEmailChangeDeps = {
  actionCodeSettings: ActionCodeSettings
  siteUrl: string
  now?: () => number
  verifyIdToken: (idToken: string) => Promise<VerifiedToken>
  getUser: (uid: string) => Promise<UserRecord>
  checkRateLimit: (uid: string, now: number) => Promise<RateLimitResult>
  generateVerifyAndChangeEmailLink: (email: string, newEmail: string, actionCodeSettings: ActionCodeSettings) => Promise<string>
  savePendingEmailChange: (input: { uid: string; currentEmail: string; newEmail: string; oobCode: string; now: number }) => Promise<unknown>
  sendEmailChangeVerificationEmail: (input: { to: string; changeEmailLink: string; currentEmail: string; newEmail: string }) => Promise<unknown>
}

type PasswordChangedNotificationDeps = {
  verifyIdToken: (idToken: string) => Promise<VerifiedToken>
  getUser: (uid: string) => Promise<UserRecord>
  sendPasswordChangedEmail: (input: { to: string }) => Promise<unknown>
}

type SyncEmailChangeDeps = {
  now?: () => number
  getPendingEmailChange: (oobCode: string, now: number) => Promise<PendingEmailChangeForSync | null>
  getUser: (uid: string) => Promise<UserRecord>
  updateUserEmail: (uid: string, email: string) => Promise<unknown>
  markPendingEmailChangeConsumed: (oobCode: string, now: number) => Promise<unknown>
}

export type AccountSecurityEndpointResult = {
  status: number
  body: Record<string, unknown>
  headers?: Record<string, string>
}

function bearerToken(authorization: string | null): string | null {
  const prefix = 'Bearer '
  if (!authorization?.startsWith(prefix)) return null
  const token = authorization.slice(prefix.length).trim()
  return token || null
}

function normalizeEmail(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const email = value.trim().toLowerCase()
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return null
  if (email.length > 254) return null
  return email
}

function authTimeIsRecent(authTimeSeconds: number | undefined, nowMs: number, maxAgeMs: number): boolean {
  if (!Number.isFinite(authTimeSeconds)) return false
  return nowMs - Number(authTimeSeconds) * 1000 <= maxAgeMs
}

function extractFirebaseActionParams(link: string): { mode: string; oobCode: string; apiKey?: string; lang?: string } | null {
  let url: URL
  try {
    url = new URL(link)
  } catch {
    return null
  }

  const nestedLink = url.searchParams.get('link')
  if (nestedLink) {
    const nested = extractFirebaseActionParams(nestedLink)
    if (nested) return nested
  }

  const mode = url.searchParams.get('mode')
  const oobCode = url.searchParams.get('oobCode')
  if (!mode || !oobCode) return null
  return {
    mode,
    oobCode,
    apiKey: url.searchParams.get('apiKey') ?? undefined,
    lang: url.searchParams.get('lang') ?? undefined,
  }
}

function buildRunbeeActionLink(
  generatedFirebaseLink: string,
  expectedMode: 'resetPassword' | 'verifyAndChangeEmail',
  baseUrl: string,
): { href: string; oobCode: string } {
  const params = extractFirebaseActionParams(generatedFirebaseLink)
  if (!params || params.mode !== expectedMode) {
    throw new Error('Invalid Firebase action link.')
  }

  const url = new URL('/auth/action', baseUrl)
  url.searchParams.set('mode', params.mode)
  url.searchParams.set('oobCode', params.oobCode)
  if (params.apiKey) url.searchParams.set('apiKey', params.apiKey)
  if (params.lang) url.searchParams.set('lang', params.lang)
  return { href: url.toString(), oobCode: params.oobCode }
}

function rateLimited(retryAfterSeconds: number | undefined): AccountSecurityEndpointResult {
  const retryAfter = Math.max(1, Math.ceil(retryAfterSeconds ?? 60))
  return {
    status: 429,
    body: {
      error: 'Zbyt wiele prób. Spróbuj ponownie za chwilę.',
      retryAfterSeconds: retryAfter,
    },
    headers: { 'Retry-After': String(retryAfter) },
  }
}

function isFirebaseUserNotFoundError(error: unknown): boolean {
  const code = typeof error === 'object' && error && 'code' in error ? String((error as { code?: unknown }).code) : ''
  return code === 'auth/user-not-found'
}

export async function handlePasswordResetRequest(body: unknown, deps: PasswordResetDeps): Promise<AccountSecurityEndpointResult> {
  const email = normalizeEmail(typeof body === 'object' && body ? (body as { email?: unknown }).email : undefined)
  if (!email) {
    return { status: 400, body: { error: 'Podaj poprawny adres e-mail.' } }
  }

  const now = deps.now?.() ?? Date.now()
  const rateLimit = await deps.checkRateLimit(email, now)
  if (!rateLimit.allowed) return rateLimited(rateLimit.retryAfterSeconds)

  let user: UserRecord
  try {
    user = await deps.getUserByEmail(email)
  } catch (error) {
    if (isFirebaseUserNotFoundError(error)) {
      return { status: 200, body: { ok: true, message: PASSWORD_RESET_SUCCESS_MESSAGE } }
    }
    return { status: 500, body: { error: 'Nie udało się obsłużyć prośby zmiany hasła.' } }
  }

  if (user.disabled) {
    return { status: 200, body: { ok: true, message: PASSWORD_RESET_SUCCESS_MESSAGE } }
  }

  let resetLink: string
  try {
    const generatedLink = await deps.generatePasswordResetLink(email, deps.actionCodeSettings)
    resetLink = buildRunbeeActionLink(generatedLink, 'resetPassword', deps.siteUrl).href
  } catch {
    return { status: 500, body: { error: 'Nie udało się przygotować linku zmiany hasła.' } }
  }

  try {
    await deps.sendPasswordResetEmail({ to: email, resetLink })
  } catch {
    return { status: 502, body: { error: 'Nie udało się wysłać wiadomości. Spróbuj ponownie.' } }
  }

  return { status: 200, body: { ok: true, message: PASSWORD_RESET_SUCCESS_MESSAGE } }
}

export async function handleRequestEmailChange(
  authorization: string | null,
  body: unknown,
  deps: RequestEmailChangeDeps,
): Promise<AccountSecurityEndpointResult> {
  const idToken = bearerToken(authorization)
  if (!idToken) return { status: 401, body: { error: 'Musisz być zalogowany.' } }

  let verified: VerifiedToken
  try {
    verified = await deps.verifyIdToken(idToken)
  } catch {
    return { status: 401, body: { error: 'Musisz być zalogowany.' } }
  }

  const now = deps.now?.() ?? Date.now()
  if (!authTimeIsRecent(verified.auth_time, now, RECENT_LOGIN_MAX_AGE_MS)) {
    return {
      status: 401,
      body: { error: 'Ze względów bezpieczeństwa zaloguj się ponownie i spróbuj jeszcze raz.', code: 'requires-recent-login' },
    }
  }

  const newEmail = normalizeEmail(typeof body === 'object' && body ? (body as { newEmail?: unknown }).newEmail : undefined)
  if (!newEmail) {
    return { status: 400, body: { error: 'Podaj poprawny nowy adres e-mail.' } }
  }

  let user: UserRecord
  try {
    user = await deps.getUser(verified.uid)
  } catch {
    return { status: 401, body: { error: 'Musisz być zalogowany.' } }
  }

  const currentEmail = normalizeEmail(user.email)
  if (!currentEmail) {
    return { status: 400, body: { error: 'To konto nie ma adresu e-mail do zmiany.' } }
  }
  if (currentEmail === newEmail) {
    return { status: 400, body: { error: 'Nowy adres jest taki sam jak obecny.' } }
  }

  const rateLimit = await deps.checkRateLimit(verified.uid, now)
  if (!rateLimit.allowed) return rateLimited(rateLimit.retryAfterSeconds)

  let actionLink: { href: string; oobCode: string }
  try {
    const generatedLink = await deps.generateVerifyAndChangeEmailLink(currentEmail, newEmail, deps.actionCodeSettings)
    actionLink = buildRunbeeActionLink(generatedLink, 'verifyAndChangeEmail', deps.siteUrl)
  } catch {
    return { status: 500, body: { error: 'Nie udało się przygotować potwierdzenia zmiany adresu e-mail.' } }
  }

  try {
    await deps.savePendingEmailChange({
      uid: verified.uid,
      currentEmail,
      newEmail,
      oobCode: actionLink.oobCode,
      now,
    })
    await deps.sendEmailChangeVerificationEmail({
      to: newEmail,
      currentEmail,
      newEmail,
      changeEmailLink: actionLink.href,
    })
  } catch {
    return { status: 502, body: { error: 'Nie udało się wysłać potwierdzenia zmiany adresu. Spróbuj ponownie.' } }
  }

  return { status: 200, body: { ok: true } }
}

export async function handlePasswordChangedNotificationRequest(
  authorization: string | null,
  deps: PasswordChangedNotificationDeps,
): Promise<AccountSecurityEndpointResult> {
  const idToken = bearerToken(authorization)
  if (!idToken) return { status: 401, body: { error: 'Musisz być zalogowany.' } }

  let verified: VerifiedToken
  try {
    verified = await deps.verifyIdToken(idToken)
  } catch {
    return { status: 401, body: { error: 'Musisz być zalogowany.' } }
  }

  let user: UserRecord
  try {
    user = await deps.getUser(verified.uid)
  } catch {
    return { status: 401, body: { error: 'Musisz być zalogowany.' } }
  }

  const email = normalizeEmail(user.email)
  if (!email) {
    return { status: 400, body: { error: 'To konto nie ma adresu e-mail do powiadomienia.' } }
  }

  try {
    await deps.sendPasswordChangedEmail({ to: email })
  } catch {
    return { status: 502, body: { error: 'Nie udało się wysłać powiadomienia bezpieczeństwa.' } }
  }

  return { status: 200, body: { ok: true } }
}

export async function handleSyncEmailChange(body: unknown, deps: SyncEmailChangeDeps): Promise<AccountSecurityEndpointResult> {
  const oobCode = typeof body === 'object' && body ? (body as { oobCode?: unknown }).oobCode : undefined
  if (typeof oobCode !== 'string' || !oobCode.trim()) {
    return { status: 400, body: { error: 'Brakuje kodu potwierdzenia.' } }
  }

  const now = deps.now?.() ?? Date.now()
  const pending = await deps.getPendingEmailChange(oobCode, now)
  if (!pending) {
    return { status: 400, body: { error: 'Ten link jest nieważny albo wygasł.' } }
  }

  const user = await deps.getUser(pending.uid)
  const authEmail = normalizeEmail(user.email)
  if (authEmail !== pending.newEmail) {
    return { status: 409, body: { error: 'Zmiana adresu e-mail nie została jeszcze potwierdzona.' } }
  }

  await deps.updateUserEmail(pending.uid, pending.newEmail)
  await deps.markPendingEmailChangeConsumed(oobCode, now)
  return { status: 200, body: { ok: true } }
}
