import { NextResponse } from 'next/server'
import { adminDb, isAdminConfigured } from '@/lib/firebase-admin'
import { getAdminAuth, isAdminAuthConfigured } from '@/lib/firebase-admin-auth'
import { collections } from '@/lib/firebase'
import { buildAdminUserRowsWithOptionalAuthLookup, type StoredAdminUserProfile } from '@/lib/admin-users-core'
import { requireAdminRequest } from '@/lib/admin-api-auth'
import { isRequestLockedByFinalization } from '@/lib/account-deletion-core'

type Params = {
  params: Promise<{ userId: string }>
}

export async function PATCH(request: Request, { params }: Params) {
  if (!isAdminConfigured || !adminDb) {
    return NextResponse.json({ error: 'Panel administracyjny nie jest skonfigurowany.' }, { status: 503 })
  }
  if (!await isAdminAuthConfigured()) {
    return NextResponse.json({ error: 'Firebase Auth Admin API nie jest skonfigurowane.' }, { status: 503 })
  }

  const body = await request.json().catch(() => null) as { idToken?: unknown; disabled?: unknown } | null
  const admin = await requireAdminRequest(typeof body?.idToken === 'string' ? body.idToken : undefined, 'zarządzania kontami')
  if (admin instanceof NextResponse) return admin

  const disabled = body?.disabled
  if (typeof disabled !== 'boolean') {
    return NextResponse.json({ error: 'Nieprawidłowy status konta.' }, { status: 400 })
  }

  const { userId } = await params
  if (!userId) return NextResponse.json({ error: 'Brak identyfikatora użytkownika.' }, { status: 400 })
  if (disabled && userId === admin.uid) {
    return NextResponse.json({ error: 'Nie możesz zdezaktywować własnego konta administratora.' }, { status: 400 })
  }

  const userRef = adminDb.collection(collections.users).doc(userId)
  const userSnap = await userRef.get()
  if (!userSnap.exists) {
    return NextResponse.json({ error: 'Nie znaleziono użytkownika.' }, { status: 404 })
  }
  const profile = { id: userId, ...userSnap.data() } as StoredAdminUserProfile
  // A permanently deleted (or being deleted) account must never be switched back on from here.
  if (profile.accountStatus === 'deleted') {
    return NextResponse.json({ error: 'To konto zostało trwale usunięte i nie można go przywrócić.' }, { status: 409 })
  }
  const deletionRequestId = (userSnap.data() ?? {}).accountDeletionRequestId
  if (!disabled && typeof deletionRequestId === 'string') {
    const deletionSnap = await adminDb.collection(collections.accountDeletionRequests).doc(deletionRequestId).get()
    if (deletionSnap.exists && isRequestLockedByFinalization(deletionSnap.data()?.status)) {
      return NextResponse.json({ error: 'Trwa lub zakończyło się usuwanie tego konta — nie można go przywrócić.' }, { status: 409 })
    }
  }
  if (profile.role === 'admin') {
    return NextResponse.json({ error: 'Konta administratorów są chronione przed dezaktywacją z panelu.' }, { status: 400 })
  }

  const auth = await getAdminAuth()
  if (!auth) return NextResponse.json({ error: 'Firebase Auth Admin API nie jest skonfigurowane.' }, { status: 503 })

  const now = Date.now()
  if (disabled) {
    await auth.updateUserDisabled(userId, true)
    await userRef.set({
      accountStatus: 'deactivated',
      deactivatedAt: now,
      deactivatedBy: admin.uid,
      updatedAt: now,
    }, { merge: true })
  } else {
    await userRef.set({
      accountStatus: 'active',
      reactivatedAt: now,
      reactivatedBy: admin.uid,
      updatedAt: now,
    }, { merge: true })
    await auth.updateUserDisabled(userId, false)
  }

  const nextProfileSnap = await userRef.get()
  const rows = await buildAdminUserRowsWithOptionalAuthLookup(
    [{ id: userId, ...nextProfileSnap.data() } as StoredAdminUserProfile],
    (uids) => auth.getUsers(uids),
  )

  return NextResponse.json({ ok: true, user: rows[0] ?? null })
}
