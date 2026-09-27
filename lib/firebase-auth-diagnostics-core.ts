import type { FirebaseServerCredentialState } from './firebase-server-credentials'

export type FirebaseAuthDiagnosticStage = 'config' | 'access_token' | 'auth_lookup'

export type FirebaseAuthDiagnosticResult =
  | {
      ok: true
      config: 'ok'
      accessToken: 'ok'
      authLookup: 'ok'
    }
  | {
      ok: false
      stage: FirebaseAuthDiagnosticStage
      diagnosticCode: string
    }

type DiagnosticDeps = {
  credentialState: FirebaseServerCredentialState
  mintAccessToken: () => Promise<string>
  readOnlyAuthLookup: () => Promise<void>
}

function diagnosticCode(error: unknown, fallback: string): string {
  if (typeof error === 'object' && error !== null && 'diagnosticCode' in error) {
    const value = (error as { diagnosticCode?: unknown }).diagnosticCode
    if (typeof value === 'string' && value.trim()) return value.trim()
  }
  return fallback
}

export async function runFirebaseAuthDiagnosticChecks(
  deps: DiagnosticDeps,
): Promise<FirebaseAuthDiagnosticResult> {
  if (!deps.credentialState.ok) {
    return {
      ok: false,
      stage: 'config',
      diagnosticCode: deps.credentialState.diagnosticCode,
    }
  }

  try {
    await deps.mintAccessToken()
  } catch (error) {
    return {
      ok: false,
      stage: 'access_token',
      diagnosticCode: diagnosticCode(error, 'firebase_access_token_failed'),
    }
  }

  try {
    await deps.readOnlyAuthLookup()
  } catch (error) {
    return {
      ok: false,
      stage: 'auth_lookup',
      diagnosticCode: diagnosticCode(error, 'unknown_server_auth_error'),
    }
  }

  return {
    ok: true,
    config: 'ok',
    accessToken: 'ok',
    authLookup: 'ok',
  }
}
