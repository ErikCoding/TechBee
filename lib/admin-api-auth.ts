import 'server-only'
import { NextResponse } from 'next/server'
import { isAdminConfigured } from '@/lib/firebase-admin'
import { getVerifiedUserRole, verifyCaller } from '@/lib/stripe-server-auth'

export async function requireAdminRequest(idToken?: string, area = 'tym panelem'): Promise<{ uid: string } | NextResponse> {
  if (!isAdminConfigured) return NextResponse.json({ error: 'Zaufane zapisy Firestore nie są skonfigurowane.' }, { status: 503 })
  const uid = await verifyCaller(idToken)
  if (!uid) return NextResponse.json({ error: 'Musisz być zalogowany.' }, { status: 401 })
  const role = await getVerifiedUserRole(uid)
  if (role !== 'admin') return NextResponse.json({ error: `Tylko administrator może zarządzać ${area}.` }, { status: 403 })
  return { uid }
}
