import assert from 'node:assert/strict'
import test from 'node:test'
import { typescriptLoader } from './helpers/load-typescript.mjs'
import { transactionStore } from './helpers/transaction-store.mjs'

const input = {
  categoryId: 'math', categoryIds: ['math'], customSubjects: [], specialty: 'Math',
  hourlyRate: 80, experience: 5, location: 'Warszawa', shortBio: 'Opis', bio: 'Opis profilu',
  skills: ['Math'], languages: ['Polski'], lessonDurations: [60], lessonPackageSizes: [5,10],
  availability: ['Mon'], availabilityStart: '08:00', availabilityEnd: '12:00',
  availabilityHours: { Mon: { start: '08:00', end: '12:00', intervals: [{ start: '18:00', end: '21:00' }, { start: '08:00', end: '12:00' }] } },
}
const identity = { id: 'teacher', name: 'Teacher', initials: 'T', avatarColor: '#F4B400' }
const { buildTeacherFromApplication, validateTeacherApplicationInput } = typescriptLoader()('lib/teacher-application-core.ts')

test('application uses trusted identity and editable fields only; moderation and snapshots survive edits', () => {
  const first = buildTeacherFromApplication(validateTeacherApplicationInput(input), identity)
  assert.equal(first.status, 'pending')
  const existing = { ...first, status: 'approved', stripe: { accountId: 'acct_existing' }, foundingTeacher: true }
  const edit = buildTeacherFromApplication(validateTeacherApplicationInput({ ...input, status: 'approved', id: 'victim', stripe: { accountId: 'attacker' }, foundingTeacher: false, availability: ['Tue'] }), identity, existing)
  assert.equal(edit.id, 'teacher'); assert.equal(edit.status, 'pending')
  assert.equal(edit.stripe, undefined); assert.equal(edit.foundingTeacher, undefined)
  assert.deepEqual(edit.previousProfile.availabilityHours, first.availabilityHours)
  assert.deepEqual(edit.previousProfile.availability, ['Mon'])
  assert.equal(edit.availabilityHours.Mon.intervals.length, 2)
  assert.equal(edit.availabilityHours.Tue.intervals.length, 1)
})
test('server rejects malformed fields and invalid schedule independently of the form', () => {
  for (const patch of [{ hourlyRate: -1 }, { lessonDurations: [45] }, { availability: ['Invalid'] }, { availabilityHours: { Mon: { start: '12:00', end: '08:00' } } }, { availabilityHours: { Mon: { start: '08:00', end: '12:00', intervals: [] } } }]) {
    assert.throws(() => validateTeacherApplicationInput({ ...input, ...patch }))
  }
  assert.throws(() => validateTeacherApplicationInput({ ...input, availabilityStart: { hour: 8 } }))
  assert.throws(() => validateTeacherApplicationInput({ ...input, availabilityEnd: '99:00' }))
  const legacy = validateTeacherApplicationInput({ ...input, availabilityStart: undefined, availabilityEnd: undefined })
  assert.equal(legacy.availabilityStart, '09:00')
  assert.equal(legacy.availabilityEnd, '17:00')
})
function handler(db, uid) {
  return typescriptLoader({
    'next/server': { NextResponse: { json: (data, init) => ({ data, status: init?.status ?? 200 }) } },
    'firebase-admin/firestore': { FieldValue: { delete: () => null } },
    '@/lib/firebase-admin': { adminDb: db },
    '@/lib/stripe-server-auth': { verifyCaller: async () => uid },
  })('app/api/teachers/application/route.ts').POST
}
test('trusted application API preserves server-owned fields and refuses unauthorized writes', async () => {
  const original = { ...buildTeacherFromApplication(validateTeacherApplicationInput(input), identity), status: 'approved', stripe: { accountId: 'acct_existing' }, foundingTeacher: true }
  const db = transactionStore({ 'users/teacher': { ...identity, role: 'teacher' }, 'users/student': { role: 'student' }, 'teachers/teacher': original })
  const request = () => ({ json: async () => ({ idToken: 'mock', input: { ...input, stripe: { accountId: 'attacker' }, status: 'approved' } }) })
  assert.equal((await handler(db, null)(request())).status, 401)
  assert.equal((await handler(db, 'student')(request())).status, 409)
  assert.equal(db.data('teachers/student'), undefined)
  assert.equal((await handler(db, 'teacher')(request())).status, 200)
  assert.equal(db.data('teachers/teacher').stripe.accountId, 'acct_existing')
  assert.equal(db.data('teachers/teacher').foundingTeacher, true)
  assert.equal(db.data('teachers/teacher').status, 'pending')
  assert.equal(db.data('teachers/teacher').availabilityHours.Mon.intervals[0].start, '08:00')
})
test('failed application write preserves the old profile; invalid schedule never reaches a write', async () => {
  const db = transactionStore({ 'users/teacher': { ...identity, role: 'teacher' } })
  const post = handler(db, 'teacher')
  db.failCommit()
  assert.equal((await post({ json: async () => ({ input }) })).status, 409)
  assert.equal(db.data('teachers/teacher'), undefined)
  assert.equal((await post({ json: async () => ({ input: { ...input, availabilityHours: { Mon: { start: '10:00', end: '09:00' } } } }) })).status, 400)
  assert.equal(db.data('teachers/teacher'), undefined)
})
