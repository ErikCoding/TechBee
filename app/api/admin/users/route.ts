import { NextResponse } from 'next/server'
import { adminDb, isAdminConfigured } from '@/lib/firebase-admin'
import { getAdminAuth } from '@/lib/firebase-admin-auth'
import { requireAdminRequest } from '@/lib/admin-api-auth'
import { buildAdminUserRows, buildAdminUserRowsWithOptionalAuthLookup, type StoredAdminUserProfile } from '@/lib/admin-users-core'
import { collections } from '@/lib/firebase'

export const runtime = 'nodejs'

export async function POST(request: Request) {
  if (!isAdminConfigured || !adminDb) {
    return NextResponse.json({ error: 'Zaufane zapisy Firestore nie są skonfigurowane.' }, { status: 503 })
  }

  const body = await request.json().catch(() => ({}) as { idToken?: string })
  const admin = await requireAdminRequest(body.idToken, 'listą użytkowników')
  if (admin instanceof NextResponse) return admin

  let profiles: StoredAdminUserProfile[]
  try {
    const snap = await adminDb.collection(collections.users).get()
    profiles = snap.docs.map((doc) => {
      const data = doc.data() as Omit<StoredAdminUserProfile, 'id'>
      return { id: doc.id, ...data }
    })
  } catch (err) {
    console.error('[admin/users] Failed to list Firestore users:', err)
    return NextResponse.json({ error: 'Nie udało się pobrać listy użytkowników.' }, { status: 500 })
  }

  const logAuthLookupFailure = (err: unknown) => {
    const safeError = err && typeof err === 'object'
      ? {
          code: 'code' in err ? (err as { code?: unknown }).code : undefined,
          diagnosticCode: 'diagnosticCode' in err ? (err as { diagnosticCode?: unknown }).diagnosticCode : undefined,
          httpStatus: 'httpStatus' in err ? (err as { httpStatus?: unknown }).httpStatus : undefined,
          googleHttpStatus: 'googleHttpStatus' in err ? (err as { googleHttpStatus?: unknown }).googleHttpStatus : undefined,
          googleErrorCode: 'googleErrorCode' in err ? (err as { googleErrorCode?: unknown }).googleErrorCode : undefined,
        }
      : { code: 'unknown_error' }
    console.warn('[admin/users] firebase_auth_lookup_failed', safeError)
  }

  const auth = await getAdminAuth()
  if (!auth) {
    console.warn('[admin/users] firebase_auth_lookup_failed', { code: 'auth_not_configured' })
    return NextResponse.json({ users: buildAdminUserRows(profiles, []) })
  }

  const users = await buildAdminUserRowsWithOptionalAuthLookup(
    profiles,
    (uids) => auth.getUsers(uids),
    logAuthLookupFailure,
  )
  return NextResponse.json({ users })
}
