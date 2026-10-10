'use client'

import { useEffect, useMemo, useState } from 'react'
import type React from 'react'
import { AlertTriangle, CheckCircle2, Clock3, Eye, Loader2, LockKeyhole, RefreshCw, ShieldAlert, Trash2, UserX, XCircle } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Dialog, DialogBody, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { EmptyState } from '@/components/ui/empty-state'
import { FormError } from '@/components/ui/form-error'
import { Input } from '@/components/ui/input'
import { StatusBadge, type StatusTone } from '@/components/ui/status-badge'
import { finalizeAdminAccountDeletion, listAdminAccountDeletionRequests, updateAdminAccountDeletionRequest } from '@/services/admin.service'
import {
  ACCOUNT_DELETION_FINALIZE_CONFIRMATION,
  ACCOUNT_DELETION_SCOPE,
  accountDeletionStatusDescription,
  accountDeletionStatusLabel,
  assessAccountDeletionDependencies,
  assessAccountFinalization,
} from '@/lib/account-deletion-core'
import { cn, roleLabelPl } from '@/lib/utils'
import type { AdminAccountDeletionRequestRow } from '@/lib/types'

type Filter = 'open' | 'pending_review' | 'needs_resolution' | 'access_closed' | 'finalizing' | 'completed' | 'rejected' | 'all'
type Action = 'review' | 'mark_needs_resolution' | 'deactivate_access' | 'reject'

const statusConfig: Record<AdminAccountDeletionRequestRow['status'], { label: string; tone: StatusTone; icon: React.ElementType }> = {
  pending_review: { label: accountDeletionStatusLabel('pending_review'), tone: 'warning', icon: Clock3 },
  needs_resolution: { label: accountDeletionStatusLabel('needs_resolution'), tone: 'error', icon: AlertTriangle },
  access_closed: { label: accountDeletionStatusLabel('access_closed'), tone: 'neutral', icon: LockKeyhole },
  finalizing: { label: accountDeletionStatusLabel('finalizing'), tone: 'info', icon: Loader2 },
  completed: { label: accountDeletionStatusLabel('completed'), tone: 'success', icon: CheckCircle2 },
  rejected: { label: accountDeletionStatusLabel('rejected'), tone: 'neutral', icon: XCircle },
}

const actionLabels: Record<Action, string> = {
  review: 'Rozpatrz żądanie',
  mark_needs_resolution: 'Oznacz jako wymagające rozwiązania zobowiązań',
  deactivate_access: 'Zamknij dostęp do konta (bez usuwania danych)',
  reject: 'Zamknij żądanie bez usuwania konta',
}

const actionDescriptions: Record<Action, string> = {
  review: 'Zapisuje decyzję w historii. Konto i dane pozostają bez zmian.',
  mark_needs_resolution: 'Zapisuje, że przed usunięciem trzeba rozwiązać zobowiązania. Konto i dane pozostają bez zmian.',
  deactivate_access: 'Blokuje logowanie do konta. NIE usuwa żadnych danych — do ich usunięcia służy osobna akcja „Usuń konto trwale”.',
  reject: 'Zamyka żądanie bez usuwania konta. Konto pozostaje aktywne.',
}

function formatDate(ts: number) {
  if (!ts) return 'Brak daty'
  return new Intl.DateTimeFormat('pl-PL', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(ts))
}

function dependencyRows(request: AdminAccountDeletionRequestRow) {
  const d = request.dependencySummary
  return [
    ['Aktywne lekcje', d.activeLessons],
    ['Aktywne pakiety / kredyty', d.activePackages],
    ['Nierozliczone raporty', d.pendingReports],
    ['Oczekujące wypłaty', d.pendingPayouts],
    ['Otwarte spory', d.openDisputes ?? 0],
    ['Powiązania rodzic-uczeń', d.familyLinks],
    ['Konwersacje', d.conversations],
    ['Profil nauczyciela', d.publicTeacherProfile ? 'historyczny' : 'brak'],
    ['Stripe Connect', d.stripeConnectReviewRequired ? 'nie usuwać automatycznie' : 'brak blokady'],
    ['Skan zależności', d.scanComplete === false ? 'niepełny' : 'pełny'],
  ] as const
}

function AssessmentBox({ request }: { request: AdminAccountDeletionRequestRow }) {
  const assessment = assessAccountDeletionDependencies(request.dependencySummary)
  const toneClass = assessment.status === 'clear'
    ? 'border-success/30 bg-success-surface text-success-on-surface'
    : assessment.status === 'blocking'
      ? 'border-destructive/30 bg-destructive/10 text-destructive'
      : 'border-border bg-muted text-muted-foreground'
  const title = assessment.status === 'clear'
    ? 'Brak aktywnych zobowiązań'
    : assessment.status === 'blocking'
      ? 'Aktywne zobowiązania'
      : 'Wymagany przegląd'
  const reasons = assessment.status === 'clear'
    ? ['Wszystkie automatyczne kontrole zakończyły się poprawnie.']
    : [...assessment.blockingReasons, ...assessment.reviewReasons]
  return (
    <div className={cn('rounded-xl border p-3 text-xs', toneClass)}>
      <p className="font-semibold">{title}</p>
      <ul className="mt-2 space-y-1">
        {reasons.map((reason) => <li key={reason}>• {reason}</li>)}
      </ul>
      {assessment.historicalReasons.length > 0 && (
        <div className="mt-3 border-t border-current/20 pt-2">
          <p className="font-medium">Dane historyczne, nieblokujące dostępu:</p>
          <ul className="mt-1 space-y-1">
            {assessment.historicalReasons.map((reason) => <li key={reason}>• {reason}</li>)}
          </ul>
        </div>
      )}
    </div>
  )
}

export function AdminAccountDeletionRequestsPanel() {
  const [requests, setRequests] = useState<AdminAccountDeletionRequestRow[] | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [filter, setFilter] = useState<Filter>('open')
  const [query, setQuery] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [actionDialog, setActionDialog] = useState<{ request: AdminAccountDeletionRequestRow; action: Action } | null>(null)
  const [reason, setReason] = useState('')
  const [finalizeDialog, setFinalizeDialog] = useState<AdminAccountDeletionRequestRow | null>(null)
  const [finalizeConfirmation, setFinalizeConfirmation] = useState('')
  const [finalizeUserId, setFinalizeUserId] = useState('')
  const [stripeAck, setStripeAck] = useState(false)

  async function load() {
    setError(null)
    try {
      const data = await listAdminAccountDeletionRequests()
      setRequests(data.requests)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Nie udało się pobrać żądań.')
      setRequests([])
    }
  }

  useEffect(() => {
    void load()
  }, [])

  const counts = useMemo(() => {
    const list = requests ?? []
    return {
      open: list.filter((item) => item.status === 'pending_review' || item.status === 'needs_resolution' || item.status === 'access_closed' || item.status === 'finalizing').length,
      pending_review: list.filter((item) => item.status === 'pending_review').length,
      needs_resolution: list.filter((item) => item.status === 'needs_resolution').length,
      access_closed: list.filter((item) => item.status === 'access_closed').length,
      finalizing: list.filter((item) => item.status === 'finalizing').length,
      completed: list.filter((item) => item.status === 'completed').length,
      rejected: list.filter((item) => item.status === 'rejected').length,
      all: list.length,
    }
  }, [requests])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return (requests ?? [])
      .filter((request) => {
        if (filter === 'open') return request.status === 'pending_review' || request.status === 'needs_resolution' || request.status === 'access_closed' || request.status === 'finalizing'
        if (filter === 'all') return true
        return request.status === filter
      })
      .filter((request) => {
        if (!q) return true
        return [request.userName, request.userEmail, request.userId, request.adminNote ?? '', request.rejectionReason ?? '']
          .some((value) => value.toLowerCase().includes(q))
      })
  }, [requests, filter, query])

  async function runAction() {
    if (!actionDialog) return
    setBusyId(actionDialog.request.id)
    setError(null)
    try {
      await updateAdminAccountDeletionRequest(actionDialog.request.id, actionDialog.action, reason)
      setActionDialog(null)
      setReason('')
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Nie udało się zaktualizować żądania.')
    } finally {
      setBusyId(null)
    }
  }

  function openFinalize(request: AdminAccountDeletionRequestRow) {
    setFinalizeDialog(request)
    setFinalizeConfirmation('')
    setFinalizeUserId('')
    setStripeAck(false)
    setError(null)
  }

  async function runFinalize() {
    if (!finalizeDialog) return
    setBusyId(finalizeDialog.id)
    setError(null)
    try {
      await finalizeAdminAccountDeletion(finalizeDialog.id, {
        confirmation: finalizeConfirmation,
        confirmUserId: finalizeUserId.trim(),
        stripeConnectAcknowledged: stripeAck,
      })
      setFinalizeDialog(null)
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Nie udało się usunąć konta.')
      await load()
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-2xl border border-border bg-card p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <UserX className="h-5 w-5 text-primary" aria-hidden="true" />
              <h2 className="text-base font-semibold text-foreground">Żądania użytkowników</h2>
              {counts.open > 0 && <Badge>{counts.open} otwartych</Badge>}
            </div>
            <p className="mt-1 text-sm text-muted-foreground">Zamknięcie dostępu tylko blokuje logowanie. Dane znikają dopiero po akcji „Usuń konto trwale”, która jest nieodwracalna i zawsze wymaga osobnego potwierdzenia.</p>
          </div>
          <Button type="button" variant="outline" size="sm" onClick={load} disabled={!requests}>
            <RefreshCw className="h-3.5 w-3.5" />
            Odśwież
          </Button>
        </div>

        <div className="mt-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="relative lg:w-80">
            <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Szukaj po e-mailu, nazwie lub UID..." />
          </div>
          <div className="flex flex-wrap gap-1.5">
            {([
              { key: 'open', label: 'Otwarte' },
              { key: 'pending_review', label: 'Oczekujące' },
              { key: 'needs_resolution', label: 'Wymaga rozwiązania' },
              { key: 'access_closed', label: 'Dostęp zamknięty' },
              { key: 'finalizing', label: 'Finalizacja w toku' },
              { key: 'completed', label: 'Konto usunięte' },
              { key: 'rejected', label: 'Odrzucone' },
              { key: 'all', label: 'Wszystkie' },
            ] as const).map((item) => (
              <button
                key={item.key}
                type="button"
                onClick={() => setFilter(item.key)}
                className={cn(
                  'rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors',
                  filter === item.key ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-muted/70',
                )}
              >
                {item.label} <span className="opacity-70">({counts[item.key]})</span>
              </button>
            ))}
          </div>
        </div>
        <FormError className="mt-3">{error}</FormError>
      </div>

      {requests === null ? (
        <div className="h-56 animate-pulse rounded-2xl border border-border bg-card" />
      ) : filtered.length === 0 ? (
        <EmptyState icon={UserX} title="Brak żądań" description="Nie ma żądań pasujących do aktualnego filtra." className="rounded-2xl border border-border bg-card py-14" />
      ) : (
        <div className="flex flex-col divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card">
          {filtered.map((request) => {
            const selected = selectedId === request.id
            const status = statusConfig[request.status]
            const StatusIcon = status.icon
            const busy = busyId === request.id
            const terminal = request.status === 'completed' || request.status === 'rejected'
            const locked = terminal || request.status === 'finalizing'
            const canResume = request.status === 'finalizing'
            const hardBlockers = terminal || canResume ? [] : assessAccountFinalization({
              summary: request.dependencySummary,
              role: request.role,
              requestStatus: request.status,
              userId: request.userId,
              adminId: '',
              stripeConnectAcknowledged: true,
            }).blockers
            const accessClosed = request.status === 'access_closed' || request.accountStatus === 'deactivated' || request.authDisabled
            // Closure recorded in Firestore but Firebase Auth login still enabled → can be resumed (idempotent).
            const needsAuthResume = !terminal && (request.status === 'access_closed' || request.accountStatus === 'deactivated') && !request.authDisabled
            const assessment = assessAccountDeletionDependencies(request.dependencySummary)
            return (
              <article key={request.id} className={cn(request.status === 'needs_resolution' && 'bg-destructive/5')}>
                <button type="button" onClick={() => setSelectedId(selected ? null : request.id)} className="flex w-full flex-col gap-3 p-4 text-left lg:flex-row lg:items-center lg:justify-between">
                  <div className="flex min-w-0 items-start gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-muted text-muted-foreground">
                      <StatusIcon className="h-4 w-4" aria-hidden="true" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-semibold text-foreground">{request.userName}</p>
                        <StatusBadge tone={status.tone} dot={false} className="px-2 py-0.5 text-[10px]">{status.label}</StatusBadge>
                        {request.hasDependencies && <Badge variant="outline">blokady</Badge>}
                      </div>
                      <p className="mt-0.5 text-xs text-muted-foreground">{request.userEmail} · {roleLabelPl(request.role)}</p>
                      <p className="mt-1 text-xs text-muted-foreground">{accountDeletionStatusDescription(request.status)}</p>
                      <p className="mt-1 text-xs text-muted-foreground">Żądanie: {formatDate(request.requestedAt)} · Aktualizacja: {formatDate(request.updatedAt)}</p>
                    </div>
                  </div>
                  <span className="inline-flex items-center gap-1 text-xs font-semibold text-primary">
                    <Eye className="h-3.5 w-3.5" />
                    {selected ? 'Zwiń szczegóły' : 'Szczegóły'}
                  </span>
                </button>

                {selected && (
                  <div className="border-t border-border bg-muted/25 p-4">
                    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_260px]">
                      <div className="space-y-4">
                        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                          {dependencyRows(request).map(([label, value]) => (
                            <div key={label} className="rounded-xl border border-border bg-card p-3">
                              <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
                              <p className="mt-1 text-sm font-semibold text-foreground">{String(value)}</p>
                            </div>
                          ))}
                        </div>
                        <div className="rounded-xl border border-border bg-card p-4">
                          <h3 className="text-sm font-semibold text-foreground">Historia działań administratora</h3>
                          <div className="mt-3 space-y-2">
                            {request.history.map((entry, index) => (
                              <div key={`${entry.createdAt}-${index}`} className="rounded-lg border border-border bg-background/45 p-3 text-xs">
                                <p className="font-semibold text-foreground">{entry.action} · {entry.actorRole}</p>
                                <p className="mt-1 text-muted-foreground">{formatDate(entry.createdAt)} · {entry.actorId}</p>
                                {entry.note && <p className="mt-2 whitespace-pre-line text-muted-foreground">{entry.note}</p>}
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                      <div className="flex flex-col gap-2">
                        <AssessmentBox request={request} />
                        <div className="rounded-xl border border-border bg-card p-3 text-xs text-muted-foreground">
                          <p><span className="font-medium text-foreground">UID: </span>{request.userId}</p>
                          <p className="mt-1"><span className="font-medium text-foreground">Konto: </span>{request.accountStatus === 'deleted' ? 'usunięte' : request.accountStatus === 'deactivated' || request.authDisabled ? 'zablokowane (dane istnieją)' : 'aktywne'}</p>
                          {request.finalization && (
                            <p className="mt-1"><span className="font-medium text-foreground">Usuwanie: </span>{request.finalization.completedSteps.length}/{request.finalization.totalSteps} kroków{request.finalization.lastErrorStep ? ` · błąd w kroku „${request.finalization.lastErrorStep}”` : ''}</p>
                          )}
                          <p className="mt-2 flex gap-1.5 leading-relaxed">
                            <ShieldAlert className="mt-0.5 h-3.5 w-3.5 shrink-0 text-warning-on-surface" />
                            Dokumentacja płatności, wypłat i lekcji jest zachowywana (bez imienia usuniętego użytkownika). Runbee nie wykonuje żadnych operacji w Stripe podczas usuwania.
                          </p>
                        </div>
                        <Button size="sm" variant="outline" disabled={busy || locked || request.status === 'access_closed'} onClick={() => setActionDialog({ request, action: 'review' })}>
                          {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
                          Rozpatrz żądanie
                        </Button>
                        <Button size="sm" variant="outline" disabled={busy || locked || request.status === 'access_closed'} onClick={() => setActionDialog({ request, action: 'mark_needs_resolution' })}>
                          <AlertTriangle className="h-3.5 w-3.5" />
                          Wymaga rozwiązania
                        </Button>
                        {needsAuthResume ? (
                          <Button size="sm" variant="destructive" disabled={busy} onClick={() => setActionDialog({ request, action: 'deactivate_access' })}>
                            <LockKeyhole className="h-3.5 w-3.5" />
                            Wznów blokadę logowania
                          </Button>
                        ) : (
                          <Button size="sm" variant="outline" disabled={busy || locked || accessClosed || !assessment.canCloseAccess} onClick={() => setActionDialog({ request, action: 'deactivate_access' })}>
                            <LockKeyhole className="h-3.5 w-3.5" />
                            Zamknij dostęp (nie usuwa danych)
                          </Button>
                        )}
                        {!terminal && (
                          <>
                            <Button
                              size="sm"
                              variant="destructive"
                              disabled={busy || hardBlockers.length > 0}
                              onClick={() => openFinalize(request)}
                            >
                              {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                              {canResume ? 'Wznów usuwanie konta' : 'Usuń konto trwale…'}
                            </Button>
                            {hardBlockers.length > 0 && (
                              <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive">
                                <p className="font-semibold">Usunięcie niemożliwe, bo:</p>
                                <ul className="mt-1 space-y-1">{hardBlockers.map((blocker) => <li key={blocker}>• {blocker}</li>)}</ul>
                              </div>
                            )}
                          </>
                        )}
                        <Button size="sm" variant="outline" disabled={busy || locked} onClick={() => setActionDialog({ request, action: 'reject' })}>
                          <XCircle className="h-3.5 w-3.5" />
                          Zamknij bez usuwania konta
                        </Button>
                      </div>
                    </div>
                  </div>
                )}
              </article>
            )
          })}
        </div>
      )}

      <Dialog open={Boolean(actionDialog)} onOpenChange={(open) => { if (!open) { setActionDialog(null); setReason('') } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{actionDialog ? actionLabels[actionDialog.action] : 'Akcja'}</DialogTitle>
            <DialogDescription>
              {actionDialog ? actionDescriptions[actionDialog.action] : ''} Operacja zapisze historię administratora i może wysłać użytkownikowi e-mail o zmianie statusu. Nie usuwa automatycznie Stripe ani danych rozliczeniowych.
            </DialogDescription>
          </DialogHeader>
          <DialogBody>
            <div className="rounded-xl border border-border bg-muted/40 p-3 text-sm">
              <p className="font-semibold text-foreground">{actionDialog?.request.userName}</p>
              <p className="mt-1 text-xs text-muted-foreground">{actionDialog?.request.userEmail}</p>
            </div>
            <div className="flex flex-col gap-1.5">
              <label htmlFor="account-deletion-action-reason" className="text-xs font-medium text-foreground">Uzasadnienie / notatka</label>
              <textarea
                id="account-deletion-action-reason"
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                rows={5}
                className="min-h-28 rounded-xl border border-input bg-background px-3 py-2 text-sm text-foreground outline-none transition focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                placeholder="Opisz podstawę decyzji lub dalsze kroki..."
              />
            </div>
          </DialogBody>
          <DialogFooter className="justify-end">
            <Button type="button" variant="outline" onClick={() => { setActionDialog(null); setReason('') }}>Anuluj</Button>
            <Button
              type="button"
              variant={actionDialog?.action === 'reject' ? 'destructive' : 'default'}
              disabled={Boolean(actionDialog && actionDialog.action !== 'review' && !reason.trim())}
              onClick={runAction}
            >
              Zapisz decyzję
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={Boolean(finalizeDialog)} onOpenChange={(open) => { if (!open && !busyId) setFinalizeDialog(null) }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{finalizeDialog?.status === 'finalizing' ? 'Wznów usuwanie konta' : 'Usuń konto trwale'}</DialogTitle>
            <DialogDescription>
              Ta operacja jest nieodwracalna. Po jej zakończeniu użytkownik nie będzie mógł się zalogować, a jego dane osobowe zostaną usunięte lub zanonimizowane. Runbee nie wykonuje żadnych operacji w Stripe.
            </DialogDescription>
          </DialogHeader>
          <DialogBody>
            <div className="rounded-xl border border-border bg-muted/40 p-3 text-sm">
              <p className="font-semibold text-foreground">{finalizeDialog?.userName}</p>
              <p className="mt-1 text-xs text-muted-foreground">{finalizeDialog?.userEmail} · UID: {finalizeDialog?.userId}</p>
            </div>
            <div className="grid gap-3 text-xs sm:grid-cols-3">
              {([
                ['Zostanie usunięte', ACCOUNT_DELETION_SCOPE.deleted],
                ['Zostanie zanonimizowane', ACCOUNT_DELETION_SCOPE.anonymized],
                ['Zostanie zachowane', ACCOUNT_DELETION_SCOPE.retained],
              ] as const).map(([title, items]) => (
                <div key={title} className="rounded-xl border border-border bg-card p-3">
                  <p className="font-semibold text-foreground">{title}</p>
                  <ul className="mt-2 space-y-1 text-muted-foreground">{items.map((item) => <li key={item}>• {item}</li>)}</ul>
                </div>
              ))}
            </div>
            {finalizeDialog?.dependencySummary.stripeConnectReviewRequired && (
              <label className="flex items-start gap-2 rounded-xl border border-warning/40 bg-warning-surface p-3 text-xs text-warning-on-surface">
                <input type="checkbox" className="mt-0.5" checked={stripeAck} onChange={(event) => setStripeAck(event.target.checked)} />
                <span>Sprawdziłem(-am) w panelu Stripe saldo i status konta Connect tego nauczyciela. Runbee niczego w Stripe nie zamknie ani nie wypłaci.</span>
              </label>
            )}
            <div className="flex flex-col gap-1.5">
              <label htmlFor="finalize-user-id" className="text-xs font-medium text-foreground">Przepisz UID użytkownika</label>
              <Input id="finalize-user-id" value={finalizeUserId} onChange={(event) => setFinalizeUserId(event.target.value)} autoComplete="off" />
            </div>
            <div className="flex flex-col gap-1.5">
              <label htmlFor="finalize-confirmation" className="text-xs font-medium text-foreground">Wpisz: {ACCOUNT_DELETION_FINALIZE_CONFIRMATION}</label>
              <Input id="finalize-confirmation" value={finalizeConfirmation} onChange={(event) => setFinalizeConfirmation(event.target.value)} autoComplete="off" />
            </div>
            <FormError>{error}</FormError>
          </DialogBody>
          <DialogFooter className="justify-end">
            <Button type="button" variant="outline" disabled={Boolean(busyId)} onClick={() => setFinalizeDialog(null)}>Anuluj</Button>
            <Button
              type="button"
              variant="destructive"
              disabled={
                Boolean(busyId)
                || finalizeConfirmation.trim() !== ACCOUNT_DELETION_FINALIZE_CONFIRMATION
                || finalizeUserId.trim() !== finalizeDialog?.userId
                || Boolean(finalizeDialog?.dependencySummary.stripeConnectReviewRequired && !stripeAck)
              }
              onClick={runFinalize}
            >
              {busyId ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
              {finalizeDialog?.status === 'finalizing' ? 'Wznów usuwanie' : 'Usuń konto trwale'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
