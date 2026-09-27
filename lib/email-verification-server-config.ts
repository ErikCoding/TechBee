import { parseFirebaseServiceAccountKey, type FirebaseServerCredentialDiagnosticCode } from './firebase-server-credentials'

export type EmailVerificationServerConfigDiagnosticCode =
  | 'firebase_auth_config_missing'
  | 'firebase_auth_config_invalid'
  | 'firebase_auth_project_mismatch'
  | FirebaseServerCredentialDiagnosticCode

export type EmailVerificationServerConfigResult =
  | { ok: true }
  | {
      ok: false
      status: 503
      diagnosticCode: EmailVerificationServerConfigDiagnosticCode
      missingEnv?: string
      invalidEnv?: string
      operation: 'validate_email_verification_server_config'
    }

const requiredEnvVars = [
  'NEXT_PUBLIC_FIREBASE_API_KEY',
  'NEXT_PUBLIC_FIREBASE_PROJECT_ID',
  'RESEND_API_KEY',
] as const

export function validateEmailVerificationServerConfig(
  env: NodeJS.ProcessEnv = process.env,
): EmailVerificationServerConfigResult {
  for (const name of requiredEnvVars) {
    if (!env[name]?.trim()) {
      return {
        ok: false,
        status: 503,
        diagnosticCode: 'firebase_auth_config_missing',
        missingEnv: name,
        operation: 'validate_email_verification_server_config',
      }
    }
  }

  const serviceAccount = parseFirebaseServiceAccountKey(
    env.FIREBASE_SERVICE_ACCOUNT_KEY,
    env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  )
  if (!serviceAccount.ok) {
    return {
      ok: false,
      status: 503,
      diagnosticCode: serviceAccount.diagnosticCode,
      missingEnv: serviceAccount.missingEnv,
      invalidEnv: serviceAccount.invalidField ? 'FIREBASE_SERVICE_ACCOUNT_KEY' : undefined,
      operation: 'validate_email_verification_server_config',
    }
  }

  return { ok: true }
}
