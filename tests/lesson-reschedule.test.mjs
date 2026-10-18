import assert from 'node:assert/strict'
import test from 'node:test'
import { typescriptLoader } from './helpers/load-typescript.mjs'
import { transactionStore } from './helpers/transaction-store.mjs'

const load = typescriptLoader({
  'server-only': {},
  '@/lib/firebase': { collections: { teachers: 'teachers', lessons: 'lessons', lessonPackages: 'lessonPackages', lessonSlotLocks: 'lessonSlotLocks', lessonPackageBookingRequests: 'lessonPackageBookingRequests', notifications: 'notifications' } },
  '@/lib/email/product-notifications.server': { runbeeAppUrl: (path) => path, sendProductNotificationEmail: async () => ({ status: 'sent' }) },
})
const { rescheduleLesson } = load('lib/lesson-reschedule.server.ts')
const { bookLessonWithPackageCreditServer } = load('lib/lesson-package-booking.server.ts')
const { warsawDateIso, addCalendarDays } = load('lib/availability-core.ts')
const { lessonSlotLockIds } = load('lib/lesson-slot-locks.ts')
const date = addCalendarDays(warsawDateIso(), 2)
const nextDate = addCalendarDays(date, 1)
const now = Date.now()
const days = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat']
const schedule = { status: 'approved', availability: days, availabilityHours: Object.fromEntries(days.map((day) => [day, { start: '08:00', end: '12:00', intervals: [{ start: '08:00', end: '12:00' }, { start: '18:00', end: '21:00' }] }])) }
function initial() {
  return {
    'users/student': { role: 'student', linkedParentIds: ['parent'] },
    'users/teacher': { role: 'teacher' }, 'users/parent': { role: 'parent' },
    'users/outsider': { role: 'student' }, 'users/admin': { role: 'admin' },
    'teachers/teacher': schedule,
    'lessons/lesson1': { id: 'lesson1', teacherId: 'teacher', studentId: 'student', payerId: 'student', teacherName: 'Teacher', studentName: 'Student', topic: 'Math', status: 'upcoming', duration: 60, dateIso: date, date, time: '08:00' },
    ...Object.fromEntries(lessonSlotLockIds('teacher', date, '08:00', 60).map((id) => [`lessonSlotLocks/${id}`, { lessonId: 'lesson1' }])),
  }
}
const request = (patch = {}) => ({ lessonId: 'lesson1', requestId: 'request-001', action: 'request', dateIso: nextDate, time: '18:00', ...patch })
const accept = (patch = {}) => ({ lessonId: 'lesson1', requestId: 'accept-001', action: 'accepted', expectedRequestedAt: now, ...patch })

test('request and acceptance move lesson and locks atomically; status and duration stay unchanged', async () => {
  const db = transactionStore(initial())
  await rescheduleLesson(db, 'student', request(), now)
  assert.equal(db.data('lessons/lesson1').time, '08:00')
  await rescheduleLesson(db, 'teacher', accept(), now + 1)
  const lesson = db.data('lessons/lesson1')
  assert.equal(lesson.time, '18:00'); assert.equal(lesson.dateIso, nextDate)
  assert.equal(lesson.status, 'upcoming'); assert.equal(lesson.duration, 60)
  assert.equal(lesson.pendingChange, null)
  assert.ok(db.entries().filter(([path]) => path.startsWith('lessonSlotLocks/')).every(([path]) => path.includes(nextDate)))
})
test('permissions: outsiders, own acceptance and disabled accounts fail; linked parent can request', async () => {
  const state = initial(); state['users/outsider'].accountStatus = 'deactivated'
  const db = transactionStore(state)
  await assert.rejects(rescheduleLesson(db, 'outsider', request(), now), /Brak dostępu/)
  await rescheduleLesson(db, 'parent', request(), now)
  await assert.rejects(rescheduleLesson(db, 'student', accept(), now), /druga strona/)
  await rescheduleLesson(db, 'teacher', accept(), now + 1)
})
test('breaks, boundary crossing, unavailable days, stale requests and started lessons fail', async () => {
  const db = transactionStore(initial())
  for (const time of ['14:00', '11:30', '20:30']) await assert.rejects(rescheduleLesson(db, 'student', request({ time }), now), /dostępności/)
  await rescheduleLesson(db, 'student', request(), now)
  await assert.rejects(rescheduleLesson(db, 'teacher', accept({ expectedRequestedAt: now - 1 }), now), /Prośba zmieniła/)
  await assert.rejects(rescheduleLesson(db, 'teacher', accept(), Date.parse(`${nextDate}T22:00:00Z`)), /przyszłą/)
})
test('acceptance rechecks changed availability and legacy occupied slots without locks', async () => {
  for (const kind of ['changed schedule', 'legacy lesson']) {
    const state = initial()
    state['lessons/lesson1'].pendingChange = { type: 'reschedule', requestedBy: 'student', requestedAt: now, newDateIso: nextDate, newTime: '18:00' }
    if (kind === 'changed schedule') state['teachers/teacher'] = { ...schedule, availability: [] }
    else state['lessons/legacy'] = { ...state['lessons/lesson1'], id: 'legacy', dateIso: nextDate, time: '18:00' }
    const db = transactionStore(state)
    await assert.rejects(rescheduleLesson(db, 'teacher', accept(), now))
    assert.equal(db.data('lessons/lesson1').time, '08:00')
  }
})
test('retries are idempotent and mismatched operation identifiers are rejected', async () => {
  const db = transactionStore(initial())
  await rescheduleLesson(db, 'student', request(), now)
  await rescheduleLesson(db, 'student', request(), now + 1)
  await rescheduleLesson(db, 'teacher', accept(), now + 2)
  const before = db.entries()
  await rescheduleLesson(db, 'teacher', accept(), now + 3)
  assert.deepEqual(db.entries(), before)
  await assert.rejects(rescheduleLesson(db, 'student', request({ time: '19:00' }), now), /Identyfikator/)
})
test('Firestore failure leaves lesson, locks and notifications untouched; retry succeeds', async () => {
  const db = transactionStore(initial())
  await rescheduleLesson(db, 'student', request(), now)
  const before = db.entries()
  db.failCommit()
  await assert.rejects(rescheduleLesson(db, 'teacher', accept(), now + 1), /Firestore/)
  assert.deepEqual(db.entries(), before)
  await rescheduleLesson(db, 'teacher', accept(), now + 2)
  assert.equal(db.data('lessons/lesson1').time, '18:00')
})
test('parallel acceptances cannot move two lessons into the same slot', async () => {
  const state = initial()
  for (const id of ['lesson1', 'lesson2']) state[`lessons/${id}`] = { ...state['lessons/lesson1'], id, time: id === 'lesson1' ? '08:00' : '10:00', pendingChange: { type: 'reschedule', requestedBy: 'student', requestedAt: now, newDateIso: nextDate, newTime: '18:00' } }
  const db = transactionStore(state)
  const results = await Promise.allSettled(['lesson1', 'lesson2'].map((lessonId) => rescheduleLesson(db, 'teacher', accept({ lessonId }), now + 1)))
  assert.equal(results.filter((r) => r.status === 'fulfilled').length, 1)
  assert.ok(db.attempts() >= 3)
})
const pkg = { id: 'pkg', status: 'active', teacherId: 'teacher', teacherName: 'Teacher', teacherInitials: 'T', teacherColor: '#F4B400', studentId: 'student', studentName: 'Student', payerId: 'student', payerRole: 'student', subjectKey: 'category:math', specialty: 'Math', duration: 60, remainingCredits: 5, reservedCredits: 0, usedCredits: 0, perLessonGrossGrosze: 10000, platformFeePerLessonGrosze: 800, teacherAmountPerLessonGrosze: 9200, effectiveCommissionPercent: 8, commissionSource: 'standard', livemode: false }
const booking = (db, id, patch = {}) => bookLessonWithPackageCreditServer({ database: db, packageId: 'pkg', teacherId: 'teacher', studentId: 'student', studentName: 'Student', subjectCategoryId: 'math', specialty: 'Math', duration: 60, dateIso: nextDate, time: '18:00', topic: 'Math', bookingRequestId: id, ...patch })
test('actual package booking helper respects multiple intervals, breaks and parallel credit reservations', async () => {
  const db = transactionStore({ ...initial(), 'lessonPackages/pkg': pkg })
  assert.equal((await booking(db, 'invalid', { time: '14:00' })).ok, false)
  const results = await Promise.all([booking(db, 'booking-a'), booking(db, 'booking-b')])
  assert.equal(results.filter((r) => r.ok).length, 1)
  assert.equal(db.data('lessonPackages/pkg').remainingCredits, 4)
  assert.equal(db.data('lessonPackages/pkg').reservedCredits, 1)
  const successfulId = results[0].ok ? 'booking-a' : 'booking-b'
  assert.equal((await booking(db, successfulId)).deduped, true)
  assert.equal(db.data('lessonPackages/pkg').remainingCredits, 4)
})
test('package booking versus reschedule: only one obtains the new slot', async () => {
  const db = transactionStore({ ...initial(), 'lessonPackages/pkg': pkg })
  await rescheduleLesson(db, 'student', request(), now)
  const results = await Promise.allSettled([rescheduleLesson(db, 'teacher', accept(), now + 1), booking(db, 'booking-c')])
  const occupied = db.entries().filter(([path, lesson]) => /^lessons\/[^/]+$/.test(path) && lesson.dateIso === nextDate && lesson.time === '18:00')
  assert.equal(occupied.length, 1)
  assert.ok(results.some((r) => r.status === 'fulfilled'))
})
