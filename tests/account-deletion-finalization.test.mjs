import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import {
  ACCOUNT_DELETION_FINALIZE_CONFIRMATION,
  ACCOUNT_DELETION_SCOPE,
  ACCOUNT_FINALIZATION_STEPS,
  DELETED_USER_NAME,
  FINALIZATION_LOCK_STALE_MS,
  accountDeletionStatusDescription,
  accountDeletionStatusEmailText,
  accountDeletionStatusLabel,
  anonymizeReviewItem,
  anonymizedChatParticipant,
  assessAccountFinalization,
  canStartAccountFinalizationFrom,
  deletedUserTombstone,
  executeAccountFinalization,
  finalizationLockIsActive,
  isAnonymizedChatParticipant,
  isRequestLockedByFinalization,
  lessonAnonymizationPatch,
  remainingFinalizationSteps,
  sanitizeFinalizationAuditNote,
} from '../lib/account-deletion-core.ts'

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')

const clean = {
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
const assess = (over = {}, input = {}) => assessAccountFinalization({
  summary: { ...clean, ...over },
  role: 'student',
  requestStatus: 'access_closed',
  userId: 'u1',
  adminId: 'admin1',
  ...input,
})

// ── Scenario: the empty student account from the bug report ──
test('empty student account (0 lessons/packages/reports/payouts/disputes/chats, full scan) CAN be finalized', () => {
  const result = assess()
  assert.equal(result.allowed, true)
  assert.deepEqual(result.blockers, [])
  // from the status the admin saw in the bug report, and from the ones before it
  for (const status of ['pending_review', 'needs_resolution', 'access_closed']) {
    assert.equal(assess({}, { requestStatus: status }).allowed, true, status)
  }
})

// ── Scenario: active lesson & other open obligations ──
test('active obligations block finalization, each with a reason shown to the admin', () => {
  for (const [field, text] of [
    ['activeLessons', 'lekcje'],
    ['activePackages', 'pakiety'],
    ['pendingReports', 'raporty'],
    ['pendingPayouts', 'wypłaty'],
    ['openDisputes', 'spory'],
  ]) {
    const result = assess({ [field]: 1 })
    assert.equal(result.allowed, false, field)
    assert.ok(result.blockers.some((b) => b.toLowerCase().includes(text)), `${field}: ${result.blockers}`)
  }
})

test('an incomplete dependency scan never allows an irreversible action', () => {
  assert.equal(assess({ scanComplete: false }).allowed, false)
  assert.equal(assess({ scanErrors: ['conversations'] }).allowed, false)
})

// ── Scenario: account with finance history ──
test('financial history alone does not block: it is retained, only the display name is removed', () => {
  assert.equal(assess({ paymentRecordsReviewRequired: true }).allowed, true)
  const lesson = {
    studentId: 'u1', teacherId: 't1', payerId: 'u1',
    studentName: 'Jan Kowalski', teacherName: 'Anna Nowak', teacherInitials: 'AN', teacherPhotoUrl: 'https://x/y.png',
    priceGrosze: 12000, paymentStatus: 'paid', stripeChargeId: 'ch_1', stripeTransferId: 'tr_1', platformFeeGrosze: 360, topic: 'Całki',
  }
  const patch = lessonAnonymizationPatch(lesson, 'u1')
  assert.deepEqual(patch, { studentName: DELETED_USER_NAME })
  // financial fields are never part of any patch, for any role of the deleted user
  const teacherPatch = lessonAnonymizationPatch(lesson, 't1')
  assert.deepEqual(Object.keys(teacherPatch).sort(), ['teacherInitials', 'teacherName', 'teacherPhotoUrl'])
  for (const key of ['priceGrosze', 'paymentStatus', 'stripeChargeId', 'stripeTransferId', 'platformFeeGrosze']) {
    assert.equal(key in patch || key in teacherPatch, false, key)
  }
  // idempotent
  assert.equal(lessonAnonymizationPatch({ ...lesson, studentName: DELETED_USER_NAME }, 'u1'), null)
  // someone else's lesson is untouched
  assert.equal(lessonAnonymizationPatch(lesson, 'stranger'), null)
})

// ── Scenario: teacher with Stripe Connect ──
test('teacher with Stripe Connect needs an explicit acknowledgement; Runbee never touches Stripe', () => {
  const blocked = assess({ stripeConnectReviewRequired: true, publicTeacherProfile: true }, { role: 'teacher' })
  assert.equal(blocked.allowed, false)
  assert.ok(blocked.blockers.some((b) => b.includes('Stripe Connect')))
  const acked = assess({ stripeConnectReviewRequired: true, publicTeacherProfile: true }, { role: 'teacher', stripeConnectAcknowledged: true })
  assert.equal(acked.allowed, true)
  assert.ok(acked.warnings.some((w) => w.includes('Stripe Connect')))
  // but a Connect teacher with a pending payout stays blocked even when acknowledged
  assert.equal(assess({ stripeConnectReviewRequired: true, pendingPayouts: 1 }, { role: 'teacher', stripeConnectAcknowledged: true }).allowed, false)
  // static: nothing in the deletion code calls Stripe
  for (const file of [
    'lib/account-deletion-finalize.server.ts',
    'lib/account-deletion-core.ts',
    'app/api/admin/account-deletion-requests/[requestId]/finalize/route.ts',
  ]) {
    assert.doesNotMatch(read(file), /from ['"](@\/lib\/stripe|stripe)['"]|stripe\.(accounts|transfers|payouts|refunds)/i, file)
  }
})

// ── Scenario: administrator accounts ──
test('administrator accounts and self-deletion are always refused', () => {
  assert.equal(assess({}, { role: 'admin' }).allowed, false)
  assert.equal(assess({}, { userId: 'admin1', adminId: 'admin1' }).allowed, false)
  assert.equal(assess({}, { role: undefined }).allowed, false)
  assert.equal(assess({}, { requestStatus: 'rejected' }).allowed, false)
  assert.equal(assess({}, { requestStatus: 'completed' }).allowed, false)
  // and the route enforces it independently of the UI
  const route = read('app/api/admin/account-deletion-requests/[requestId]/finalize/route.ts')
  assert.match(route, /role === 'admin' \|\| profile\.role === 'admin'/)
  assert.match(route, /userId === admin\.uid/)
})

// ── Scenario: partial failure and retry ──
test('a failed step stops the run; the retry resumes exactly there and never repeats finished steps', async () => {
  const executed = []
  const persisted = []
  let failChat = true
  const run = async (step) => {
    if (step === 'chat' && failChat) throw new Error('boom')
    executed.push(step)
  }
  const onStepDone = async (step) => { persisted.push(step) }

  const first = await executeAccountFinalization({ completedSteps: [], run, onStepDone })
  assert.deepEqual(first, { ok: false, failedStep: 'chat' })
  assert.deepEqual(persisted, ['close_access', 'notifications', 'points_and_wallet', 'family_links'])
  // identity is untouched until the very end
  assert.equal(executed.includes('auth_user'), false)
  assert.equal(executed.includes('user_tombstone'), false)

  failChat = false
  executed.length = 0
  const second = await executeAccountFinalization({ completedSteps: persisted, run, onStepDone })
  assert.deepEqual(second, { ok: true })
  assert.equal(executed[0], 'chat')
  for (const done of ['close_access', 'notifications', 'points_and_wallet', 'family_links']) assert.equal(executed.includes(done), false, done)
  assert.deepEqual([...persisted], [...ACCOUNT_FINALIZATION_STEPS])

  // a third call after success has nothing left to do
  executed.length = 0
  assert.deepEqual(await executeAccountFinalization({ completedSteps: persisted, run, onStepDone }), { ok: true })
  assert.deepEqual(executed, [])
})

test('failure in the last step (Auth deletion) leaves the account disabled data-wise erased, and is resumable', async () => {
  const done = ACCOUNT_FINALIZATION_STEPS.filter((s) => s !== 'auth_user')
  const result = await executeAccountFinalization({ completedSteps: done, run: async () => { throw new Error('auth down') }, onStepDone: async () => {} })
  assert.deepEqual(result, { ok: false, failedStep: 'auth_user' })
  assert.deepEqual(remainingFinalizationSteps(done), ['auth_user'])
})

test('step order protects identity: access is closed first, Auth user is deleted last, tombstone before it', () => {
  const steps = [...ACCOUNT_FINALIZATION_STEPS]
  assert.equal(steps[0], 'close_access')
  assert.equal(steps.at(-1), 'auth_user')
  assert.ok(steps.indexOf('notify_user') < steps.indexOf('user_tombstone'))
  assert.ok(steps.indexOf('user_tombstone') < steps.indexOf('auth_user'))
  // storage cleanup comes after chat anonymization (which needs the attachment paths)
  assert.ok(steps.indexOf('chat') < steps.indexOf('storage'))
  assert.equal(new Set(steps).size, steps.length)
})

test('finalization lock: fresh lock blocks a parallel run, a stale (crashed) lock can be taken over', () => {
  const now = 1_000_000
  assert.equal(finalizationLockIsActive({ state: 'in_progress', lockedAt: now - 1000 }, now), true)
  assert.equal(finalizationLockIsActive({ state: 'in_progress', lockedAt: now - FINALIZATION_LOCK_STALE_MS - 1 }, now), false)
  assert.equal(finalizationLockIsActive({ state: 'failed', lockedAt: now }, now), false)
  assert.equal(finalizationLockIsActive(undefined, now), false)
})

test('once finalization starts the request cannot be rejected, reviewed or re-opened', () => {
  assert.equal(isRequestLockedByFinalization('finalizing'), true)
  assert.equal(isRequestLockedByFinalization('completed'), true)
  assert.equal(isRequestLockedByFinalization('access_closed'), false)
  assert.equal(canStartAccountFinalizationFrom('finalizing'), true)
  assert.equal(canStartAccountFinalizationFrom('completed'), false)
  assert.equal(canStartAccountFinalizationFrom('rejected'), false)
})

// ── Anonymization / tombstone ──
test('tombstone and anonymization leave no personal data behind', () => {
  const tombstone = deletedUserTombstone({ role: 'student', now: 5, requestId: 'req1' })
  for (const key of ['email', 'photoUrl', 'notificationPreferences', 'linkedParentIds', 'linkedStudentIds', 'stripe']) assert.equal(key in tombstone, false, key)
  assert.equal(tombstone.accountStatus, 'deleted')
  assert.equal(tombstone.name, DELETED_USER_NAME)

  const participant = anonymizedChatParticipant({ id: 'u1', name: 'Jan', photoUrl: 'x', role: 'student' }, 'u1')
  assert.equal(participant.name, DELETED_USER_NAME)
  assert.equal('photoUrl' in participant, false)
  assert.equal(isAnonymizedChatParticipant(participant), true)
  assert.equal(isAnonymizedChatParticipant({ name: 'Jan' }), false)

  const review = { id: 'rev', authorId: 'u1', author: 'Jan K.', authorInitials: 'JK', authorColor: '#f00', authorPhotoUrl: 'x', rating: 5, comment: 'Super' }
  const anonymized = anonymizeReviewItem(review, 'u1')
  assert.equal(anonymized.rating, 5)
  assert.equal(anonymized.comment, 'Super')
  assert.equal(anonymized.author, DELETED_USER_NAME)
  assert.equal('authorId' in anonymized, false)
  assert.equal('authorPhotoUrl' in anonymized, false)
  assert.equal(anonymizeReviewItem(review, 'someone-else'), null)
  assert.equal(anonymizeReviewItem(anonymized, 'u1'), null) // idempotent

  assert.equal(sanitizeFinalizationAuditNote('Kontakt: jan.kowalski@example.com ok'), 'Kontakt: [e-mail] ok')
})

// ── Unauthorized attempts ──
test('finalize endpoint: admin-only, double confirmation, rate limit, no bulk form', () => {
  const route = read('app/api/admin/account-deletion-requests/[requestId]/finalize/route.ts')
  // admin check runs before the request document is read
  assert.ok(route.indexOf('requireAdminRequest(') < route.indexOf('collection(collections.accountDeletionRequests)'))
  assert.match(route, /ACCOUNT_DELETION_FINALIZE_CONFIRMATION/)
  assert.match(route, /body\.confirmUserId !== userId/)
  assert.match(route, /checkAndRecordAccountSecurityAttempt\(collections\.accountDeletionRateLimits, `finalize-\$\{admin\.uid\}`/)
  assert.match(route, /assessAccountFinalization\(/)
  assert.match(route, /export async function POST/)
  assert.doesNotMatch(route, /export async function (GET|PUT|DELETE)/)
  assert.equal(ACCOUNT_DELETION_FINALIZE_CONFIRMATION, 'USUŃ TRWALE')

  // the generic PATCH endpoint can neither finalize nor touch a finalizing/completed request
  const patch = read('app/api/admin/account-deletion-requests/[requestId]/route.ts')
  assert.match(patch, /action === 'finalize'/)
  assert.match(patch, /isRequestLockedByFinalization\(requestData\.status\)/)
  // reactivating a deleted/finalizing account from the users panel is refused
  const accountStatus = read('app/api/admin/users/[userId]/account-status/route.ts')
  assert.match(accountStatus, /accountStatus === 'deleted'/)
  assert.match(accountStatus, /isRequestLockedByFinalization/)
})

test('the server steps only ever delete inside the deleted user\'s own scope', () => {
  const server = read('lib/account-deletion-finalize.server.ts')
  // every step in the plan has an implementation
  for (const step of ACCOUNT_FINALIZATION_STEPS) assert.match(server, new RegExp(`\\b${step}:`), step)
  // Storage is touched by uid-scoped prefixes only
  assert.match(server, /profile-photos\/\$\{ctx\.uid\}\//)
  assert.match(server, /chat-attachments\/\$\{ctx\.uid\}\//)
  assert.match(server, /startsWith\(`chat-attachments\/\$\{uid\}\/`\)/)
  // Auth deletion treats "already gone" as success (idempotent)
  const auth = read('lib/firebase-admin-auth.ts')
  assert.match(auth, /auth\/user-not-found'\) return/)
  // report cards (lesson records) are kept when messages are blanked
  assert.match(server, /if \(message\.reportCard\) continue/)
  // the retained financial collections are never deleted
  for (const kept of ['payouts', 'lessonPaymentSnapshots', 'stripeFinancialEvents', 'stripeEvents', 'lessonPackages']) {
    assert.doesNotMatch(server, new RegExp(`deleteAll\\([^)]*collections\\.${kept}`), kept)
  }
  // every bulk delete targets only per-user data
  const bulkDeletes = [...server.matchAll(/deleteAll\(([^\n]*)\)/g)].map((m) => m[1])
  assert.ok(bulkDeletes.length >= 6)
  for (const call of bulkDeletes) assert.doesNotMatch(call, /collections\.(lessons|payouts|lessonPackages|conversations)\b/, call)
  for (const call of bulkDeletes) assert.match(call, /ctx\.uid|query/, call)
})

// ── UI consistent with the backend ──
test('UI statuses, labels and actions match what the backend implements', () => {
  const panel = read('components/admin/admin-account-deletion-requests-panel.tsx')
  const listRoute = read('app/api/admin/account-deletion-requests/route.ts')
  const core = read('lib/account-deletion-core.ts')

  const statusUnion = core.match(/export type AccountDeletionRequestStatus = ([^\n]+)/)[1]
  const statuses = [...statusUnion.matchAll(/'([a-z_]+)'/g)].map((m) => m[1])
  assert.deepEqual(statuses.sort(), ['access_closed', 'completed', 'finalizing', 'needs_resolution', 'pending_review', 'rejected'])
  for (const status of statuses) {
    assert.match(panel, new RegExp(`\\b${status}:`), `panel handles ${status}`)
    assert.match(listRoute, new RegExp(`'${status}'|value === '${status}'`), `list route returns ${status}`)
    assert.ok(accountDeletionStatusLabel(status).length > 0)
    assert.ok(accountDeletionStatusDescription(status).length > 0)
  }
  // "deleted" is only claimed for completed; "access closed" says that data still exists
  assert.equal(accountDeletionStatusLabel('completed'), 'Konto usunięte')
  assert.match(accountDeletionStatusLabel('access_closed'), /dane nadal istnieją/)
  assert.doesNotMatch(accountDeletionStatusLabel('access_closed') + accountDeletionStatusLabel('finalizing'), /usunięte/)

  // UI actions that hit the generic endpoint are exactly the ones the backend accepts
  const actionType = panel.match(/type Action = ([^\n]+)/)[1]
  const uiActions = [...actionType.matchAll(/'([a-z_]+)'/g)].map((m) => m[1])
  assert.deepEqual(uiActions.sort(), ['deactivate_access', 'mark_needs_resolution', 'reject', 'review'])
  assert.doesNotMatch(panel, /action: 'complete'|'complete'/)

  // the destructive button uses the same rules as the server and the same confirmation phrase
  assert.match(panel, /assessAccountFinalization\(/)
  assert.match(panel, /ACCOUNT_DELETION_FINALIZE_CONFIRMATION/)
  assert.match(panel, /finalizeAdminAccountDeletion\(/)
  // buttons that only close access never say "usuń"
  const closeAccessLabels = panel.match(/Zamknij dostęp[^<'`]*/g) ?? []
  for (const label of closeAccessLabels) assert.doesNotMatch(label, /usuń(?! danych)/i)
  assert.match(panel, /Zamknij dostęp \(nie usuwa danych\)/)

  // user-facing settings: a request, not an instant deletion
  const settings = read('components/settings/settings-client.tsx')
  assert.match(settings, /Złóż wniosek o usunięcie konta/)
  assert.doesNotMatch(settings, />\s*Usuń konto\s*</)

  // the scope shown to the admin is complete and mentions what stays
  assert.ok(ACCOUNT_DELETION_SCOPE.deleted.length >= 5)
  assert.ok(ACCOUNT_DELETION_SCOPE.retained.some((item) => /płatno|wypłat/i.test(item)))
})

test('e-mails never claim deletion before it happened', () => {
  assert.doesNotMatch(accountDeletionStatusEmailText('access_closed').body + accountDeletionStatusEmailText('needs_resolution').body, /zostało usunięte|usunęliśmy/i)
  assert.match(accountDeletionStatusEmailText('access_closed').body, /nie zostały jeszcze usunięte/)
  assert.match(accountDeletionStatusEmailText('completed').body, /Usunęliśmy/)
})

test('firebase rules stay consistent with the new tombstone status', () => {
  // a tombstone has no Auth user; rules must still treat only an explicit "deactivated" as locked
  assert.match(read('firestore.rules'), /get\('accountStatus', 'active'\) != 'deactivated'/)
  const users = read('lib/admin-users-core.ts')
  assert.match(users, /accountStatus !== 'deleted'/)
})

// ── Legal documents stay in sync with the code ──
test('legal pages: no placeholders, and the numbers they state match the code', async () => {
  const terms = read('app/terms/page.tsx')
  const privacy = read('app/privacy/page.tsx')
  const cookies = read('app/cookies/page.tsx')
  for (const [name, source] of [['terms', terms], ['privacy', privacy], ['cookies', cookies]]) {
    assert.doesNotMatch(source, /TODO|NEED CLARIFICATION|wersja robocza|\[uzupełnić|\[do uzupełnienia|XXX|lorem/i, name)
  }
  // service fee 3% / min 2,99 zł and 24h auto-confirmation come from the real constants
  const fees = read('lib/service-fees.ts')
  assert.match(fees, /STUDENT_SERVICE_FEE_RATE = 0\.03/)
  assert.match(fees, /STUDENT_SERVICE_FEE_MIN_GROSZE = 299/)
  assert.match(terms, /3% wartości zamówienia, nie mniej niż 2,99 zł/)
  assert.match(read('lib/lesson-report-auto-confirm.ts'), /REPORT_AUTO_CONFIRM_MS = 24 \* 60 \* 60 \* 1000/)
  assert.match(terms, /w ciągu 24 godzin od złożenia Raportu/)
  assert.match(privacy, /w ciągu 24 godzin/)
  // chat attachment limit matches Storage rules
  assert.match(read('storage.rules'), /8 \* 1024 \* 1024/)
  assert.match(terms, /do 8 MB/)
  // account deletion: the documents describe what the code really does
  assert.match(terms, /Usunięty użytkownik/)
  assert.match(privacy, /Usunięty użytkownik/)
  assert.equal(DELETED_USER_NAME, 'Usunięty użytkownik')
  assert.match(terms, /USUŃ KONTO|wpisaniu wymaganego potwierdzenia/)
  // operator + contact exist in both documents, and they cross-link
  assert.match(terms, /kontakt@runbee\.pl/)
  assert.match(privacy, /kontakt@runbee\.pl/)
  assert.match(terms, /href="\/privacy"/)
  assert.match(privacy, /href="\/terms"/)
  assert.match(privacy, /href="\/cookies"/)
  // every provider the code integrates with is disclosed
  for (const provider of ['Firebase', 'Stripe', 'Resend', 'LiveKit', 'Vercel']) assert.match(privacy, new RegExp(provider), provider)
  // no cookie/consent claims the code cannot back up
  assert.doesNotMatch(cookies, /po wyrażeniu zgody|motyw/i)
  // review checklist exists for the open questions
  assert.match(read('legal-review/NEED_CLARIFICATION.md'), /Dane, których brakuje/)
})
