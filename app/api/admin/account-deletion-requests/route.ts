import { NextResponse } from 'next/server'
import { adminDb, isAdminConfigured } from '@/lib/firebase-admin'
import { getAdminAuth } from '@/lib/firebase-admin-auth'
import { collections } from '@/lib/firebase'
import { requireAdminRequest } from '@/lib/admin-api-auth'
import type { AdminAccountDeletionRequestRow, UserRole } from '@/lib/types'

type RequestDoc = {
  userId?: string
  role?: UserRole
  status?: AdminAccountDeletionRequestRow['status']
  requestedAt?: number
  updatedAt?: number
  resolvedAt?: number
  resolvedBy?: string
  rejectionReason?: string
  adminNote?: string
  hasDependencies?: boolean
  dependencySummary?: AdminAccountDeletionRequestRow['dependencySummary']
  history?: AdminAccountDeletionRequestRow['history']
  accessClosureAuthError?: boolean
}

const emptyDependencySummary: AdminAccountDeletionRequestRow['dependencySummary'] = {
  activeLessons: 0,
  activePackages: 0,
  pendingReports: 0,
  pendingPayouts: 0,
  openDisputes: 0,
  familyLinks: 0,
  publicTeacherProfile: false,
  conversations: 0,
  stripeConnectReviewRequired: false,
  paymentRecordsReviewRequired: false,
  scanComplete: true,
}

function normalizeStatus(value: unknown): AdminAccountDeletionRequestRow['status'] {
  return value === 'needs_resolution' || value === 'access_closed' || value === 'completed' || value === 'rejected' ? value : 'pending_review'
}

export async function POST(request: Request) {
  if (!isAdminConfigured || !adminDb) {
    return NextResponse.json({ error: 'Panel administracyjny nie jest skonfigurowany.' }, { status: 503 })
  }

  const body = await request.json().catch(() => null) as { idToken?: unknown } | null
  const admin = await requireAdminRequest(typeof body?.idToken === 'string' ? body.idToken : undefined, 'żądaniami usunięcia kont')
  if (admin instanceof NextResponse) return admin

  const snap = await adminDb.collection(collections.accountDeletionRequests).orderBy('updatedAt', 'desc').limit(100).get()
  const docs = snap.docs.map((doc) => ({ id: doc.id, ...(doc.data() as RequestDoc) }))
  const userIds = [...new Set(docs.map((doc) => doc.userId || doc.id).filter(Boolean))]
  const userSnaps = await Promise.all(userIds.map((uid) => adminDb!.collection(collections.users).doc(uid).get()))
  const userById = new Map(userSnaps.map((userSnap) => [userSnap.id, userSnap.data() ?? {}]))
  const auth = await getAdminAuth()
  const authUsers = auth ? await auth.getUsers(userIds).catch(() => []) : []
  const authById = new Map(authUsers.map((user) => [user.uid, user]))

  const requests: AdminAccountDeletionRequestRow[] = docs.map((doc) => {
    const userId = doc.userId || doc.id
    const profile = userById.get(userId) ?? {}
    const authUser = authById.get(userId)
    const requestedAt = Number(doc.requestedAt ?? doc.updatedAt ?? 0)
    const updatedAt = Number(doc.updatedAt ?? requestedAt)
    const dependencySummary = { ...emptyDependencySummary, ...(doc.dependencySummary ?? {}) }
    const history = Array.isArray(doc.history) && doc.history.length > 0
      ? doc.history
      : [{ action: 'requested' as const, actorId: userId, actorRole: 'user' as const, createdAt: requestedAt || updatedAt }]
    return {
      id: doc.id,
      userId,
      userName: typeof profile.name === 'string' ? profile.name : 'Nieznany użytkownik',
      userEmail: authUser?.email ?? (typeof profile.email === 'string' ? profile.email : '—'),
      role: (doc.role || profile.role || 'student') as UserRole,
      status: normalizeStatus(doc.status),
      requestedAt,
      updatedAt,
      ...(doc.resolvedAt ? { resolvedAt: doc.resolvedAt } : {}),
      ...(doc.resolvedBy ? { resolvedBy: doc.resolvedBy } : {}),
      ...(doc.rejectionReason ? { rejectionReason: doc.rejectionReason } : {}),
      ...(doc.adminNote ? { adminNote: doc.adminNote } : {}),
      hasDependencies: doc.hasDependencies === true,
      dependencySummary,
      accountStatus: profile.accountStatus === 'deactivated' ? 'deactivated' : 'active',
      authDisabled: Boolean(authUser?.disabled),
      ...(doc.accessClosureAuthError ? { accessClosureAuthError: true } : {}),
      history,
    }
  })

  return NextResponse.json({ requests })
}
