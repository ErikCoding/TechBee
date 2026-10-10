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

export type AccountDeletionRequestStatus = 'pending_review' | 'needs_resolution' | 'access_closed' | 'completed' | 'rejected'
export type AccountDeletionAdminAction = 'review' | 'mark_needs_resolution' | 'deactivate_access' | 'complete' | 'reject'

export type AccountDeletionHistoryEntry = {
  action: AccountDeletionAdminAction | 'requested'
  actorId: string
  actorRole: 'user' | 'admin' | 'system'
  note?: string
  createdAt: number
}

export const ACCOUNT_DELETION_CONFIRMATION = 'USUŃ KONTO'

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
  if (status === 'pending_review') return 'Oczekujące'
  if (status === 'needs_resolution') return 'Wymaga działania'
  if (status === 'access_closed') return 'Dostęp zamknięty'
  if (status === 'completed') return 'Finalizacja potwierdzona'
  return 'Odrzucone'
}

export function normalizeAccountDeletionAdminAction(value: unknown): AccountDeletionAdminAction | null {
  return value === 'review'
    || value === 'mark_needs_resolution'
    || value === 'deactivate_access'
    || value === 'complete'
    || value === 'reject'
    ? value
    : null
}

export function accountDeletionActionRequiresReason(action: AccountDeletionAdminAction): boolean {
  return action === 'mark_needs_resolution' || action === 'deactivate_access' || action === 'complete' || action === 'reject'
}

export function canCompleteAccountDeletionRequest(summary: AccountDeletionDependencySummary): boolean {
  return false
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
    return {
      ok: false,
      error: 'Finalizacja żądania jest zablokowana do czasu wdrożenia zweryfikowanego procesu usunięcia lub anonimizacji danych.',
      status: 409,
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
      subject: 'Żądanie usunięcia konta Runbee zostało zrealizowane',
      title: 'Żądanie zostało zrealizowane',
      body: `Status Twojego żądania usunięcia konta: ${label}.${note ? `\n\nInformacja od administratora: ${note}` : ''}`,
    }
  }
  if (status === 'access_closed') {
    return {
      subject: 'Dostęp do konta Runbee został zamknięty',
      title: 'Dostęp do konta został zamknięty',
      body: `Status Twojego żądania usunięcia konta: ${label}.\n\nLogowanie do konta zostało zablokowane, ale finalne usunięcie lub anonimizacja danych wymaga dalszej obsługi zgodnie z obowiązującą polityką retencji.${note ? `\n\nInformacja od administratora: ${note}` : ''}`,
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
