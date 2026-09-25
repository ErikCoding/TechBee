import type { AdminActionCodeSettings } from '@/lib/firebase-admin-auth'

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
  actionCodeSettings: AdminActionCodeSettings
  verifyIdToken: (idToken: string) => Promise<VerifiedToken>
  getUser: (uid: string) => Promise<AuthUserForVerification>
  getFirstName?: (uid: string) => Promise<string | null>
  checkRateLimit: (uid: string, now: number) => Promise<RateLimitResult>
  generateEmailVerificationLink: (email: string, actionCodeSettings: AdminActionCodeSettings) => Promise<string>
  sendEmailVerificationEmail: (input: { to: string; firstName?: string | null; verificationLink: string }) => Promise<unknown>
  logDiagnostic?: (diagnostic: SendVerificationDiagnostic) => void
  now?: () => number
}

export type SendVerificationEmailResult = {
  status: number
  body: Record<string, unknown>
  headers?: Record<string, string>
}

export type SendVerificationDiagnosticCode =
  | 'missing_authorization'
  | 'malformed_authorization'
  | 'verify_id_token_failed'
  | 'get_user_failed'
  | 'firebase_auth_config_missing'
  | 'firebase_auth_project_mismatch'
  | 'firebase_auth_iam_error'
  | 'unknown_server_auth_error'

export type SendVerificationDiagnostic = {
  diagnosticCode: SendVerificationDiagnosticCode
  stage: 'authorization' | 'verify_id_token' | 'get_user'
  operation: string
  httpStatus?: number
  googleHttpStatus?: number
  googleErrorCode?: string
  missingEnv?: string
}

type BearerParseResult =
  | { ok: true; token: string }
  | { ok: false; diagnosticCode: 'missing_authorization' | 'malformed_authorization' }

type SafeErrorShape = {
  diagnosticCode?: unknown
  operation?: unknown
  httpStatus?: unknown
  googleHttpStatus?: unknown
  googleErrorCode?: unknown
  missingEnv?: unknown
}

function bearerToken(authorization: string | null): BearerParseResult {
  const prefix = 'Bearer '
  if (!authorization?.trim()) return { ok: false, diagnosticCode: 'missing_authorization' }
  if (!authorization.startsWith(prefix)) return { ok: false, diagnosticCode: 'malformed_authorization' }
  const token = authorization.slice(prefix.length).trim()
  return token ? { ok: true, token } : { ok: false, diagnosticCode: 'malformed_authorization' }
}

function firstNameFromDisplayName(displayName: string | null | undefined): string | null {
  const firstName = displayName?.trim().split(/\s+/)[0]
  return firstName || null
}

function errorShape(error: unknown): SafeErrorShape {
  return typeof error === 'object' && error !== null ? error as SafeErrorShape : {}
}

function stringProp(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined
}

function numberProp(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined
}

function diagnosticFromError(error: unknown, fallback: SendVerificationDiagnostic): SendVerificationDiagnostic {
  const shape = errorShape(error)
  const diagnosticCode = stringProp(shape.diagnosticCode) as SendVerificationDiagnosticCode | undefined
  return {
    ...fallback,
    diagnosticCode: diagnosticCode ?? fallback.diagnosticCode,
    operation: stringProp(shape.operation) ?? fallback.operation,
    httpStatus: numberProp(shape.httpStatus) ?? fallback.httpStatus,
    googleHttpStatus: numberProp(shape.googleHttpStatus),
    googleErrorCode: stringProp(shape.googleErrorCode),
    missingEnv: stringProp(shape.missingEnv),
  }
}

function statusFromDiagnostic(diagnostic: SendVerificationDiagnostic): number {
  if (diagnostic.diagnosticCode === 'missing_authorization') return 401
  if (diagnostic.diagnosticCode === 'malformed_authorization') return 401
  if (diagnostic.diagnosticCode === 'verify_id_token_failed') return 401
  if (diagnostic.diagnosticCode === 'get_user_failed') return 401
  return diagnostic.httpStatus && diagnostic.httpStatus >= 500 ? diagnostic.httpStatus : 503
}

function safeAuthErrorBody(status: number): Record<string, unknown> {
  if (status === 401) return { error: 'Musisz być zalogowany.' }
  return { error: 'Wysyłka maili weryfikacyjnych jest chwilowo niedostępna.' }
}

function logDiagnostic(deps: SendVerificationEmailDeps, diagnostic: SendVerificationDiagnostic) {
  const payload = {
    diagnosticCode: diagnostic.diagnosticCode,
    stage: diagnostic.stage,
    operation: diagnostic.operation,
    httpStatus: diagnostic.httpStatus,
    googleHttpStatus: diagnostic.googleHttpStatus,
    googleErrorCode: diagnostic.googleErrorCode,
    missingEnv: diagnostic.missingEnv,
  }

  if (deps.logDiagnostic) {
    deps.logDiagnostic(payload)
    return
  }

  console.error('[auth/send-verification-email]', payload)
}

export async function handleSendVerificationEmailRequest(
  authorization: string | null,
  deps: SendVerificationEmailDeps,
): Promise<SendVerificationEmailResult> {
  const parsed = bearerToken(authorization)
  if (!parsed.ok) {
    logDiagnostic(deps, {
      diagnosticCode: parsed.diagnosticCode,
      stage: 'authorization',
      operation: 'parse_authorization_header',
      httpStatus: 401,
    })
    return { status: 401, body: { error: 'Musisz być zalogowany.' } }
  }
  const idToken = parsed.token

  let uid: string
  try {
    const verified = await deps.verifyIdToken(idToken)
    uid = verified.uid
  } catch (error) {
    const diagnostic = diagnosticFromError(error, {
      diagnosticCode: 'verify_id_token_failed',
      stage: 'verify_id_token',
      operation: 'accounts.lookup.verify_id_token',
      httpStatus: 401,
    })
    logDiagnostic(deps, diagnostic)
    const status = statusFromDiagnostic(diagnostic)
    return { status, body: safeAuthErrorBody(status) }
  }

  let user: AuthUserForVerification
  try {
    user = await deps.getUser(uid)
  } catch (error) {
    const diagnostic = diagnosticFromError(error, {
      diagnosticCode: 'get_user_failed',
      stage: 'get_user',
      operation: 'projects.accounts.lookup',
      httpStatus: 401,
    })
    logDiagnostic(deps, diagnostic)
    const status = statusFromDiagnostic(diagnostic)
    return { status, body: safeAuthErrorBody(status) }
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
