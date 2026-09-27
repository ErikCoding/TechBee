export type FirebaseServerCredentialDiagnosticCode =
  | 'firebase_service_account_missing'
  | 'firebase_service_account_invalid'
  | 'firebase_project_id_mismatch'
  | 'firebase_access_token_failed'

export type FirebaseServiceAccountJson = {
  project_id: string
  client_email: string
  private_key: string
}

export type FirebaseServiceAccountCredentialInput = {
  projectId: string
  clientEmail: string
  privateKey: string
}

export type FirebaseServerCredentialState =
  | {
      ok: true
      serviceAccount: FirebaseServiceAccountJson
      credentialInput: FirebaseServiceAccountCredentialInput
    }
  | {
      ok: false
      diagnosticCode: FirebaseServerCredentialDiagnosticCode
      missingEnv?: 'FIREBASE_SERVICE_ACCOUNT_KEY'
      invalidField?: 'project_id' | 'client_email' | 'private_key' | 'json'
    }

export type FirebaseAccessTokenCredential = {
  getAccessToken: () => Promise<{ access_token?: string }>
}

export type FirebaseCredentialDiagnosticError = Error & {
  code?: string
  diagnosticCode?: FirebaseServerCredentialDiagnosticCode
  operation?: string
  httpStatus?: number
  missingEnv?: string
  invalidField?: string
}

function nonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0
}

function parseJson(value: string): unknown | null {
  try {
    return JSON.parse(value) as unknown
  } catch {
    return null
  }
}

function credentialError(
  diagnosticCode: FirebaseServerCredentialDiagnosticCode,
  message: string,
  context: Pick<FirebaseCredentialDiagnosticError, 'missingEnv' | 'invalidField'> = {},
): FirebaseCredentialDiagnosticError {
  const error = new Error(message) as FirebaseCredentialDiagnosticError
  error.code = 'auth/invalid-credential'
  error.diagnosticCode = diagnosticCode
  error.operation = 'firebase_admin_get_access_token'
  error.httpStatus = 503
  error.missingEnv = context.missingEnv
  error.invalidField = context.invalidField
  return error
}

export function parseFirebaseServiceAccountKey(
  rawKey: string | undefined,
  publicProjectId?: string,
): FirebaseServerCredentialState {
  if (!rawKey?.trim()) {
    return {
      ok: false,
      diagnosticCode: 'firebase_service_account_missing',
      missingEnv: 'FIREBASE_SERVICE_ACCOUNT_KEY',
    }
  }

  const direct = parseJson(rawKey)
  const decoded = direct ?? parseJson(Buffer.from(rawKey, 'base64').toString('utf8'))
  if (!decoded || typeof decoded !== 'object') {
    return {
      ok: false,
      diagnosticCode: 'firebase_service_account_invalid',
      invalidField: 'json',
    }
  }

  const data = decoded as Record<string, unknown>
  if (!nonEmptyString(data.project_id)) {
    return {
      ok: false,
      diagnosticCode: 'firebase_service_account_invalid',
      invalidField: 'project_id',
    }
  }
  if (!nonEmptyString(data.client_email)) {
    return {
      ok: false,
      diagnosticCode: 'firebase_service_account_invalid',
      invalidField: 'client_email',
    }
  }
  if (!nonEmptyString(data.private_key)) {
    return {
      ok: false,
      diagnosticCode: 'firebase_service_account_invalid',
      invalidField: 'private_key',
    }
  }

  const serviceAccount = {
    project_id: data.project_id.trim(),
    client_email: data.client_email.trim(),
    private_key: data.private_key,
  }
  const expectedProjectId = publicProjectId?.trim()
  if (expectedProjectId && serviceAccount.project_id !== expectedProjectId) {
    return {
      ok: false,
      diagnosticCode: 'firebase_project_id_mismatch',
      invalidField: 'project_id',
    }
  }

  return {
    ok: true,
    serviceAccount,
    credentialInput: {
      projectId: serviceAccount.project_id,
      clientEmail: serviceAccount.client_email,
      privateKey: serviceAccount.private_key,
    },
  }
}

export function firebaseCredentialStateError(
  state: FirebaseServerCredentialState,
): FirebaseCredentialDiagnosticError {
  if (state.ok) {
    return credentialError('firebase_access_token_failed', 'Firebase access token is missing.')
  }

  return credentialError(state.diagnosticCode, 'Firebase server credentials are not configured.', {
    missingEnv: state.missingEnv,
    invalidField: state.invalidField,
  })
}

export async function mintFirebaseAccessToken(
  credential: FirebaseAccessTokenCredential | null,
  state: FirebaseServerCredentialState,
): Promise<string> {
  if (!credential) {
    throw firebaseCredentialStateError(state)
  }

  let token: { access_token?: string }
  try {
    token = await credential.getAccessToken()
  } catch {
    throw credentialError('firebase_access_token_failed', 'Firebase access token could not be minted.')
  }

  if (!token.access_token) {
    throw credentialError('firebase_access_token_failed', 'Firebase access token is missing.')
  }

  return token.access_token
}
