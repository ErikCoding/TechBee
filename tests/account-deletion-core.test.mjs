import assert from 'node:assert/strict'
import test from 'node:test'
import {
  ACCOUNT_DELETION_CONFIRMATION,
  assessAccountDeletionDependencies,
  buildAccountDeletionAdminPatch,
  canRequestSelfServiceAccountDeletion,
  deletionRequestHasDependencies,
  isValidDeletionConfirmation,
} from '../lib/account-deletion-core.ts'

test('self-service account deletion is not allowed for admin role', () => {
  assert.equal(canRequestSelfServiceAccountDeletion('student'), true)
  assert.equal(canRequestSelfServiceAccountDeletion('teacher'), true)
  assert.equal(canRequestSelfServiceAccountDeletion('parent'), true)
  assert.equal(canRequestSelfServiceAccountDeletion('admin'), false)
  assert.equal(canRequestSelfServiceAccountDeletion(undefined), false)
})

test('account deletion confirmation requires exact phrase', () => {
  assert.equal(isValidDeletionConfirmation(ACCOUNT_DELETION_CONFIRMATION), true)
  assert.equal(isValidDeletionConfirmation('usun konto'), false)
  assert.equal(isValidDeletionConfirmation('USUN KONTO'), false)
})

test('account deletion dependencies force admin review', () => {
  const clear = {
    activeLessons: 0,
    activePackages: 0,
    pendingReports: 0,
    pendingPayouts: 0,
    openDisputes: 0,
    familyLinks: 0,
    publicTeacherProfile: false,
    conversations: 0,
    stripeConnectReviewRequired: false,
    scanComplete: true,
  }

  assert.equal(deletionRequestHasDependencies(clear), false)
  assert.equal(deletionRequestHasDependencies({ ...clear, activePackages: 1 }), true)
  assert.equal(deletionRequestHasDependencies({ ...clear, stripeConnectReviewRequired: true }), true)
  assert.equal(deletionRequestHasDependencies({ ...clear, conversations: 3 }), false)
  assert.equal(deletionRequestHasDependencies({ ...clear, publicTeacherProfile: true }), false)
  assert.equal(assessAccountDeletionDependencies({ ...clear, scanComplete: false }).status, 'review_required')
  assert.equal(assessAccountDeletionDependencies({ ...clear, activeLessons: 1 }).status, 'blocking')
})

test('admin account deletion decisions always block completion until finalization process exists', () => {
  const dependencySummary = {
    activeLessons: 0,
    activePackages: 0,
    pendingReports: 0,
    pendingPayouts: 0,
    openDisputes: 0,
    familyLinks: 0,
    publicTeacherProfile: false,
    conversations: 0,
    stripeConnectReviewRequired: false,
    scanComplete: true,
  }

  const result = buildAccountDeletionAdminPatch({
    decision: { action: 'complete', reason: 'Manual work complete' },
    adminId: 'admin-1',
    now: 123,
    dependencySummary,
  })

  assert.equal(result.ok, false)
  assert.equal(result.status, 409)
})

test('admin account deletion can close access only when there are no dependencies', () => {
  const clear = {
    activeLessons: 0,
    activePackages: 0,
    pendingReports: 0,
    pendingPayouts: 0,
    openDisputes: 0,
    familyLinks: 0,
    publicTeacherProfile: false,
    conversations: 0,
    stripeConnectReviewRequired: false,
    scanComplete: true,
  }

  const closed = buildAccountDeletionAdminPatch({
    decision: { action: 'deactivate_access', reason: 'No active obligations remain; closing account access.' },
    adminId: 'admin-1',
    now: 789,
    dependencySummary: clear,
  })

  assert.equal(closed.ok, true)
  assert.equal(closed.patch.status, 'access_closed')

  const historicalOnly = buildAccountDeletionAdminPatch({
    decision: { action: 'deactivate_access', reason: 'Only historical records remain.' },
    adminId: 'admin-1',
    now: 789,
    dependencySummary: { ...clear, conversations: 4, publicTeacherProfile: true },
  })

  assert.equal(historicalOnly.ok, true)
  assert.equal(historicalOnly.patch.status, 'access_closed')

  const blocked = buildAccountDeletionAdminPatch({
    decision: { action: 'deactivate_access', reason: 'Try to close access.' },
    adminId: 'admin-1',
    now: 790,
    dependencySummary: { ...clear, activeLessons: 1 },
  })

  assert.equal(blocked.ok, false)
  assert.equal(blocked.status, 409)

  const incomplete = buildAccountDeletionAdminPatch({
    decision: { action: 'deactivate_access', reason: 'Try with incomplete scan.' },
    adminId: 'admin-1',
    now: 791,
    dependencySummary: { ...clear, scanComplete: false, scanErrors: ['active lessons'] },
  })

  assert.equal(incomplete.ok, false)
  assert.equal(incomplete.status, 409)
})

test('admin account deletion decisions require reasons for terminal or blocking states', () => {
  const dependencySummary = {
    activeLessons: 0,
    activePackages: 0,
    pendingReports: 0,
    pendingPayouts: 0,
    openDisputes: 0,
    familyLinks: 0,
    publicTeacherProfile: false,
    conversations: 0,
    stripeConnectReviewRequired: false,
    scanComplete: true,
  }

  assert.equal(buildAccountDeletionAdminPatch({
    decision: { action: 'reject' },
    adminId: 'admin-1',
    now: 123,
    dependencySummary,
  }).ok, false)

  const completed = buildAccountDeletionAdminPatch({
    decision: { action: 'complete', reason: 'Manual anonymization completed under approved policy.' },
    adminId: 'admin-1',
    now: 456,
    dependencySummary,
  })

  assert.equal(completed.ok, false)
  assert.equal(completed.status, 409)
})
