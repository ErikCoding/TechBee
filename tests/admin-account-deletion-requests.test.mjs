import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

test('admin account deletion requests routes are admin-only and do not call Stripe', () => {
  const listRoute = readFileSync(new URL('../app/api/admin/account-deletion-requests/route.ts', import.meta.url), 'utf8')
  const actionRoute = readFileSync(new URL('../app/api/admin/account-deletion-requests/[requestId]/route.ts', import.meta.url), 'utf8')

  assert.equal(listRoute.includes('requireAdminRequest'), true)
  assert.equal(actionRoute.includes('requireAdminRequest'), true)
  assert.equal(actionRoute.includes('buildAccountDeletionDependencySummary'), true)
  assert.equal(actionRoute.includes("action === 'deactivate_access'"), true)
  assert.equal(actionRoute.includes("accountStatus: 'deactivated'"), true)
  assert.equal(actionRoute.includes('updateUserDisabled(userId, true)'), true)
  assert.equal(actionRoute.includes('buildAccountDeletionDependencySummary(userId, role)'), true)
  assert.equal(actionRoute.includes("current.status === 'completed' || current.status === 'rejected'"), true)
  assert.equal(actionRoute.includes('sendAccountDeletionStatusEmail'), true)
  assert.equal(listRoute.includes('@/lib/stripe'), false)
  assert.equal(actionRoute.includes('@/lib/stripe'), false)
})

test('admin account deletion UI exposes review actions and manual-processing warning', () => {
  const panel = readFileSync(new URL('../components/admin/admin-account-deletion-requests-panel.tsx', import.meta.url), 'utf8')
  const nav = readFileSync(new URL('../components/admin/admin-nav-items.ts', import.meta.url), 'utf8')

  assert.equal(panel.includes('Rozpatrz żądanie'), true)
  assert.equal(panel.includes('Wymaga rozwiązania'), true)
  assert.equal(panel.includes('Zamknij dostęp'), true)
  assert.equal(panel.includes('Dostęp zamknięty'), true)
  assert.equal(panel.includes('Brak aktywnych zobowiązań'), true)
  assert.equal(panel.includes('Aktywne zobowiązania'), true)
  assert.equal(panel.includes('Wymagany przegląd'), true)
  assert.equal(panel.includes('Dane historyczne, nieblokujące dostępu'), true)
  assert.equal(panel.includes('Finalizacja zablokowana'), true)
  assert.equal(panel.includes('Finalizacja wymaga wdrożenia zweryfikowanego procesu'), true)
  assert.equal(panel.includes('Zamknij z uzasadnieniem'), true)
  assert.equal(panel.includes('Nie usuwa automatycznie Stripe ani danych rozliczeniowych'), true)
  assert.equal(nav.includes('/admin/account-deletion-requests'), true)
})

test('deactivated accounts are blocked by Firebase rules helpers', () => {
  const firestoreRules = readFileSync(new URL('../firestore.rules', import.meta.url), 'utf8')
  const storageRules = readFileSync(new URL('../storage.rules', import.meta.url), 'utf8')

  assert.equal(firestoreRules.includes("get('accountStatus', 'active') != 'deactivated'"), true)
  assert.equal(storageRules.includes("get('accountStatus', 'active') != 'deactivated'"), true)
})

test('access closure can be resumed idempotently when Firebase Auth was not disabled', () => {
  const route = readFileSync(new URL('../app/api/admin/account-deletion-requests/[requestId]/route.ts', import.meta.url), 'utf8')
  const panel = readFileSync(new URL('../components/admin/admin-account-deletion-requests-panel.tsx', import.meta.url), 'utf8')

  assert.equal(route.includes('resumeAccessClosure'), true)
  // resume must not depend on a fresh dependency scan and must only touch Auth when it is not disabled yet
  assert.ok(route.indexOf("requestData.status === 'access_closed'") < route.indexOf('await buildAccountDeletionDependencySummary'))
  assert.equal(route.includes('wasDisabled'), true)
  // one stable email event per request, independent of the admin's reason text
  assert.equal(route.includes('account-deletion:${requestId}:access_closed'), true)
  // status can't regress after the access was closed
  assert.equal(route.includes("action === 'review' || action === 'mark_needs_resolution'"), true)
  assert.equal(panel.includes('Wznów blokadę logowania'), true)
})
