// Firestore + Storage security rules, exercised against the Firebase Emulator Suite.
//
// Not part of `npm test` (needs Java 21 + the emulators). Run with:
//   npm i -D @firebase/rules-unit-testing@5     # once (peer: firebase ^12)
//   npm run test:rules
// It uses the throw-away project "demo-runbee"; nothing touches production.
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { after, before, beforeEach, describe, test } from 'node:test'
import { assertFails, assertSucceeds, initializeTestEnvironment } from '@firebase/rules-unit-testing'
import { collection, deleteDoc, doc, getDoc, getDocs, query, setDoc, updateDoc, where } from 'firebase/firestore'
import { deleteObject, getMetadata, ref, uploadBytes } from 'firebase/storage'

const rules = (file) => readFileSync(new URL(`../../${file}`, import.meta.url), 'utf8')
let env

const U = {
  student: 'student1',
  teacher: 'teacher1',
  parent: 'parent1',
  outsider: 'outsider1',
  admin: 'admin1',
  deadStudent: 'dead-student',
  deadTeacher: 'dead-teacher',
  deadAdmin: 'dead-admin',
}

async function seed() {
  await env.clearFirestore()
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore()
    const user = (uid, role, extra = {}) => setDoc(doc(db, 'users', uid), { role, name: uid, ...extra })
    await Promise.all([
      user(U.student, 'student', { linkedParentIds: [U.parent] }),
      user(U.teacher, 'teacher'),
      user(U.parent, 'parent'),
      user(U.outsider, 'student'),
      user(U.admin, 'admin'),
      user(U.deadStudent, 'student', { accountStatus: 'deactivated' }),
      user(U.deadTeacher, 'teacher', { accountStatus: 'deactivated' }),
      user(U.deadAdmin, 'admin', { accountStatus: 'deactivated' }),
    ])
    await setDoc(doc(db, 'lessons', 'L1'), { studentId: U.student, payerId: U.parent, teacherId: U.teacher, status: 'upcoming', paymentStatus: 'paid', priceGrosze: 10000 })
    await setDoc(doc(db, 'lessons', 'L-dead'), { studentId: U.deadStudent, payerId: U.deadStudent, teacherId: U.deadTeacher, status: 'upcoming' })
    await setDoc(doc(db, 'conversations', 'c1'), {
      participantIds: [U.student, U.teacher],
      unread: { [U.student]: 2, [U.teacher]: 0 },
      participants: { [U.student]: { name: 'S' }, [U.teacher]: { name: 'T' } },
      lastMessage: 'hi',
    })
    await setDoc(doc(db, 'conversations', 'c-dead'), { participantIds: [U.deadStudent, U.teacher], unread: {} })
    await setDoc(doc(db, 'conversations', 'c1', 'items', 'm1'), { senderId: U.teacher, text: 'hello', reportCard: { status: 'awaiting', lessonId: 'L1' } })
    await setDoc(doc(db, 'notifications', 'n1'), { userId: U.student, title: 'x' })
    await setDoc(doc(db, 'emailEvents', 'e1'), { status: 'pending', recipientUid: U.student })
    await setDoc(doc(db, 'accountDeletionRequests', 'r1'), { uid: U.student, status: 'pending' })
  })
}

before(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-runbee',
    firestore: { rules: rules('firestore.rules') },
    storage: { rules: rules('storage.rules') },
  })
})
after(async () => { await env?.cleanup() })
beforeEach(seed)

const fs = (uid) => env.authenticatedContext(uid).firestore()
const anon = () => env.unauthenticatedContext().firestore()

describe('firestore: accounts (active / deactivated / admin)', () => {
  test('signed-out cannot read profiles; active user can', async () => {
    await assertFails(getDoc(doc(anon(), 'users', U.teacher)))
    await assertSucceeds(getDoc(doc(fs(U.student), 'users', U.teacher)))
  })
  test('a deactivated account is locked out of everything, even its own profile', async () => {
    await assertFails(getDoc(doc(fs(U.deadStudent), 'users', U.deadStudent)))
    await assertFails(getDoc(doc(fs(U.deadStudent), 'lessons', 'L-dead')))
    await assertFails(getDoc(doc(fs(U.deadStudent), 'conversations', 'c-dead')))
    await assertFails(updateDoc(doc(fs(U.deadTeacher), 'lessons', 'L-dead'), { status: 'cancelled' }))
  })
  test('a deactivated admin loses admin powers', async () => {
    await assertFails(getDoc(doc(fs(U.deadAdmin), 'lessons', 'L1')))
    await assertFails(deleteDoc(doc(fs(U.deadAdmin), 'lessons', 'L1')))
  })
  test('owner can edit allowed profile fields only', async () => {
    await assertSucceeds(updateDoc(doc(fs(U.student), 'users', U.student), { notificationPreferences: { email: { messages: { newMessage: false } } } }))
    await assertFails(updateDoc(doc(fs(U.student), 'users', U.student), { role: 'admin' }))
    await assertFails(updateDoc(doc(fs(U.student), 'users', U.student), { accountStatus: 'active' }))
    await assertFails(updateDoc(doc(fs(U.student), 'users', U.student), { linkedParentIds: [U.outsider] }))
    await assertFails(updateDoc(doc(fs(U.outsider), 'users', U.student), { name: 'hijack' }))
  })
})

describe('compat: legacy accounts without accountStatus', () => {
  test('missing accountStatus = active; explicit "active" = active; "deactivated" = blocked (Firestore)', async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      const db = ctx.firestore()
      await setDoc(doc(db, 'users', 'legacy'), { role: 'student' }) // no accountStatus at all
      await setDoc(doc(db, 'users', 'explicit'), { role: 'student', accountStatus: 'active' })
      await setDoc(doc(db, 'users', 'legacy-admin'), { role: 'admin' })
      await setDoc(doc(db, 'lessons', 'LL'), { studentId: 'legacy', payerId: 'legacy', teacherId: U.teacher, status: 'upcoming' })
    })
    for (const uid of ['legacy', 'explicit']) await assertSucceeds(getDoc(doc(fs(uid), 'users', U.teacher)))
    await assertSucceeds(getDoc(doc(fs('legacy'), 'lessons', 'LL')))
    await assertSucceeds(getDoc(doc(fs('legacy-admin'), 'lessons', 'LL')))
    await assertSucceeds(updateDoc(doc(fs('legacy'), 'users', 'legacy'), { name: 'New' }))
    await assertFails(updateDoc(doc(fs('legacy'), 'lessons', 'LL'), { paymentStatus: 'paid' })) // financial fields stay protected
    await assertFails(getDoc(doc(fs(U.deadStudent), 'lessons', 'L-dead')))
  })
  test('an account whose profile doc does not exist yet (fresh sign-up) can still create it', async () => {
    await assertSucceeds(setDoc(doc(fs('brand-new'), 'users', 'brand-new'), { role: 'student', name: 'N' }))
    await assertFails(setDoc(doc(fs('brand-new-2'), 'users', 'brand-new-2'), { role: 'admin', name: 'N' }))
  })
  test('a legacy account (no accountStatus) works in Storage, a deactivated one does not', async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      const db = ctx.firestore()
      await setDoc(doc(db, 'users', 'legacy'), { role: 'student' })
      await setDoc(doc(db, 'conversations', 'c-legacy'), { participantIds: ['legacy', U.teacher], unread: {} })
    })
    await assertSucceeds(put('legacy', 'profile-photos/legacy/a.png', 1024, 'image/png'))
    await assertSucceeds(put('legacy', 'chat-attachments/legacy/c-legacy/f.pdf', 1024, 'application/pdf'))
    await assertSucceeds(getMetadata(ref(storage(U.teacher), 'chat-attachments/legacy/c-legacy/f.pdf')))
    await assertFails(put(U.deadStudent, `profile-photos/${U.deadStudent}/a.png`, 1024, 'image/png'))
  })
  test('legacy participant can markRead', async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      const db = ctx.firestore()
      await setDoc(doc(db, 'users', 'legacy'), { role: 'student' })
      await setDoc(doc(db, 'conversations', 'c-legacy'), { participantIds: ['legacy', U.teacher], unread: { legacy: 3 } })
    })
    await assertSucceeds(updateDoc(doc(fs('legacy'), 'conversations', 'c-legacy'), { 'unread.legacy': 0 }))
  })
})

describe('firestore: lessons', () => {
  test('student, payer, teacher, linked parent and admin read; outsider does not', async () => {
    for (const uid of [U.student, U.parent, U.teacher, U.admin]) await assertSucceeds(getDoc(doc(fs(uid), 'lessons', 'L1')))
    await assertFails(getDoc(doc(fs(U.outsider), 'lessons', 'L1')))
  })
  test('clients can never create lessons', async () => {
    await assertFails(setDoc(doc(fs(U.student), 'lessons', 'L-new'), { studentId: U.student, teacherId: U.teacher, status: 'upcoming' }))
    await assertFails(setDoc(doc(fs(U.admin), 'lessons', 'L-new'), { studentId: U.student, teacherId: U.teacher }))
  })
  test('participants update workflow fields but never payment fields', async () => {
    await assertSucceeds(updateDoc(doc(fs(U.teacher), 'lessons', 'L1'), { status: 'cancelled' }))
    for (const field of ['paymentStatus', 'priceGrosze', 'stripeTransferId', 'stripeRefundId', 'platformFeeGrosze']) {
      await assertFails(updateDoc(doc(fs(U.student), 'lessons', 'L1'), { [field]: 1 }))
      await assertFails(updateDoc(doc(fs(U.admin), 'lessons', 'L1'), { [field]: 1 }))
    }
    await assertFails(updateDoc(doc(fs(U.outsider), 'lessons', 'L1'), { status: 'cancelled' }))
  })
})

describe('firestore: chat', () => {
  test('only participants read conversation and messages', async () => {
    await assertSucceeds(getDoc(doc(fs(U.student), 'conversations', 'c1')))
    await assertSucceeds(getDoc(doc(fs(U.teacher), 'conversations', 'c1', 'items', 'm1')))
    await assertFails(getDoc(doc(fs(U.outsider), 'conversations', 'c1')))
    await assertFails(getDoc(doc(fs(U.outsider), 'conversations', 'c1', 'items', 'm1')))
    await assertFails(getDocs(collection(fs(U.outsider), 'conversations', 'c1', 'items')))
    await assertFails(getDoc(doc(anon(), 'conversations', 'c1')))
  })
  test('listing own conversations works, listing others does not', async () => {
    await assertSucceeds(getDocs(query(collection(fs(U.student), 'conversations'), where('participantIds', 'array-contains', U.student))))
    await assertFails(getDocs(query(collection(fs(U.outsider), 'conversations'), where('participantIds', 'array-contains', U.student))))
  })
  test('markRead: participant may change unread/participants only', async () => {
    await assertSucceeds(updateDoc(doc(fs(U.student), 'conversations', 'c1'), { [`unread.${U.student}`]: 0 }))
    await assertSucceeds(updateDoc(doc(fs(U.teacher), 'conversations', 'c1'), { [`participants.${U.teacher}`]: { name: 'T2' } }))
    await assertFails(updateDoc(doc(fs(U.student), 'conversations', 'c1'), { lastMessage: 'forged' }))
    await assertFails(updateDoc(doc(fs(U.student), 'conversations', 'c1'), { participantIds: [U.student, U.outsider] }))
    await assertFails(updateDoc(doc(fs(U.outsider), 'conversations', 'c1'), { [`unread.${U.student}`]: 0 }))
    await assertFails(updateDoc(doc(fs(U.deadStudent), 'conversations', 'c-dead'), { unread: {} }))
  })
  test('clients can NOT create messages or report cards (server-only via /api/chat/messages)', async () => {
    await assertFails(setDoc(doc(fs(U.student), 'conversations', 'c1', 'items', 'forged'), { senderId: U.student, text: 'x' }))
    await assertFails(setDoc(doc(fs(U.teacher), 'conversations', 'c1', 'items', 'card'), { senderId: U.teacher, reportCard: { status: 'confirmed' } }))
    await assertFails(setDoc(doc(fs(U.admin), 'conversations', 'c1', 'items', 'card2'), { senderId: U.admin, text: 'x' }))
  })
  test('report card status can be flipped by participants/admin; message text cannot be edited', async () => {
    await assertSucceeds(updateDoc(doc(fs(U.student), 'conversations', 'c1', 'items', 'm1'), { reportCard: { status: 'confirmed', lessonId: 'L1' } }))
    await assertSucceeds(updateDoc(doc(fs(U.admin), 'conversations', 'c1', 'items', 'm1'), { reportCard: { status: 'resolved', lessonId: 'L1' } }))
    await assertFails(updateDoc(doc(fs(U.student), 'conversations', 'c1', 'items', 'm1'), { text: 'edited' }))
    await assertFails(updateDoc(doc(fs(U.outsider), 'conversations', 'c1', 'items', 'm1'), { reportCard: { status: 'confirmed' } }))
    await assertFails(deleteDoc(doc(fs(U.student), 'conversations', 'c1', 'items', 'm1')))
  })
})

describe('firestore: server-only collections are closed to every client', () => {
  test('emailEvents / accountDeletionRequests / stripeEvents: no read or write, not even admin', async () => {
    for (const uid of [U.student, U.admin]) {
      await assertFails(getDoc(doc(fs(uid), 'emailEvents', 'e1')))
      await assertFails(setDoc(doc(fs(uid), 'emailEvents', 'e2'), { status: 'sent' }))
      await assertFails(getDoc(doc(fs(uid), 'accountDeletionRequests', 'r1')))
      await assertFails(setDoc(doc(fs(uid), 'accountDeletionRequests', 'r2'), { uid, status: 'pending' }))
      await assertFails(getDoc(doc(fs(uid), 'stripeEvents', 'x')))
    }
  })
  test('notifications are private to their owner', async () => {
    await assertSucceeds(getDoc(doc(fs(U.student), 'notifications', 'n1')))
    await assertFails(getDoc(doc(fs(U.outsider), 'notifications', 'n1')))
    await assertFails(getDoc(doc(fs(U.deadStudent), 'notifications', 'n1')))
  })
})

// ── Storage ─────────────────────────────────────────────────────
const storage = (uid) => env.authenticatedContext(uid).storage()
const bytes = (n) => new Uint8Array(n)
const put = (uid, path, size, contentType) => uploadBytes(ref(storage(uid), path), bytes(size), { contentType })

describe('storage: profile photos', () => {
  test('public read, owner-only write, images under 2 MB', async () => {
    await assertSucceeds(put(U.student, `profile-photos/${U.student}/a.png`, 1024, 'image/png'))
    await assertSucceeds(getMetadata(ref(env.unauthenticatedContext().storage(), `profile-photos/${U.student}/a.png`)))
    await assertFails(put(U.outsider, `profile-photos/${U.student}/b.png`, 1024, 'image/png'))
    await assertFails(put(U.student, `profile-photos/${U.student}/c.pdf`, 1024, 'application/pdf'))
    await assertFails(put(U.student, `profile-photos/${U.student}/big.png`, 2 * 1024 * 1024 + 1, 'image/png'))
    await assertFails(put(U.deadStudent, `profile-photos/${U.deadStudent}/a.png`, 1024, 'image/png'))
  })
})

describe('storage: chat attachments', () => {
  const path = (uid, conv, name = 'f.pdf') => `chat-attachments/${uid}/${conv}/${name}`
  test('participant uploads to their own folder in their own conversation', async () => {
    await assertSucceeds(put(U.student, path(U.student, 'c1'), 1024, 'application/pdf'))
    await assertSucceeds(put(U.teacher, path(U.teacher, 'c1', 'p.png'), 1024, 'image/png'))
  })
  test('outsider, wrong folder owner, foreign conversation are rejected', async () => {
    await assertFails(put(U.outsider, path(U.outsider, 'c1'), 1024, 'application/pdf'))
    await assertFails(put(U.student, path(U.teacher, 'c1'), 1024, 'application/pdf'))
    await assertFails(put(U.outsider, path(U.outsider, 'c-dead'), 1024, 'application/pdf'))
  })
  test('size and type limits; no overwrite', async () => {
    await assertFails(put(U.student, path(U.student, 'c1', 'big.pdf'), 8 * 1024 * 1024 + 1, 'application/pdf'))
    await assertFails(put(U.student, path(U.student, 'c1', 'x.exe'), 1024, 'application/x-msdownload'))
    await assertSucceeds(put(U.student, path(U.student, 'c1', 'once.pdf'), 1024, 'application/pdf'))
    await assertFails(put(U.student, path(U.student, 'c1', 'once.pdf'), 2048, 'application/pdf'))
  })
  test('read: participants only; deactivated participant locked out; delete only by uploader', async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await uploadBytes(ref(ctx.storage(), path(U.student, 'c1', 'seed.pdf')), bytes(10), { contentType: 'application/pdf' })
    })
    await assertSucceeds(getMetadata(ref(storage(U.teacher), path(U.student, 'c1', 'seed.pdf'))))
    await assertFails(getMetadata(ref(storage(U.outsider), path(U.student, 'c1', 'seed.pdf'))))
    await assertFails(getMetadata(ref(env.unauthenticatedContext().storage(), path(U.student, 'c1', 'seed.pdf'))))
    await assertFails(deleteObject(ref(storage(U.teacher), path(U.student, 'c1', 'seed.pdf'))))
    await assertSucceeds(deleteObject(ref(storage(U.student), path(U.student, 'c1', 'seed.pdf'))))
  })
  test('a deactivated user cannot upload or read attachments even in their own conversation', async () => {
    await assertFails(put(U.deadStudent, path(U.deadStudent, 'c-dead'), 1024, 'application/pdf'))
    await env.withSecurityRulesDisabled(async (ctx) => {
      await uploadBytes(ref(ctx.storage(), path(U.teacher, 'c-dead', 'seed.pdf')), bytes(10), { contentType: 'application/pdf' })
    })
    await assertFails(getMetadata(ref(storage(U.deadStudent), path(U.teacher, 'c-dead', 'seed.pdf'))))
  })
  test('everything outside the known paths is denied', async () => {
    await assertFails(put(U.admin, 'random/place.png', 10, 'image/png'))
  })
})

test('sanity: the suite really loaded both rule files', () => {
  assert.ok(rules('firestore.rules').includes('match /conversations/{conversationId}'))
  assert.ok(rules('storage.rules').includes('chat-attachments'))
})
