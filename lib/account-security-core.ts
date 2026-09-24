export const PASSWORD_RESET_SUCCESS_MESSAGE = 'Jeśli konto z tym adresem istnieje, wysłaliśmy wiadomość z instrukcją zmiany hasła.'

export type FirebaseActionMode = 'resetPassword' | 'verifyAndChangeEmail'

export type FirebaseActionParams = {
  mode: string
  oobCode: string
  apiKey?: string
  lang?: string
}

export function normalizeEmail(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const email = value.trim().toLowerCase()
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return null
  if (email.length > 254) return null
  return email
}

function parseUrlMaybe(value: string): URL | null {
  try {
    return new URL(value)
  } catch {
    return null
  }
}

export function extractFirebaseActionParams(link: string): FirebaseActionParams | null {
  const url = parseUrlMaybe(link)
  if (!url) return null

  const nestedLink = url.searchParams.get('link')
  if (nestedLink) {
    const nested = extractFirebaseActionParams(nestedLink)
    if (nested) return nested
  }

  const mode = url.searchParams.get('mode')
  const oobCode = url.searchParams.get('oobCode')
  if (!mode || !oobCode) return null

  const apiKey = url.searchParams.get('apiKey') ?? undefined
  const lang = url.searchParams.get('lang') ?? undefined
  return { mode, oobCode, apiKey, lang }
}

export function buildRunbeeActionLink(
  generatedFirebaseLink: string,
  expectedMode: FirebaseActionMode,
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

export function authTimeIsRecent(authTimeSeconds: number | undefined, nowMs: number, maxAgeMs: number): boolean {
  if (!Number.isFinite(authTimeSeconds)) return false
  return nowMs - Number(authTimeSeconds) * 1000 <= maxAgeMs
}

export async function runPasswordChangeWithSecurityNotification(input: {
  changePassword: () => Promise<void>
  getIdToken: () => Promise<string>
  notifyPasswordChanged: (idToken: string) => Promise<unknown>
}): Promise<void> {
  await input.changePassword()

  try {
    const idToken = await input.getIdToken()
    await input.notifyPasswordChanged(idToken)
  } catch {
    // The password change is already committed by Firebase Auth. A failed
    // security notification must not make the UI report the password change
    // as failed or attempt to roll it back.
  }
}

export async function completeEmailChangeAction<TSessionUser>(input: {
  applyFirebaseActionCode: () => Promise<void>
  syncFirestoreEmail: () => Promise<void>
  reloadFirebaseUser: () => Promise<void>
  refreshSessionUser: () => Promise<TSessionUser>
}): Promise<TSessionUser> {
  await input.applyFirebaseActionCode()
  await input.syncFirestoreEmail()
  await input.reloadFirebaseUser()
  return input.refreshSessionUser()
}
