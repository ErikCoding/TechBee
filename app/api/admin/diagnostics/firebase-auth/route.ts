import { NextResponse } from 'next/server'
import { requireAdminRequest } from '@/lib/admin-api-auth'
import { firebaseAdminCredential, firebaseAdminCredentialStatus } from '@/lib/firebase-admin'
import { runFirebaseAuthReadOnlyDiagnostic } from '@/lib/firebase-admin-auth'
import { runFirebaseAuthDiagnosticChecks } from '@/lib/firebase-auth-diagnostics-core'
import { mintFirebaseAccessToken } from '@/lib/firebase-server-credentials'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function bearerToken(request: Request): string | undefined {
  const authorization = request.headers.get('authorization')
  const prefix = 'Bearer '
  if (!authorization?.startsWith(prefix)) return undefined
  const token = authorization.slice(prefix.length).trim()
  return token || undefined
}

export async function GET(request: Request) {
  const admin = await requireAdminRequest(bearerToken(request), 'diagnostyką Firebase Auth')
  if (admin instanceof NextResponse) return admin

  const result = await runFirebaseAuthDiagnosticChecks({
    credentialState: firebaseAdminCredentialStatus,
    mintAccessToken: () => mintFirebaseAccessToken(firebaseAdminCredential, firebaseAdminCredentialStatus),
    readOnlyAuthLookup: runFirebaseAuthReadOnlyDiagnostic,
  })

  return NextResponse.json(result, { status: result.ok ? 200 : 503 })
}
