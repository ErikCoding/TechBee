import type { ActionCodeSettings } from 'firebase-admin/auth'

type VerifiedToken = {
  uid: string
}

type AuthUserForVerification = {
  uid: string
  email?: string
  emailVerified: boolean
  displayName?: string | null
}

type RateLimitResult = {
  allowed: boolean
  retryAfterSeconds?: number
}

export type SendVerificationEmailDeps = {
  actionCodeSettings: ActionCodeSettings
  verifyIdToken: (idToken: string) => Promise<VerifiedToken>
  getUser: (uid: string) => Promise<AuthUserForVerification>
  getFirstName?: (uid: string) => Promise<string | null>
  checkRateLimit: (uid: string, now: number) => Promise<RateLimitResult>
  generateEmailVerificationLink: (email: string, actionCodeSettings: ActionCodeSettings) => Promise<string>
  sendEmailVerificationEmail: (input: { to: string; firstName?: string | null; verificationLink: string }) => Promise<unknown>
  now?: () => number
}

export type SendVerificationEmailResult = {
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

function firstNameFromDisplayName(displayName: string | null | undefined): string | null {
  const firstName = displayName?.trim().split(/\s+/)[0]
  return firstName || null
}

export async function handleSendVerificationEmailRequest(
  authorization: string | null,
  deps: SendVerificationEmailDeps,
): Promise<SendVerificationEmailResult> {
  const idToken = bearerToken(authorization)
  if (!idToken) {
    return { status: 401, body: { error: 'Musisz być zalogowany.' } }
  }

  let uid: string
  try {
    const verified = await deps.verifyIdToken(idToken)
    uid = verified.uid
  } catch {
    return { status: 401, body: { error: 'Musisz być zalogowany.' } }
  }

  let user: AuthUserForVerification
  try {
    user = await deps.getUser(uid)
  } catch {
    return { status: 401, body: { error: 'Musisz być zalogowany.' } }
  }

  if (user.emailVerified) {
    return { status: 200, body: { ok: true, alreadyVerified: true } }
  }

  const email = user.email?.trim().toLowerCase()
  if (!email) {
    return { status: 400, body: { error: 'To konto nie ma adresu e-mail do weryfikacji.' } }
  }

  const now = deps.now?.() ?? Date.now()
  const rateLimit = await deps.checkRateLimit(uid, now)
  if (!rateLimit.allowed) {
    const retryAfter = Math.max(1, Math.ceil(rateLimit.retryAfterSeconds ?? 60))
    return {
      status: 429,
      body: {
        error: 'Zbyt wiele prób wysyłki. Spróbuj ponownie za chwilę.',
        retryAfterSeconds: retryAfter,
      },
      headers: { 'Retry-After': String(retryAfter) },
    }
  }

  let verificationLink: string
  try {
    verificationLink = await deps.generateEmailVerificationLink(email, deps.actionCodeSettings)
  } catch {
    return { status: 500, body: { error: 'Nie udało się przygotować linku weryfikacyjnego.' } }
  }

  const firstName = await deps.getFirstName?.(uid).catch(() => null)
    ?? firstNameFromDisplayName(user.displayName)

  try {
    await deps.sendEmailVerificationEmail({ to: email, firstName, verificationLink })
  } catch {
    return { status: 502, body: { error: 'Nie udało się wysłać maila weryfikacyjnego. Spróbuj ponownie.' } }
  }

  return { status: 200, body: { ok: true } }
}
