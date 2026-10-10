import type { UserRole } from '@/lib/types'

export type AccountDeletionDependencySummary = {
  activeLessons: number
  activePackages: number
  pendingReports: number
  pendingPayouts: number
  openDisputes?: number
  familyLinks: number
  publicTeacherProfile: boolean
  conversations: number
  stripeConnectReviewRequired: boolean
  paymentRecordsReviewRequired?: boolean
  scanComplete?: boolean
  scanErrors?: string[]
}

export type AccountDeletionDependencyAssessment = {
  status: 'clear' | 'blocking' | 'review_required'
  blockingReasons: string[]
  reviewReasons: string[]
  historicalReasons: string[]
  canCloseAccess: boolean
}

export type AccountDeletionRequestStatus = 'pending_review' | 'needs_resolution' | 'access_closed' | 'finalizing' | 'completed' | 'rejected'
export type AccountDeletionAdminAction = 'review' | 'mark_needs_resolution' | 'deactivate_access' | 'finalize' | 'reject'

export type AccountDeletionHistoryEntry = {
  action: AccountDeletionAdminAction | 'requested' | 'finalize_failed' | 'finalize_completed'
  actorId: string
  actorRole: 'user' | 'admin' | 'system'
  note?: string
  createdAt: number
}

export const ACCOUNT_DELETION_CONFIRMATION = 'USUŃ KONTO'
/** Typed by an administrator before an irreversible finalization. */
export const ACCOUNT_DELETION_FINALIZE_CONFIRMATION = 'USUŃ TRWALE'
/** Neutral display values left on records that must stay (lessons, payouts, tombstone). */
export const DELETED_USER_NAME = 'Usunięty użytkownik'
export const DELETED_USER_INITIALS = 'U'
export const DELETED_USER_COLOR = '#9ca3af'
/** A finalization lock older than this is considered abandoned (crashed run) and may be taken over. */
export const FINALIZATION_LOCK_STALE_MS = 5 * 60 * 1000

export function canRequestSelfServiceAccountDeletion(role: UserRole | undefined): boolean {
  return role === 'student' || role === 'teacher' || role === 'parent'
}

export function deletionRequestHasDependencies(summary: AccountDeletionDependencySummary): boolean {
  const assessment = assessAccountDeletionDependencies(summary)
  return assessment.blockingReasons.length > 0 || assessment.reviewReasons.length > 0
}

export function assessAccountDeletionDependencies(summary: AccountDeletionDependencySummary): AccountDeletionDependencyAssessment {
  const blockingReasons: string[] = []
  const reviewReasons: string[] = []
  const historicalReasons: string[] = []

  if (summary.activeLessons > 0) blockingReasons.push(`Aktywne lub oczekujące lekcje: ${summary.activeLessons}`)
  if (summary.activePackages > 0) blockingReasons.push(`Aktywne pakiety lub zarezerwowane kredyty: ${summary.activePackages}`)
  if (summary.pendingReports > 0) blockingReasons.push(`Nierozliczone raporty lub należności: ${summary.pendingReports}`)
  if (summary.pendingPayouts > 0) blockingReasons.push(`Oczekujące wypłaty: ${summary.pendingPayouts}`)
  if ((summary.openDisputes ?? 0) > 0) blockingReasons.push(`Otwarte spory: ${summary.openDisputes}`)

  if (summary.familyLinks > 0) reviewReasons.push(`Aktywne relacje rodzic-uczeń: ${summary.familyLinks}`)
  if (summary.stripeConnectReviewRequired) reviewReasons.push('Stripe Connect wymaga ręcznego sprawdzenia salda i statusu konta')
  if (summary.paymentRecordsReviewRequired === true && summary.pendingReports === 0 && summary.pendingPayouts === 0) {
    reviewReasons.push('Dane płatnicze wymagają ręcznego przeglądu retencji')
  }
  if (summary.scanComplete === false) reviewReasons.push('Dependency scan nie został zakończony poprawnie')
  for (const error of summary.scanErrors ?? []) {
    reviewReasons.push(`Niepełna weryfikacja: ${error}`)
  }

  if (summary.publicTeacherProfile) historicalReasons.push('Istnieje publiczny profil nauczyciela')
  if (summary.conversations > 0) historicalReasons.push(`Historyczne rozmowy: ${summary.conversations}`)

  const status = blockingReasons.length > 0 ? 'blocking' : reviewReasons.length > 0 ? 'review_required' : 'clear'
  return {
    status,
    blockingReasons,
    reviewReasons,
    historicalReasons,
    canCloseAccess: status === 'clear',
  }
}

export function normalizeDeletionConfirmation(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

export function isValidDeletionConfirmation(value: unknown): boolean {
  return normalizeDeletionConfirmation(value) === ACCOUNT_DELETION_CONFIRMATION
}

export function accountDeletionStatusLabel(status: AccountDeletionRequestStatus): string {
  if (status === 'pending_review') return 'Oczekuje na weryfikację'
  if (status === 'needs_resolution') return 'Wymaga rozwiązania'
  if (status === 'access_closed') return 'Dostęp zamknięty, dane nadal istnieją'
  if (status === 'finalizing') return 'Finalizacja w toku'
  if (status === 'completed') return 'Konto usunięte'
  return 'Odrzucone'
}

/** One-line explanation shown under the status, so a label can never be read as "deleted" when it is not. */
export function accountDeletionStatusDescription(status: AccountDeletionRequestStatus): string {
  if (status === 'pending_review') return 'Konto działa normalnie. Żądanie czeka na decyzję administratora.'
  if (status === 'needs_resolution') return 'Konto działa, ale istnieją zobowiązania, które trzeba rozwiązać przed usunięciem.'
  if (status === 'access_closed') return 'Logowanie jest zablokowane, ale dane konta nie zostały jeszcze usunięte.'
  if (status === 'finalizing') return 'Trwa nieodwracalne usuwanie danych. Jeśli proces się zatrzymał, można go bezpiecznie wznowić.'
  if (status === 'completed') return 'Tożsamość została usunięta z Firebase Auth i Firestore. Pozostały wyłącznie dane, które trzeba zachować.'
  return 'Żądanie zamknięte bez usuwania konta.'
}

export function normalizeAccountDeletionAdminAction(value: unknown): AccountDeletionAdminAction | null {
  return value === 'review'
    || value === 'mark_needs_resolution'
    || value === 'deactivate_access'
    || value === 'finalize'
    || value === 'reject'
    ? value
    : null
}

export function accountDeletionActionRequiresReason(action: AccountDeletionAdminAction): boolean {
  return action === 'mark_needs_resolution' || action === 'deactivate_access' || action === 'finalize' || action === 'reject'
}

export function canDeactivateAccountAccess(summary: AccountDeletionDependencySummary): boolean {
  return assessAccountDeletionDependencies(summary).canCloseAccess
}

export type AccountDeletionAdminDecision = {
  action: AccountDeletionAdminAction
  reason?: string
}

export type AccountDeletionAdminPatch = {
  status: AccountDeletionRequestStatus
  hasDependencies: boolean
  dependencySummary: AccountDeletionDependencySummary
  updatedAt: number
  adminNote?: string
  resolvedAt?: number
  resolvedBy?: string
  rejectionReason?: string
  historyEntry: AccountDeletionHistoryEntry
}

export function normalizeAdminReason(value: unknown): string {
  return typeof value === 'string' ? value.trim().slice(0, 1200) : ''
}

export function buildAccountDeletionAdminPatch(input: {
  decision: AccountDeletionAdminDecision
  adminId: string
  now: number
  dependencySummary: AccountDeletionDependencySummary
}): { ok: true; patch: AccountDeletionAdminPatch } | { ok: false; error: string; status: 400 | 409 } {
  const action = input.decision.action
  const reason = normalizeAdminReason(input.decision.reason)
  if (accountDeletionActionRequiresReason(action) && !reason) {
    return { ok: false, error: 'Podaj uzasadnienie decyzji.', status: 400 }
  }

  const hasDependencies = deletionRequestHasDependencies(input.dependencySummary)
  let status: AccountDeletionRequestStatus
  if (action === 'review') status = hasDependencies ? 'needs_resolution' : 'pending_review'
  else if (action === 'mark_needs_resolution') status = 'needs_resolution'
  else if (action === 'deactivate_access') {
    if (!canDeactivateAccountAccess(input.dependencySummary)) {
      return {
        ok: false,
        error: 'Nie można zamknąć dostępu, dopóki żądanie ma aktywne zobowiązania, wymaga przeglądu lub dependency scan jest niepełny.',
        status: 409,
      }
    }
    status = 'access_closed'
  }
  else if (action === 'reject') status = 'rejected'
  else {
    // 'finalize' is a multi-step, resumable operation with its own endpoint
    // (POST .../[requestId]/finalize) — it must never be a plain status patch.
    return {
      ok: false,
      error: 'Finalizacja usunięcia konta ma osobną ścieżkę i wymaga dodatkowego potwierdzenia.',
      status: 400,
    }
  }

  const historyEntry: AccountDeletionHistoryEntry = {
    action,
    actorId: input.adminId,
    actorRole: 'admin',
    ...(reason ? { note: reason } : {}),
    createdAt: input.now,
  }

  return {
    ok: true,
    patch: {
      status,
      hasDependencies,
      dependencySummary: input.dependencySummary,
      updatedAt: input.now,
      historyEntry,
      ...(reason ? { adminNote: reason } : {}),
      ...(status === 'rejected' ? { resolvedAt: input.now, resolvedBy: input.adminId } : {}),
      ...(status === 'rejected' ? { rejectionReason: reason } : {}),
    },
  }
}

export function accountDeletionStatusEmailText(status: AccountDeletionRequestStatus, note?: string): { subject: string; title: string; body: string } {
  const label = accountDeletionStatusLabel(status)
  if (status === 'needs_resolution') {
    return {
      subject: 'Aktualizacja żądania usunięcia konta Runbee',
      title: 'Żądanie wymaga dodatkowych działań',
      body: `Status Twojego żądania usunięcia konta: ${label}.\n\nPrzed zakończeniem obsługi musimy rozwiązać aktywne zobowiązania lub zależności konta.${note ? `\n\nInformacja od administratora: ${note}` : ''}`,
    }
  }
  if (status === 'completed') {
    return {
      subject: 'Konto Runbee zostało usunięte',
      title: 'Konto zostało usunięte',
      body: `Zrealizowaliśmy Twoje żądanie. Usunęliśmy Twoje konto logowania oraz dane profilowe, powiadomienia, załączniki i inne dane niewymagane do dalszego przechowywania.\n\nDane, które musimy zachować (np. dokumentacja rozliczeń płatności i wypłat), pozostają w ograniczonym zakresie i bez wyświetlania Twojego imienia.${note ? `\n\nInformacja od administratora: ${note}` : ''}`,
    }
  }
  if (status === 'access_closed') {
    return {
      subject: 'Dostęp do konta Runbee został zamknięty',
      title: 'Dostęp do konta został zamknięty',
      body: `Status Twojego żądania usunięcia konta: ${label}.\n\nLogowanie do konta zostało zablokowane. Dane konta nie zostały jeszcze usunięte; poinformujemy Cię, gdy usunięcie zostanie zakończone.${note ? `\n\nInformacja od administratora: ${note}` : ''}`,
    }
  }
  if (status === 'rejected') {
    return {
      subject: 'Żądanie usunięcia konta Runbee zostało zamknięte',
      title: 'Żądanie zostało zamknięte',
      body: `Status Twojego żądania usunięcia konta: ${label}.\n\nUzasadnienie: ${note || 'Administrator zamknął żądanie na podstawie dostępnych informacji.'}`,
    }
  }
  return {
    subject: 'Aktualizacja żądania usunięcia konta Runbee',
    title: 'Żądanie zostało rozpatrzone',
    body: `Status Twojego żądania usunięcia konta: ${label}.${note ? `\n\nInformacja od administratora: ${note}` : ''}`,
  }
}

// ─────────────────────────────────────────────────────────────
// Finalization (irreversible deletion) — pure rules and helpers.
// Everything that touches Firestore / Auth / Storage lives in
// lib/account-deletion-finalize.server.ts; this part has no I/O so
// it can be unit-tested.
// ─────────────────────────────────────────────────────────────

/** Ordered, individually idempotent steps. Auth deletion is last: until then the account is merely disabled and the run can be resumed. */
export const ACCOUNT_FINALIZATION_STEPS = [
  'close_access',
  'notifications',
  'points_and_wallet',
  'family_links',
  'chat',
  'reviews',
  'retained_records',
  'storage',
  'teacher_profile',
  'email_records',
  'notify_user',
  'user_tombstone',
  'auth_user',
] as const
export type AccountFinalizationStep = (typeof ACCOUNT_FINALIZATION_STEPS)[number]

/** What finalization does — shown to the administrator before confirming and kept in sync with the privacy policy draft. */
export const ACCOUNT_DELETION_SCOPE = {
  deleted: [
    'konto logowania w Firebase Auth (adres e-mail, hasło, dostawca logowania)',
    'profil użytkownika w Firestore (imię, nazwisko, e-mail, zdjęcie, preferencje, powiązania rodzinne)',
    'powiadomienia, punkty BeePoints i ich historia, kody powiązania rodzic-uczeń',
    'zdjęcie profilowe i załączniki wysłane w czacie (Storage)',
    'publiczny profil nauczyciela wraz z danymi aplikacji',
    'zapisy kolejki e-mail powiązane z kontem',
    'treść i załączniki wiadomości napisanych przez użytkownika w rozmowach',
  ],
  anonymized: [
    'imię i zdjęcie użytkownika w rozmowach, lekcjach i opiniach innych użytkowników (zastępuje je „Usunięty użytkownik”)',
    'autorstwo opinii o nauczycielach (ocena i treść zostają bez powiązania z kontem)',
  ],
  retained: [
    'lekcje, raporty i spory (dla drugiej strony oraz rozliczeń) — bez wyświetlania imienia usuniętego użytkownika',
    'pakiety lekcji, zapisy płatności, zwroty, transfery i wypłaty oraz zdarzenia Stripe',
    'identyfikator konta Stripe Connect nauczyciela w zapisie żądania (do uzgodnień ze Stripe)',
    'techniczny, zanonimizowany znacznik konta (identyfikator, rola, data usunięcia) i historia żądania',
  ],
} as const

export type AccountFinalizationAssessment = {
  allowed: boolean
  blockers: string[]
  warnings: string[]
}

/**
 * Whether an irreversible finalization may start (or be resumed). The server
 * re-runs this against a fresh dependency scan — the UI uses the same
 * function only to explain to the administrator why the button is disabled.
 */
export function assessAccountFinalization(input: {
  summary: AccountDeletionDependencySummary
  role: UserRole | undefined
  requestStatus: AccountDeletionRequestStatus
  userId: string
  adminId: string
  stripeConnectAcknowledged?: boolean
}): AccountFinalizationAssessment {
  const blockers: string[] = []
  const warnings: string[] = []

  if (input.role === 'admin') blockers.push('Konta administratorów nie mogą być usuwane.')
  if (!input.role) blockers.push('Nie można ustalić roli użytkownika.')
  if (input.userId === input.adminId) blockers.push('Nie możesz usunąć własnego konta.')
  if (input.requestStatus === 'rejected') blockers.push('Żądanie zostało odrzucone.')
  if (input.requestStatus === 'completed') blockers.push('Konto zostało już usunięte.')

  const assessment = assessAccountDeletionDependencies(input.summary)
  blockers.push(...assessment.blockingReasons)
  if (input.summary.scanComplete === false) blockers.push('Skan zależności nie został zakończony poprawnie.')
  for (const error of input.summary.scanErrors ?? []) blockers.push(`Niepełna weryfikacja: ${error}`)

  if (input.summary.stripeConnectReviewRequired) {
    if (input.stripeConnectAcknowledged === true) {
      warnings.push('Administrator potwierdził ręczne sprawdzenie salda i statusu konta Stripe Connect.')
    } else {
      blockers.push('Konto Stripe Connect wymaga ręcznego sprawdzenia salda i statusu w Stripe oraz potwierdzenia przez administratora.')
    }
  }
  if (input.summary.familyLinks > 0) warnings.push('Powiązania rodzic-uczeń zostaną usunięte po obu stronach.')
  if (input.summary.conversations > 0) warnings.push('Rozmowy pozostaną dla drugiej strony, z zanonimizowanym autorem.')

  return { allowed: blockers.length === 0, blockers: [...new Set(blockers)], warnings }
}

/** Statuses from which finalization may be started or resumed. */
export function canStartAccountFinalizationFrom(status: AccountDeletionRequestStatus): boolean {
  return status === 'pending_review' || status === 'needs_resolution' || status === 'access_closed' || status === 'finalizing'
}

/** After finalization starts, only finalization itself may touch the request. */
export function isRequestLockedByFinalization(status: AccountDeletionRequestStatus | undefined): boolean {
  return status === 'finalizing' || status === 'completed'
}

export type AccountFinalizationState = {
  state: 'in_progress' | 'failed' | 'completed'
  startedAt: number
  startedBy: string
  lockedAt?: number
  attempts: number
  completedSteps: AccountFinalizationStep[]
  lastError?: { step: AccountFinalizationStep; at: number }
  stripeConnectAcknowledgedBy?: string
}

/** True while another run holds a fresh lock; a stale lock (crashed run) can be taken over. */
export function finalizationLockIsActive(finalization: Pick<AccountFinalizationState, 'state' | 'lockedAt'> | undefined, now: number): boolean {
  return finalization?.state === 'in_progress' && typeof finalization.lockedAt === 'number' && now - finalization.lockedAt < FINALIZATION_LOCK_STALE_MS
}

export function remainingFinalizationSteps(completed: readonly string[] | undefined): AccountFinalizationStep[] {
  const done = new Set(completed ?? [])
  return ACCOUNT_FINALIZATION_STEPS.filter((step) => !done.has(step))
}

/**
 * Runs the remaining steps in order. Each finished step is reported through
 * `onStepDone` (persisted by the caller), the first failure stops the run and
 * is reported — a later call with the persisted `completedSteps` resumes at
 * exactly that step, never repeating finished ones.
 */
export async function executeAccountFinalization(input: {
  completedSteps: readonly string[] | undefined
  run: (step: AccountFinalizationStep) => Promise<void>
  onStepDone: (step: AccountFinalizationStep) => Promise<void>
}): Promise<{ ok: true } | { ok: false; failedStep: AccountFinalizationStep }> {
  for (const step of remainingFinalizationSteps(input.completedSteps)) {
    try {
      await input.run(step)
    } catch {
      return { ok: false, failedStep: step }
    }
    await input.onStepDone(step)
  }
  return { ok: true }
}

// ── Anonymization helpers (pure) ──────────────────────────────

type MaybeRecord = Record<string, unknown>

export function anonymizedChatParticipant(participant: MaybeRecord | undefined, uid: string): MaybeRecord {
  return {
    id: uid,
    name: DELETED_USER_NAME,
    initials: DELETED_USER_INITIALS,
    avatarColor: DELETED_USER_COLOR,
    role: typeof participant?.role === 'string' ? participant.role : 'student',
  }
}

export function isAnonymizedChatParticipant(participant: MaybeRecord | undefined): boolean {
  return participant?.name === DELETED_USER_NAME && !('photoUrl' in participant)
}

/** Review of a deleted student: keeps rating and comment, drops identity. Returns null when nothing to change. */
export function anonymizeReviewItem(review: MaybeRecord, uid: string): MaybeRecord | null {
  if (review.authorId !== uid) return null
  const { authorId: _authorId, authorPhotoUrl: _photo, ...rest } = review
  return { ...rest, author: DELETED_USER_NAME, authorInitials: DELETED_USER_INITIALS, authorColor: DELETED_USER_COLOR }
}

/** Display-only fields on a retained lesson that identify the deleted user. Returns null when the lesson is already clean. */
export function lessonAnonymizationPatch(lesson: MaybeRecord, uid: string): MaybeRecord | null {
  const patch: MaybeRecord = {}
  if (lesson.teacherId === uid) {
    if (lesson.teacherName !== DELETED_USER_NAME) patch.teacherName = DELETED_USER_NAME
    if (lesson.teacherInitials !== DELETED_USER_INITIALS) patch.teacherInitials = DELETED_USER_INITIALS
    if ('teacherPhotoUrl' in lesson) patch.teacherPhotoUrl = null
  }
  if (lesson.studentId === uid) {
    if (lesson.studentName !== DELETED_USER_NAME) patch.studentName = DELETED_USER_NAME
  }
  if (lesson.payerId === uid && 'payerName' in lesson && lesson.payerName !== DELETED_USER_NAME) patch.payerName = DELETED_USER_NAME
  return Object.keys(patch).length > 0 ? patch : null
}

/** The only thing left in users/{uid} after finalization — no name, e-mail, photo, preferences or links. */
export function deletedUserTombstone(input: { role: UserRole; now: number; requestId: string }): MaybeRecord {
  return {
    role: input.role,
    accountStatus: 'deleted',
    name: DELETED_USER_NAME,
    firstName: DELETED_USER_NAME,
    initials: DELETED_USER_INITIALS,
    avatarColor: DELETED_USER_COLOR,
    deletedAt: input.now,
    accountDeletionRequestId: input.requestId,
  }
}

/** Audit entries must not carry personal data — only ids, step names and counters. */
export function sanitizeFinalizationAuditNote(note: string): string {
  return note.replace(/[\w.+-]+@[\w-]+\.[\w.-]+/g, '[e-mail]').slice(0, 1200)
}
