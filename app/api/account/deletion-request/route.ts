import { NextResponse } from 'next/server'
import { adminDb, isAdminConfigured } from '@/lib/firebase-admin'
import { collections } from '@/lib/firebase'
import { getAdminAuth, isAdminAuthConfigured } from '@/lib/firebase-admin-auth'
import { RECENT_LOGIN_MAX_AGE_MS } from '@/lib/account-security-endpoints'
import { checkAndRecordAccountSecurityAttempt } from '@/lib/account-security.server'
import {
  canRequestSelfServiceAccountDeletion,
  deletionRequestHasDependencies,
  isValidDeletionConfirmation,
} from '@/lib/account-deletion-core'
import { buildAccountDeletionDependencySummary } from '@/lib/account-deletion-dependencies.server'
import { sendProductNotificationEmail } from '@/lib/email/product-notifications.server'
import type { UserRole } from '@/lib/types'

function bearerToken(authorization: string | null): string | null {
  const prefix = 'Bearer '
  if (!authorization?.startsWith(prefix)) return null
  return authorization.slice(prefix.length).trim() || null
}

function authTimeIsRecent(authTimeSeconds: number | undefined, nowMs: number): boolean {
  if (!Number.isFinite(authTimeSeconds)) return false
  return nowMs - Number(authTimeSeconds) * 1000 <= RECENT_LOGIN_MAX_AGE_MS
}

export async function POST(request: Request) {
  if (!isAdminConfigured || !adminDb || !await isAdminAuthConfigured()) {
    return NextResponse.json({ error: 'Obsługa żądań usunięcia konta nie jest skonfigurowana.' }, { status: 503 })
  }

  const idToken = bearerToken(request.headers.get('authorization'))
  if (!idToken) return NextResponse.json({ error: 'Musisz być zalogowany.' }, { status: 401 })
  const body = await request.json().catch(() => null) as { confirmation?: unknown } | null
  if (!isValidDeletionConfirmation(body?.confirmation)) {
    return NextResponse.json({ error: 'Wpisz dokładnie: USUŃ KONTO.' }, { status: 400 })
  }

  const auth = await getAdminAuth()
  if (!auth) return NextResponse.json({ error: 'Firebase Auth Admin API nie jest skonfigurowane.' }, { status: 503 })

  let verified: { uid: string; auth_time?: number }
  try {
    verified = await auth.verifyIdToken(idToken)
  } catch {
    return NextResponse.json({ error: 'Musisz być zalogowany.' }, { status: 401 })
  }

  const now = Date.now()
  if (!authTimeIsRecent(verified.auth_time, now)) {
    return NextResponse.json({
      error: 'Ze względów bezpieczeństwa zaloguj się ponownie i spróbuj jeszcze raz.',
      code: 'requires-recent-login',
    }, { status: 401 })
  }

  const userRef = adminDb.collection(collections.users).doc(verified.uid)
  const userSnap = await userRef.get()
  if (!userSnap.exists) return NextResponse.json({ error: 'Nie znaleziono profilu użytkownika.' }, { status: 404 })
  const user = userSnap.data() ?? {}
  const role = user.role as UserRole | undefined
  if (!canRequestSelfServiceAccountDeletion(role)) {
    return NextResponse.json({ error: 'Konta administratorów nie mogą być usuwane w trybie samoobsługowym.' }, { status: 403 })
  }
  const safeRole = role as UserRole

  const rateLimit = await checkAndRecordAccountSecurityAttempt(collections.accountDeletionRateLimits, verified.uid, now)
  if (!rateLimit.allowed) {
    const retryAfter = Math.max(1, Math.ceil(rateLimit.retryAfterSeconds ?? 60))
    return NextResponse.json({ error: 'Zbyt wiele prób. Spróbuj ponownie za chwilę.', retryAfterSeconds: retryAfter }, {
      status: 429,
      headers: { 'Retry-After': String(retryAfter) },
    })
  }

  const dependencies = await buildAccountDeletionDependencySummary(verified.uid, safeRole)
  const requestRef = adminDb.collection(collections.accountDeletionRequests).doc(verified.uid)
  const existingRequest = await requestRef.get()
  if (existingRequest.exists) {
    const existing = existingRequest.data() ?? {}
    const status = existing.status
    if (status === 'pending_review' || status === 'needs_resolution' || status === 'access_closed') {
      return NextResponse.json({
        ok: true,
        status,
        hasDependencies: existing.hasDependencies === true,
        dependencySummary: existing.dependencySummary ?? dependencies,
        duplicate: true,
        emailSent: false,
      })
    }
  }
  await requestRef.set({
    userId: verified.uid,
    role: safeRole,
    status: 'pending_review',
    dependencySummary: dependencies,
    hasDependencies: deletionRequestHasDependencies(dependencies),
    requestedAt: now,
    updatedAt: now,
    source: 'self_service_settings',
    history: [{
      action: 'requested',
      actorId: verified.uid,
      actorRole: 'user',
      createdAt: now,
    }],
  }, { merge: true })

  let emailSent = false
  const email = typeof user.email === 'string' ? user.email : undefined
  if (email) {
    try {
      const ack = await sendProductNotificationEmail({
        eventId: `account-deletion:${verified.uid}:requested:${now}`,
        recipientUid: verified.uid,
        type: 'account.deletionStatus',
        required: true,
        subject: 'Przyjęliśmy żądanie usunięcia konta Runbee',
        title: 'Żądanie usunięcia konta zostało przyjęte',
        preheader: 'Zapisaliśmy Twoje żądanie i przekażemy je do bezpiecznej obsługi.',
        body: `Cześć${typeof user.name === 'string' && user.name ? ` ${user.name}` : ''},\n\nPrzyjęliśmy żądanie usunięcia konta Runbee. Ze względu na możliwe lekcje, pakiety, rozliczenia lub obowiązki administracyjne konto zostanie sprawdzone przed wykonaniem dalszych kroków.\n\nDo czasu zakończenia obsługi nie usuwamy automatycznie danych finansowych, historii lekcji ani rozliczeń.`,
        secondaryText: 'Jeśli nie składałeś(-aś) takiego żądania, skontaktuj się z Runbee: kontakt@runbee.pl.',
      })
      emailSent = ack.status === 'sent'
    } catch (error) {
      console.error('[account-deletion] Failed to send request confirmation', {
        uid: verified.uid,
        message: error instanceof Error ? error.message : 'Unknown error',
      })
    }
  }

  return NextResponse.json({
    ok: true,
    status: 'pending_review',
    hasDependencies: deletionRequestHasDependencies(dependencies),
    dependencySummary: dependencies,
    emailSent,
  })
}
