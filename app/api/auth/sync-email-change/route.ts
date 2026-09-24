import { NextResponse } from 'next/server'
import { adminDb, isAdminConfigured } from '@/lib/firebase-admin'
import { adminAuth, isAdminAuthConfigured } from '@/lib/firebase-admin-auth'
import { collections } from '@/lib/firebase'
import { handleSyncEmailChange } from '@/lib/account-security-endpoints'
import { getPendingEmailChange, markPendingEmailChangeConsumed } from '@/lib/account-security.server'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function POST(request: Request) {
  if (!isAdminConfigured || !isAdminAuthConfigured || !adminDb || !adminAuth) {
    return NextResponse.json({ error: 'Synchronizacja adresu e-mail nie jest skonfigurowana.' }, { status: 503 })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    body = {}
  }

  const auth = adminAuth
  const db = adminDb
  const result = await handleSyncEmailChange(body, {
    getPendingEmailChange,
    getUser: (uid) => auth.getUser(uid),
    updateUserEmail: (uid, email) => db.collection(collections.users).doc(uid).set({ email }, { merge: true }),
    markPendingEmailChangeConsumed,
  })

  return NextResponse.json(result.body, { status: result.status, headers: result.headers })
}
