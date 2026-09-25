import 'server-only'

import { adminApp } from '@/lib/firebase-admin'

export type AdminActionCodeSettings = {
  url: string
  handleCodeInApp?: boolean
  dynamicLinkDomain?: string
  linkDomain?: string
  iOS?: {
    bundleId: string
  }
  android?: {
    packageName: string
    installApp?: boolean
    minimumVersion?: string
  }
}

export type AdminAuthUser = {
  uid: string
  email?: string
  emailVerified: boolean
  disabled?: boolean
  displayName?: string | null
}

type VerifiedIdToken = {
  uid: string
  auth_time?: number
}

type FirebaseLookupUser = {
  localId?: string
  email?: string
  emailVerified?: boolean
  disabled?: boolean
  displayName?: string
}

type FirebaseLookupResponse = {
  users?: FirebaseLookupUser[]
}

type FirebaseOobResponse = {
  oobLink?: string
}

type GoogleErrorResponse = {
  error?: {
    code?: number
    message?: string
    status?: string
  }
}

type AccessTokenResult = {
  accessToken?: string
}

type AppCredentialWithAccessToken = {
  getAccessToken?: () => Promise<AccessTokenResult>
}

type AdminAuthRestClient = {
  verifyIdToken: (idToken: string) => Promise<VerifiedIdToken>
  getUser: (uid: string) => Promise<AdminAuthUser>
  getUserByEmail: (email: string) => Promise<AdminAuthUser>
  generateEmailVerificationLink: (email: string, actionCodeSettings: AdminActionCodeSettings) => Promise<string>
  generateVerifyAndChangeEmailLink: (email: string, newEmail: string, actionCodeSettings: AdminActionCodeSettings) => Promise<string>
  generatePasswordResetLink: (email: string, actionCodeSettings: AdminActionCodeSettings) => Promise<string>
}

let adminAuthClient: AdminAuthRestClient | null = null

export type FirebaseAuthDiagnosticCode =
  | 'verify_id_token_failed'
  | 'get_user_failed'
  | 'firebase_auth_config_missing'
  | 'firebase_auth_project_mismatch'
  | 'firebase_auth_iam_error'
  | 'unknown_server_auth_error'

type AuthErrorContext = {
  diagnosticCode?: FirebaseAuthDiagnosticCode
  operation?: string
  httpStatus?: number
  googleHttpStatus?: number
  googleErrorCode?: string
  missingEnv?: string
}

export type FirebaseAuthDiagnosticError = Error & {
  code?: string
  diagnosticCode?: FirebaseAuthDiagnosticCode
  operation?: string
  httpStatus?: number
  googleHttpStatus?: number
  googleErrorCode?: string
  missingEnv?: string
}

function authError(code: string, message: string, context: AuthErrorContext = {}): FirebaseAuthDiagnosticError {
  const error = new Error(message) as FirebaseAuthDiagnosticError
  error.code = code
  error.diagnosticCode = context.diagnosticCode
  error.operation = context.operation
  error.httpStatus = context.httpStatus
  error.googleHttpStatus = context.googleHttpStatus
  error.googleErrorCode = context.googleErrorCode
  error.missingEnv = context.missingEnv
  return error
}

function googleErrorCode(data: GoogleErrorResponse, fallback: string): string {
  if (data.error?.status) return data.error.status
  const message = data.error?.message ?? ''
  const match = message.match(/[A-Z][A-Z0-9_]+/)
  return match?.[0] ?? fallback
}

function classifyGoogleAuthError(
  operation: string,
  responseStatus: number,
  data: GoogleErrorResponse,
): FirebaseAuthDiagnosticError {
  const upstreamCode = googleErrorCode(data, `HTTP_${responseStatus}`)
  if (upstreamCode === 'INVALID_ID_TOKEN' || upstreamCode === 'USER_DISABLED') {
    return authError('auth/invalid-id-token', 'Firebase ID token is invalid.', {
      diagnosticCode: 'verify_id_token_failed',
      operation,
      httpStatus: 401,
      googleHttpStatus: responseStatus,
      googleErrorCode: upstreamCode,
    })
  }

  if (upstreamCode === 'USER_NOT_FOUND' || upstreamCode === 'EMAIL_NOT_FOUND') {
    return authError('auth/user-not-found', 'Firebase Auth user was not found.', {
      diagnosticCode: 'get_user_failed',
      operation,
      httpStatus: 401,
      googleHttpStatus: responseStatus,
      googleErrorCode: upstreamCode,
    })
  }

  if (responseStatus === 401 || responseStatus === 403 || upstreamCode === 'PERMISSION_DENIED' || upstreamCode === 'UNAUTHENTICATED') {
    return authError('auth/insufficient-permission', 'Firebase Auth service account is not authorized.', {
      diagnosticCode: 'firebase_auth_iam_error',
      operation,
      httpStatus: 503,
      googleHttpStatus: responseStatus,
      googleErrorCode: upstreamCode,
    })
  }

  if (
    responseStatus === 404
    || upstreamCode === 'PROJECT_NOT_FOUND'
    || upstreamCode === 'INVALID_PROJECT_ID'
    || upstreamCode === 'PROJECT_ID_MISMATCH'
  ) {
    return authError('auth/project-not-found', 'Firebase project configuration does not match.', {
      diagnosticCode: 'firebase_auth_project_mismatch',
      operation,
      httpStatus: 503,
      googleHttpStatus: responseStatus,
      googleErrorCode: upstreamCode,
    })
  }

  return authError('auth/internal-error', 'Firebase Auth request failed.', {
    diagnosticCode: 'unknown_server_auth_error',
    operation,
    httpStatus: 503,
    googleHttpStatus: responseStatus,
    googleErrorCode: upstreamCode,
  })
}

function firebaseProjectId(): string | null {
  return process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID
    || process.env.GCLOUD_PROJECT
    || process.env.GOOGLE_CLOUD_PROJECT
    || adminApp?.options.projectId
    || null
}

async function getAccessToken(): Promise<string> {
  const credential = adminApp?.options.credential as AppCredentialWithAccessToken | undefined
  const token = await credential?.getAccessToken?.()
  if (!token?.accessToken) {
    throw authError('auth/invalid-credential', 'Firebase Admin credentials are not configured.', {
      diagnosticCode: 'firebase_auth_config_missing',
      operation: 'firebase_admin_get_access_token',
      httpStatus: 503,
      missingEnv: 'FIREBASE_SERVICE_ACCOUNT_KEY',
    })
  }
  return token.accessToken
}

function decodeJwtPayload(idToken: string): Record<string, unknown> {
  const payload = idToken.split('.')[1]
  if (!payload) return {}
  try {
    return JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as Record<string, unknown>
  } catch {
    return {}
  }
}

function mapFirebaseUser(user: FirebaseLookupUser | undefined): AdminAuthUser {
  if (!user?.localId) {
    throw authError('auth/user-not-found', 'Firebase Auth user was not found.')
  }

  return {
    uid: user.localId,
    email: user.email,
    emailVerified: Boolean(user.emailVerified),
    disabled: Boolean(user.disabled),
    displayName: user.displayName ?? null,
  }
}

async function identityToolkitRequest<T>(path: string, body: Record<string, unknown>): Promise<T> {
  const projectId = firebaseProjectId()
  if (!projectId) {
    throw authError('auth/invalid-credential', 'Firebase project ID is not configured.', {
      diagnosticCode: 'firebase_auth_config_missing',
      operation: `projects.${path}`,
      httpStatus: 503,
      missingEnv: 'NEXT_PUBLIC_FIREBASE_PROJECT_ID',
    })
  }

  const accessToken = await getAccessToken()
  let response: Response
  const operation = `projects.${path}`
  try {
    response = await fetch(`https://identitytoolkit.googleapis.com/v1/projects/${encodeURIComponent(projectId)}/${path}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    })
  } catch {
    throw authError('auth/internal-error', 'Firebase Auth request failed.', {
      diagnosticCode: 'unknown_server_auth_error',
      operation,
      httpStatus: 503,
    })
  }

  const data = await response.json().catch(() => ({})) as GoogleErrorResponse
  if (!response.ok) {
    throw classifyGoogleAuthError(operation, response.status, data)
  }

  return data as T
}

async function verifyIdToken(idToken: string): Promise<VerifiedIdToken> {
  const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY
  if (!apiKey) {
    throw authError('auth/invalid-credential', 'Firebase API key is not configured.', {
      diagnosticCode: 'firebase_auth_config_missing',
      operation: 'accounts.lookup.verify_id_token',
      httpStatus: 503,
      missingEnv: 'NEXT_PUBLIC_FIREBASE_API_KEY',
    })
  }

  let response: Response
  const operation = 'accounts.lookup.verify_id_token'
  try {
    response = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idToken }),
    })
  } catch {
    throw authError('auth/internal-error', 'Firebase Auth token verification failed.', {
      diagnosticCode: 'unknown_server_auth_error',
      operation,
      httpStatus: 503,
    })
  }

  const data = await response.json().catch(() => ({})) as FirebaseLookupResponse & GoogleErrorResponse
  if (!response.ok) {
    throw classifyGoogleAuthError(operation, response.status, data)
  }

  const uid = data.users?.[0]?.localId
  if (!uid) {
    throw authError('auth/invalid-id-token', 'Firebase ID token is invalid.', {
      diagnosticCode: 'verify_id_token_failed',
      operation,
      httpStatus: 401,
      googleErrorCode: 'MISSING_LOCAL_ID',
    })
  }

  const payload = decodeJwtPayload(idToken)
  const authTime = typeof payload.auth_time === 'number' ? payload.auth_time : undefined
  return { uid, auth_time: authTime }
}

async function getUser(uid: string): Promise<AdminAuthUser> {
  const data = await identityToolkitRequest<FirebaseLookupResponse>('accounts:lookup', { localId: [uid] })
  return mapFirebaseUser(data.users?.[0])
}

async function getUserByEmail(email: string): Promise<AdminAuthUser> {
  const data = await identityToolkitRequest<FirebaseLookupResponse>('accounts:lookup', { email: [email] })
  return mapFirebaseUser(data.users?.[0])
}

function actionCodeRequest(actionCodeSettings: AdminActionCodeSettings): Record<string, unknown> {
  const request: Record<string, unknown> = {
    continueUrl: actionCodeSettings.url,
    canHandleCodeInApp: Boolean(actionCodeSettings.handleCodeInApp),
    dynamicLinkDomain: actionCodeSettings.dynamicLinkDomain,
    linkDomain: actionCodeSettings.linkDomain,
    iOSBundleId: actionCodeSettings.iOS?.bundleId,
    androidPackageName: actionCodeSettings.android?.packageName,
    androidInstallApp: actionCodeSettings.android?.installApp,
    androidMinimumVersion: actionCodeSettings.android?.minimumVersion,
  }

  for (const key of Object.keys(request)) {
    if (typeof request[key] === 'undefined' || request[key] === null) {
      delete request[key]
    }
  }

  return request
}

async function generateActionLink(
  requestType: 'VERIFY_EMAIL' | 'VERIFY_AND_CHANGE_EMAIL' | 'PASSWORD_RESET',
  email: string,
  actionCodeSettings: AdminActionCodeSettings,
  newEmail?: string,
): Promise<string> {
  const data = await identityToolkitRequest<FirebaseOobResponse>('accounts:sendOobCode', {
    requestType,
    email,
    returnOobLink: true,
    ...actionCodeRequest(actionCodeSettings),
    ...(newEmail ? { newEmail } : {}),
  })

  if (!data.oobLink) {
    throw authError('auth/internal-error', 'Firebase Auth did not return an action link.')
  }
  return data.oobLink
}

export async function getAdminAuth(): Promise<AdminAuthRestClient | null> {
  if (!adminApp || !firebaseProjectId()) return null

  adminAuthClient ??= {
    verifyIdToken,
    getUser,
    getUserByEmail,
    generateEmailVerificationLink: (email, settings) => generateActionLink('VERIFY_EMAIL', email, settings),
    generateVerifyAndChangeEmailLink: (email, newEmail, settings) => generateActionLink('VERIFY_AND_CHANGE_EMAIL', email, settings, newEmail),
    generatePasswordResetLink: (email, settings) => generateActionLink('PASSWORD_RESET', email, settings),
  }

  return adminAuthClient
}

export async function isAdminAuthConfigured(): Promise<boolean> {
  return Boolean(await getAdminAuth())
}
