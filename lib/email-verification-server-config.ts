export type EmailVerificationServerConfigDiagnosticCode =
  | 'firebase_auth_config_missing'
  | 'firebase_auth_config_invalid'
  | 'firebase_auth_project_mismatch'

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
  'FIREBASE_SERVICE_ACCOUNT_KEY',
  'RESEND_API_KEY',
] as const

function parseServiceAccountProjectId(raw: string): string | null {
  const parseJson = (value: string) => {
    try {
      return JSON.parse(value) as { project_id?: unknown }
    } catch {
      return null
    }
  }

  const direct = parseJson(raw)
  const decoded = direct ?? parseJson(Buffer.from(raw, 'base64').toString('utf8'))
  const projectId = decoded?.project_id
  return typeof projectId === 'string' && projectId.trim() ? projectId.trim() : null
}

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

  const publicProjectId = env.NEXT_PUBLIC_FIREBASE_PROJECT_ID?.trim()
  const serviceAccountProjectId = parseServiceAccountProjectId(env.FIREBASE_SERVICE_ACCOUNT_KEY ?? '')
  if (!serviceAccountProjectId) {
    return {
      ok: false,
      status: 503,
      diagnosticCode: 'firebase_auth_config_invalid',
      invalidEnv: 'FIREBASE_SERVICE_ACCOUNT_KEY',
      operation: 'validate_email_verification_server_config',
    }
  }

  if (serviceAccountProjectId !== publicProjectId) {
    return {
      ok: false,
      status: 503,
      diagnosticCode: 'firebase_auth_project_mismatch',
      operation: 'validate_email_verification_server_config',
    }
  }

  return { ok: true }
}
