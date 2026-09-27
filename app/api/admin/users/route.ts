import { NextResponse } from 'next/server'
import { adminDb, isAdminConfigured } from '@/lib/firebase-admin'
import { getAdminAuth } from '@/lib/firebase-admin-auth'
import { requireAdminRequest } from '@/lib/admin-api-auth'
import { buildAdminUserRows, type StoredAdminUserProfile } from '@/lib/admin-users-core'
import { collections } from '@/lib/firebase'

export const runtime = 'nodejs'

export async function POST(request: Request) {
  if (!isAdminConfigured || !adminDb) {
    return NextResponse.json({ error: 'Zaufane zapisy Firestore nie są skonfigurowane.' }, { status: 503 })
  }

  const body = await request.json().catch(() => ({}) as { idToken?: string })
  const admin = await requireAdminRequest(body.idToken, 'listą użytkowników')
  if (admin instanceof NextResponse) return admin

  const auth = await getAdminAuth()
  if (!auth) {
    return NextResponse.json({ error: 'Firebase Auth nie jest skonfigurowane.' }, { status: 503 })
  }

  try {
    const snap = await adminDb.collection(collections.users).get()
    const profiles: StoredAdminUserProfile[] = snap.docs.map((doc) => {
      const data = doc.data() as Omit<StoredAdminUserProfile, 'id'>
      return { id: doc.id, ...data }
    })
    const authUsers = await auth.getUsers(profiles.map((profile) => profile.id))
    return NextResponse.json({ users: buildAdminUserRows(profiles, authUsers) })
  } catch (err) {
    console.error('[admin/users] Failed to list users:', err)
    return NextResponse.json({ error: 'Nie udało się pobrać listy użytkowników.' }, { status: 500 })
  }
}
