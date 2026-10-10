import { NextResponse } from 'next/server'
import { adminDb, isAdminConfigured } from '@/lib/firebase-admin'
import { collections } from '@/lib/firebase'
import { requireAdminRequest } from '@/lib/admin-api-auth'
import { getAdminAuth, isAdminAuthConfigured } from '@/lib/firebase-admin-auth'
import {
  accountDeletionStatusEmailText,
  buildAccountDeletionAdminPatch,
  isRequestLockedByFinalization,
  normalizeAccountDeletionAdminAction,
  normalizeAdminReason,
} from '@/lib/account-deletion-core'
import { buildAccountDeletionDependencySummary } from '@/lib/account-deletion-dependencies.server'
import { sendAccountDeletionStatusEmail } from '@/lib/email/account-deletion-status-email.server'
import type { AdminAccountDeletionHistoryEntry, AdminAccountDeletionRequestRow, UserRole } from '@/lib/types'

type Params = {
  params: Promise<{ requestId: string }>
}

type RequestDoc = {
  userId?: string
  role?: UserRole
  status?: AdminAccountDeletionRequestRow['status']
  history?: AdminAccountDeletionHistoryEntry[]
  accessClosureAuthError?: boolean
}

/** One email per request's access closure, no matter how many times the closure is resumed or what reason text is typed. */
function accessClosedEmailEventId(requestId: string): string {
  return `account-deletion:${requestId}:access_closed`
}

export async function PATCH(request: Request, { params }: Params) {
  if (!isAdminConfigured || !adminDb) {
    return NextResponse.json({ error: 'Panel administracyjny nie jest skonfigurowany.' }, { status: 503 })
  }

  const body = await request.json().catch(() => null) as { idToken?: unknown; action?: unknown; reason?: unknown } | null
  const admin = await requireAdminRequest(typeof body?.idToken === 'string' ? body.idToken : undefined, 'żądaniami usunięcia kont')
  if (admin instanceof NextResponse) return admin

  const action = normalizeAccountDeletionAdminAction(body?.action)
  if (!action) return NextResponse.json({ error: 'Nieprawidłowa akcja.' }, { status: 400 })
  if (action === 'finalize') {
    return NextResponse.json({ error: 'Trwałe usunięcie konta ma osobny, dodatkowo potwierdzany endpoint.' }, { status: 400 })
  }
  if (action === 'deactivate_access' && !await isAdminAuthConfigured()) {
    return NextResponse.json({ error: 'Firebase Auth Admin API nie jest skonfigurowane.' }, { status: 503 })
  }
  const reason = normalizeAdminReason(body?.reason)
  const { requestId } = await params
  if (!requestId) return NextResponse.json({ error: 'Brak identyfikatora żądania.' }, { status: 400 })

  const requestRef = adminDb.collection(collections.accountDeletionRequests).doc(requestId)
  const requestSnap = await requestRef.get()
  if (!requestSnap.exists) return NextResponse.json({ error: 'Nie znaleziono żądania.' }, { status: 404 })
  const requestData = requestSnap.data() as RequestDoc
  // Once irreversible deletion has started (or finished) the request can only be driven by the finalize endpoint.
  if (isRequestLockedByFinalization(requestData.status)) {
    return NextResponse.json({
      error: requestData.status === 'completed'
        ? 'Konto zostało już usunięte — żądanie jest zamknięte.'
        : 'Trwa usuwanie konta. Użyj akcji „Wznów usuwanie konta”, aby je dokończyć.',
    }, { status: 409 })
  }
  const userId = requestData.userId || requestSnap.id
  const userSnap = await adminDb.collection(collections.users).doc(userId).get()
  if (!userSnap.exists) return NextResponse.json({ error: 'Nie znaleziono profilu użytkownika.' }, { status: 404 })
  const user = userSnap.data() ?? {}
  const role = (requestData.role || user.role || 'student') as UserRole

  // Request already moved to access_closed (profile marked deactivated in the
  // same transaction). Statuses must not regress, and a repeated
  // "deactivate_access" resumes only the missing Firebase Auth step.
  if (requestData.status === 'access_closed') {
    if (action === 'review' || action === 'mark_needs_resolution') {
      return NextResponse.json({ error: 'Dostęp do konta jest już zamknięty — status żądania nie może zostać cofnięty.' }, { status: 409 })
    }
    if (action === 'deactivate_access') {
      return resumeAccessClosure({ requestRef, userRef: userSnap.ref, userId, email: typeof user.email === 'string' ? user.email : '', adminId: admin.uid, reason, wasFlagged: requestData.accessClosureAuthError === true })
    }
  }

  const dependencySummary = await buildAccountDeletionDependencySummary(userId, role)
  const decision = buildAccountDeletionAdminPatch({
    decision: { action, reason },
    adminId: admin.uid,
    now: Date.now(),
    dependencySummary,
  })
  if (!decision.ok) return NextResponse.json({ error: decision.error }, { status: decision.status })

  const updated = await adminDb.runTransaction(async (tx) => {
    const fresh = await tx.get(requestRef)
    if (!fresh.exists) return { ok: false as const, status: 404 as const, error: 'Nie znaleziono żądania.' }
    const current = fresh.data() as RequestDoc
    if (current.status === 'completed' || current.status === 'rejected') {
      return { ok: false as const, status: 409 as const, error: 'Żądanie jest już zamknięte.' }
    }
    if (current.status === 'access_closed' && action === 'deactivate_access') {
      return { ok: true as const, alreadyClosed: true as const }
    }
    const history = Array.isArray(current.history) ? current.history : []
    tx.set(requestRef, {
      status: decision.patch.status,
      hasDependencies: decision.patch.hasDependencies,
      dependencySummary: decision.patch.dependencySummary,
      updatedAt: decision.patch.updatedAt,
      adminNote: decision.patch.adminNote ?? null,
      ...(decision.patch.resolvedAt ? { resolvedAt: decision.patch.resolvedAt } : {}),
      ...(decision.patch.resolvedBy ? { resolvedBy: decision.patch.resolvedBy } : {}),
      ...(decision.patch.rejectionReason ? { rejectionReason: decision.patch.rejectionReason } : {}),
      history: [...history, decision.patch.historyEntry],
      manualProcessingOnly: true,
    }, { merge: true })
    if (action === 'deactivate_access') {
      tx.set(userSnap.ref, {
        accountStatus: 'deactivated',
        deactivatedAt: decision.patch.updatedAt,
        deactivatedBy: admin.uid,
        accountDeletionRequestId: requestRef.id,
        updatedAt: decision.patch.updatedAt,
      }, { merge: true })
    }
    return { ok: true as const }
  })

  if (!updated.ok) return NextResponse.json({ error: updated.error }, { status: updated.status })

  if (action === 'deactivate_access') {
    const auth = await getAdminAuth()
    if (!auth) return NextResponse.json({ error: 'Firebase Auth Admin API nie jest skonfigurowane.' }, { status: 503 })
    try {
      await auth.updateUserDisabled(userId, true)
    } catch (error) {
      await requestRef.set({
        accessClosureAuthError: true,
        accessClosureAuthErrorAt: Date.now(),
      }, { merge: true }).catch(() => {})
      return NextResponse.json({
        error: 'Dostęp oznaczono jako zamknięty w profilu, ale blokada Firebase Auth nie powiodła się. Wznów obsługę żądania po sprawdzeniu konfiguracji.',
      }, { status: 503 })
    }
  }

  const email = typeof user.email === 'string' ? user.email : ''
  if (email) {
    const text = accountDeletionStatusEmailText(decision.patch.status, reason)
    await sendAccountDeletionStatusEmail({
      eventId: action === 'deactivate_access' ? accessClosedEmailEventId(requestId) : `account-deletion:${requestId}:${action}:${decision.patch.status}:${reason}`,
      recipientUid: userId,
      ...text,
    })
  }

  return NextResponse.json({
    ok: true,
    status: decision.patch.status,
    hasDependencies: decision.patch.hasDependencies,
    dependencySummary: decision.patch.dependencySummary,
  })
}

/**
 * Idempotent completion of a partially failed access closure
 * (request = access_closed, but Firebase Auth may still be enabled).
 * Safe to call repeatedly: Auth is only changed when it is not disabled yet,
 * the audit entry is written only when something was actually repaired, and
 * the notification email is deduplicated by a stable event id.
 */
async function resumeAccessClosure(input: {
  requestRef: FirebaseFirestore.DocumentReference
  userRef: FirebaseFirestore.DocumentReference
  userId: string
  email: string
  adminId: string
  reason: string
  wasFlagged: boolean
}) {
  const auth = await getAdminAuth()
  if (!auth) return NextResponse.json({ error: 'Firebase Auth Admin API nie jest skonfigurowane.' }, { status: 503 })

  let wasDisabled = false
  try {
    wasDisabled = (await auth.getUser(input.userId)).disabled === true
    if (!wasDisabled) await auth.updateUserDisabled(input.userId, true)
  } catch {
    await input.requestRef.set({ accessClosureAuthError: true, accessClosureAuthErrorAt: Date.now() }, { merge: true }).catch(() => {})
    return NextResponse.json({
      error: 'Nie udało się zablokować konta w Firebase Auth. Sprawdź konfigurację i spróbuj ponownie — operację można bezpiecznie powtórzyć.',
    }, { status: 503 })
  }

  const repaired = !wasDisabled || input.wasFlagged
  const now = Date.now()
  await adminDb!.runTransaction(async (tx) => {
    const fresh = await tx.get(input.requestRef)
    const current = (fresh.data() ?? {}) as RequestDoc
    const history = Array.isArray(current.history) ? current.history : []
    tx.set(input.userRef, { accountStatus: 'deactivated', accountDeletionRequestId: input.requestRef.id, updatedAt: now }, { merge: true })
    tx.set(input.requestRef, {
      accessClosureAuthError: false,
      updatedAt: now,
      ...(repaired ? {
        history: [...history, {
          action: 'deactivate_access' as const,
          actorId: input.adminId,
          actorRole: 'admin' as const,
          note: input.reason || 'Wznowiono blokadę logowania w Firebase Auth.',
          createdAt: now,
        }],
      } : {}),
    }, { merge: true })
  })

  if (input.email) {
    const text = accountDeletionStatusEmailText('access_closed', input.reason)
    await sendAccountDeletionStatusEmail({ eventId: accessClosedEmailEventId(input.requestRef.id), recipientUid: input.userId, ...text })
  }

  return NextResponse.json({ ok: true, status: 'access_closed' as const, resumed: repaired })
}
