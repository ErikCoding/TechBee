import { NextResponse } from 'next/server'
import { FieldValue } from 'firebase-admin/firestore'
import { adminDb, isAdminConfigured } from '@/lib/firebase-admin'
import { isAdminAuthConfigured } from '@/lib/firebase-admin-auth'
import { collections } from '@/lib/firebase'
import { requireAdminRequest } from '@/lib/admin-api-auth'
import { checkAndRecordAccountSecurityAttempt } from '@/lib/account-security.server'
import {
  ACCOUNT_DELETION_FINALIZE_CONFIRMATION,
  ACCOUNT_FINALIZATION_STEPS,
  assessAccountFinalization,
  canStartAccountFinalizationFrom,
  executeAccountFinalization,
  finalizationLockIsActive,
  type AccountDeletionRequestStatus,
  type AccountFinalizationState,
  type AccountFinalizationStep,
} from '@/lib/account-deletion-core'
import { buildAccountDeletionDependencySummary } from '@/lib/account-deletion-dependencies.server'
import { runAccountFinalizationStep } from '@/lib/account-deletion-finalize.server'
import type { UserRole } from '@/lib/types'

type Params = { params: Promise<{ requestId: string }> }

type RequestDoc = {
  userId?: string
  role?: UserRole
  status?: AccountDeletionRequestStatus
  history?: unknown[]
  finalization?: Partial<AccountFinalizationState>
}

/**
 * Irreversible deletion of one account (see lib/account-deletion-core.ts for
 * the rules and lib/account-deletion-finalize.server.ts for the steps).
 *
 * Safety:
 *  - admin-only; one request per call (no bulk form of this endpoint exists);
 *  - the admin must type the confirmation phrase AND repeat the user id;
 *  - administrators and the caller's own account are refused;
 *  - blocked while lessons/packages/payouts/disputes are open, or when the
 *    dependency scan is incomplete (checked again here, never trusted from the UI);
 *  - a Stripe Connect account needs an explicit admin acknowledgement; this
 *    endpoint never calls Stripe;
 *  - rate limited per admin (cooldown + hourly cap);
 *  - re-calling it resumes from the persisted `completedSteps` and never repeats a finished step.
 */
export async function POST(request: Request, { params }: Params) {
  if (!isAdminConfigured || !adminDb) {
    return NextResponse.json({ error: 'Panel administracyjny nie jest skonfigurowany.' }, { status: 503 })
  }
  if (!await isAdminAuthConfigured()) {
    return NextResponse.json({ error: 'Firebase Auth Admin API nie jest skonfigurowane.' }, { status: 503 })
  }

  const body = await request.json().catch(() => null) as {
    idToken?: unknown
    confirmation?: unknown
    confirmUserId?: unknown
    stripeConnectAcknowledged?: unknown
  } | null
  const admin = await requireAdminRequest(typeof body?.idToken === 'string' ? body.idToken : undefined, 'żądaniami usunięcia kont')
  if (admin instanceof NextResponse) return admin

  const { requestId } = await params
  if (!requestId) return NextResponse.json({ error: 'Brak identyfikatora żądania.' }, { status: 400 })
  if (typeof body?.confirmation !== 'string' || body.confirmation.trim() !== ACCOUNT_DELETION_FINALIZE_CONFIRMATION) {
    return NextResponse.json({ error: `Wpisz dokładnie: ${ACCOUNT_DELETION_FINALIZE_CONFIRMATION}.` }, { status: 400 })
  }

  const requestRef = adminDb.collection(collections.accountDeletionRequests).doc(requestId)
  const requestSnap = await requestRef.get()
  if (!requestSnap.exists) return NextResponse.json({ error: 'Nie znaleziono żądania.' }, { status: 404 })
  const requestData = requestSnap.data() as RequestDoc
  const userId = requestData.userId || requestSnap.id
  if (body.confirmUserId !== userId) {
    return NextResponse.json({ error: 'Identyfikator użytkownika nie zgadza się z żądaniem.' }, { status: 400 })
  }

  const status = requestData.status ?? 'pending_review'
  if (status === 'completed') return NextResponse.json({ ok: true, status: 'completed', alreadyCompleted: true })
  if (!canStartAccountFinalizationFrom(status)) {
    return NextResponse.json({ error: 'Tego żądania nie można sfinalizować w obecnym statusie.' }, { status: 409 })
  }

  const userRef = adminDb.collection(collections.users).doc(userId)
  const userSnap = await userRef.get()
  const profile = userSnap.data() ?? {}
  const completedBefore = Array.isArray(requestData.finalization?.completedSteps) ? requestData.finalization.completedSteps : []
  // After the tombstone step the profile no longer carries a role — the request does.
  const role = (profile.role ?? requestData.role) as UserRole | undefined
  if (!userSnap.exists && !completedBefore.includes('user_tombstone')) {
    return NextResponse.json({ error: 'Nie znaleziono profilu użytkownika.' }, { status: 404 })
  }

  // Administrator accounts are protected independently of anything else.
  if (role === 'admin' || profile.role === 'admin') {
    return NextResponse.json({ error: 'Konta administratorów nie mogą być usuwane.' }, { status: 403 })
  }
  if (userId === admin.uid) {
    return NextResponse.json({ error: 'Nie możesz usunąć własnego konta.' }, { status: 403 })
  }

  const resuming = status === 'finalizing'
  const stripeAck = body.stripeConnectAcknowledged === true
  // A resumed run has already passed the checks once and has started erasing
  // data (the dependency scan would now see a partly erased account), so only a fresh start is re-scanned.
  if (!resuming) {
    const summary = await buildAccountDeletionDependencySummary(userId, role as UserRole)
    const assessment = assessAccountFinalization({ summary, role, requestStatus: status, userId, adminId: admin.uid, stripeConnectAcknowledged: stripeAck })
    if (!assessment.allowed) {
      return NextResponse.json({ error: 'Finalizacja jest zablokowana.', blockers: assessment.blockers }, { status: 409 })
    }
  }

  const now = Date.now()
  const limit = await checkAndRecordAccountSecurityAttempt(collections.accountDeletionRateLimits, `finalize-${admin.uid}`, now)
  if (!limit.allowed) {
    const retryAfter = Math.max(1, Math.ceil(limit.retryAfterSeconds))
    return NextResponse.json({ error: 'Zbyt wiele finalizacji w krótkim czasie. Spróbuj ponownie za chwilę.', retryAfterSeconds: retryAfter }, {
      status: 429,
      headers: { 'Retry-After': String(retryAfter) },
    })
  }

  // Claim: one run at a time; a lock from a crashed run expires.
  const claim = await adminDb.runTransaction(async (tx) => {
    const fresh = await tx.get(requestRef)
    const current = (fresh.data() ?? {}) as RequestDoc
    if (current.status === 'completed') return { kind: 'completed' as const }
    if (!canStartAccountFinalizationFrom(current.status ?? 'pending_review')) return { kind: 'blocked' as const }
    if (finalizationLockIsActive(current.finalization as AccountFinalizationState | undefined, now)) return { kind: 'busy' as const }
    const previous = current.finalization ?? {}
    const history = Array.isArray(current.history) ? current.history : []
    const started = previous.startedAt ?? now
    tx.set(requestRef, {
      status: 'finalizing',
      updatedAt: now,
      role,
      finalization: {
        state: 'in_progress',
        startedAt: started,
        startedBy: previous.startedBy ?? admin.uid,
        lockedAt: now,
        attempts: (previous.attempts ?? 0) + 1,
        completedSteps: previous.completedSteps ?? [],
        ...(stripeAck ? { stripeConnectAcknowledgedBy: admin.uid } : previous.stripeConnectAcknowledgedBy ? { stripeConnectAcknowledgedBy: previous.stripeConnectAcknowledgedBy } : {}),
      },
      ...(previous.startedAt ? {} : {
        history: [...history, { action: 'finalize', actorId: admin.uid, actorRole: 'admin', note: 'Rozpoczęto trwałe usuwanie konta.', createdAt: now }],
      }),
    }, { merge: true })
    return { kind: 'claimed' as const, completedSteps: (previous.completedSteps ?? []) as string[] }
  })
  if (claim.kind === 'completed') return NextResponse.json({ ok: true, status: 'completed', alreadyCompleted: true })
  if (claim.kind === 'blocked') return NextResponse.json({ error: 'Tego żądania nie można sfinalizować w obecnym statusie.' }, { status: 409 })
  if (claim.kind === 'busy') return NextResponse.json({ error: 'Finalizacja tego konta jest już w toku. Spróbuj ponownie za kilka minut.' }, { status: 409 })

  const ctx = { uid: userId, role: role as UserRole, requestId, adminId: admin.uid, now }
  const result = await executeAccountFinalization({
    completedSteps: claim.completedSteps,
    run: (step: AccountFinalizationStep) => runAccountFinalizationStep(step, ctx),
    onStepDone: async (step) => {
      await requestRef.update({
        'finalization.completedSteps': FieldValue.arrayUnion(step),
        'finalization.lockedAt': Date.now(),
        updatedAt: Date.now(),
      })
    },
  })

  if (!result.ok) {
    // Only the step name is logged and stored — never ids of other users or message content.
    console.error('[account-deletion] Finalization step failed', { requestId, step: result.failedStep })
    const failedAt = Date.now()
    await requestRef.update({
      'finalization.state': 'failed',
      'finalization.lockedAt': FieldValue.delete(),
      'finalization.lastError': { step: result.failedStep, at: failedAt },
      updatedAt: failedAt,
      history: FieldValue.arrayUnion({ action: 'finalize_failed', actorId: admin.uid, actorRole: 'admin', note: `Krok „${result.failedStep}” nie powiódł się. Można wznowić.`, createdAt: failedAt }),
    }).catch(() => {})
    return NextResponse.json({
      error: `Usuwanie konta zatrzymało się na kroku „${result.failedStep}”. Dane nie są w pełni usunięte — wznów finalizację, aby dokończyć.`,
      failedStep: result.failedStep,
      completedSteps: ACCOUNT_FINALIZATION_STEPS.length,
    }, { status: 502 })
  }

  const doneAt = Date.now()
  await requestRef.update({
    status: 'completed',
    resolvedAt: doneAt,
    resolvedBy: admin.uid,
    updatedAt: doneAt,
    'finalization.state': 'completed',
    'finalization.lockedAt': FieldValue.delete(),
    'finalization.lastError': FieldValue.delete(),
    history: FieldValue.arrayUnion({ action: 'finalize_completed', actorId: admin.uid, actorRole: 'admin', note: 'Konto zostało trwale usunięte.', createdAt: doneAt }),
  })

  return NextResponse.json({ ok: true, status: 'completed' })
}
