import { arrayUnion, doc, getDoc, setDoc, updateDoc } from 'firebase/firestore'
import { collections, db, isFirebaseConfigured } from '@/lib/firebase'
import { getUserProfileById } from '@/services/auth.service'
import type { StudentLinkCode } from '@/lib/types'

// ─────────────────────────────────────────────────────────────
// Parent ↔ student account linking (see techbee-blueprint.md §3).
//
// A student generates a short single-use code; a parent redeems it to
// become that student's "konto nadzorujące" (supervising account) —
// able to book/pay for the student and to confirm/dispute their lesson
// reports (see services/lessons.service.ts). Linking is one-directional
// to create (student → code → parent) but bidirectional once redeemed:
// both sides can see the link (student.linkedParentIds, parent.linkedStudentIds).
//
// Dual-mode, same convention as every other service/*.ts file here:
// Firestore when configured, a localStorage mock otherwise. In mock
// mode the link graph is kept in its own key rather than bolted onto
// techbee.auth.users, so this file never needs to know that storage's
// internal shape.
// ─────────────────────────────────────────────────────────────

const CODE_TTL_MS = 24 * 60 * 60 * 1000 // codes expire after 24h if unused
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789' // no 0/O/1/I — easy to read aloud/type

const MOCK_CODES_KEY = 'techbee.family.linkCodes'
const MOCK_PARENT_TO_STUDENTS_KEY = 'techbee.family.parentToStudents'
const MOCK_STUDENT_TO_PARENTS_KEY = 'techbee.family.studentToParents'
const MOCK_STUDENT_CAN_MANAGE_KEY = 'techbee.family.studentCanManageReports'

function isBrowser() {
  return typeof window !== 'undefined'
}

function generateCode(): string {
  let code = ''
  for (let i = 0; i < 6; i++) code += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)]
  return code
}

export type LinkedPersonSummary = { id: string; name: string; initials: string; avatarColor: string }

// ── Mock (localStorage) ──────────────────────────────────────

function readMockCodes(): Record<string, StudentLinkCode> {
  if (!isBrowser()) return {}
  try {
    return JSON.parse(window.localStorage.getItem(MOCK_CODES_KEY) ?? '{}') as Record<string, StudentLinkCode>
  } catch {
    return {}
  }
}

function writeMockCodes(codes: Record<string, StudentLinkCode>) {
  if (!isBrowser()) return
  window.localStorage.setItem(MOCK_CODES_KEY, JSON.stringify(codes))
}

function readMockLinks(key: string): Record<string, string[]> {
  if (!isBrowser()) return {}
  try {
    return JSON.parse(window.localStorage.getItem(key) ?? '{}') as Record<string, string[]>
  } catch {
    return {}
  }
}

function addMockLink(key: string, ownerId: string, linkedId: string) {
  if (!isBrowser()) return
  const all = readMockLinks(key)
  const list = all[ownerId] ?? []
  if (!list.includes(linkedId)) all[ownerId] = [...list, linkedId]
  window.localStorage.setItem(key, JSON.stringify(all))
}

async function generateStudentLinkCodeMock(studentId: string, studentName: string): Promise<StudentLinkCode> {
  const codes = readMockCodes()
  let code = generateCode()
  while (codes[code]) code = generateCode()
  const entry: StudentLinkCode = { code, studentId, studentName, createdAt: Date.now(), expiresAt: Date.now() + CODE_TTL_MS }
  codes[code] = entry
  writeMockCodes(codes)
  return entry
}

async function redeemLinkCodeMock(parentId: string, rawCode: string): Promise<{ ok: true; studentId: string; studentName: string } | { ok: false; error: string }> {
  const code = rawCode.trim().toUpperCase()
  const codes = readMockCodes()
  const entry = codes[code]
  if (!entry) return { ok: false, error: 'Nieprawidłowy kod.' }
  if (entry.usedByParentId) return { ok: false, error: 'Ten kod został już wykorzystany.' }
  if (entry.expiresAt < Date.now()) return { ok: false, error: 'Ten kod wygasł — poproś ucznia o nowy.' }
  if (entry.studentId === parentId) return { ok: false, error: 'Nie możesz połączyć konta z samym sobą.' }
  codes[code] = { ...entry, usedByParentId: parentId, usedAt: Date.now() }
  writeMockCodes(codes)
  addMockLink(MOCK_PARENT_TO_STUDENTS_KEY, parentId, entry.studentId)
  addMockLink(MOCK_STUDENT_TO_PARENTS_KEY, entry.studentId, parentId)
  return { ok: true, studentId: entry.studentId, studentName: entry.studentName }
}

function getLinkedStudentIdsMock(parentId: string): string[] {
  return readMockLinks(MOCK_PARENT_TO_STUDENTS_KEY)[parentId] ?? []
}

function getLinkedParentIdsMock(studentId: string): string[] {
  return readMockLinks(MOCK_STUDENT_TO_PARENTS_KEY)[studentId] ?? []
}

function readMockBooleans(key: string): Record<string, boolean> {
  if (!isBrowser()) return {}
  try {
    return JSON.parse(window.localStorage.getItem(key) ?? '{}') as Record<string, boolean>
  } catch {
    return {}
  }
}

function getStudentCanManageReportsMock(parentId: string): boolean {
  return readMockBooleans(MOCK_STUDENT_CAN_MANAGE_KEY)[parentId] ?? false
}

function setStudentCanManageReportsMock(parentId: string, value: boolean) {
  if (!isBrowser()) return
  const all = readMockBooleans(MOCK_STUDENT_CAN_MANAGE_KEY)
  all[parentId] = value
  window.localStorage.setItem(MOCK_STUDENT_CAN_MANAGE_KEY, JSON.stringify(all))
}

// ── Firebase ──────────────────────────────────────────────────

async function generateStudentLinkCodeFirebase(studentId: string, studentName: string): Promise<StudentLinkCode> {
  if (!db) throw new Error('Firebase nie jest skonfigurowane.')
  let code = generateCode()
  // Extremely unlikely to collide (32^6 codes), but cheap to guard against.
  for (let attempt = 0; attempt < 5; attempt++) {
    const existing = await getDoc(doc(db, collections.linkCodes, code))
    if (!existing.exists()) break
    code = generateCode()
  }
  const entry: StudentLinkCode = { code, studentId, studentName, createdAt: Date.now(), expiresAt: Date.now() + CODE_TTL_MS }
  await setDoc(doc(db, collections.linkCodes, code), entry)
  return entry
}

async function redeemLinkCodeFirebase(parentId: string, rawCode: string): Promise<{ ok: true; studentId: string; studentName: string } | { ok: false; error: string }> {
  if (!db) return { ok: false, error: 'Firebase nie jest skonfigurowane.' }
  const code = rawCode.trim().toUpperCase()
  const ref = doc(db, collections.linkCodes, code)
  const snap = await getDoc(ref)
  if (!snap.exists()) return { ok: false, error: 'Nieprawidłowy kod.' }
  const entry = snap.data() as StudentLinkCode
  if (entry.usedByParentId) return { ok: false, error: 'Ten kod został już wykorzystany.' }
  if (entry.expiresAt < Date.now()) return { ok: false, error: 'Ten kod wygasł — poproś ucznia o nowy.' }
  if (entry.studentId === parentId) return { ok: false, error: 'Nie możesz połączyć konta z samym sobą.' }
  await Promise.all([
    updateDoc(ref, { usedByParentId: parentId, usedAt: Date.now() }),
    updateDoc(doc(db, collections.users, parentId), { linkedStudentIds: arrayUnion(entry.studentId) }),
    updateDoc(doc(db, collections.users, entry.studentId), { linkedParentIds: arrayUnion(parentId) }),
  ])
  return { ok: true, studentId: entry.studentId, studentName: entry.studentName }
}

async function getLinkedStudentIdsFirebase(parentId: string): Promise<string[]> {
  if (!db) return []
  const snap = await getDoc(doc(db, collections.users, parentId))
  if (!snap.exists()) return []
  const data = snap.data() as { linkedStudentIds?: string[] }
  return data.linkedStudentIds ?? []
}

async function getLinkedParentIdsFirebase(studentId: string): Promise<string[]> {
  if (!db) return []
  const snap = await getDoc(doc(db, collections.users, studentId))
  if (!snap.exists()) return []
  const data = snap.data() as { linkedParentIds?: string[] }
  return data.linkedParentIds ?? []
}

async function getStudentCanManageReportsFirebase(parentId: string): Promise<boolean> {
  if (!db) return false
  const snap = await getDoc(doc(db, collections.users, parentId))
  if (!snap.exists()) return false
  const data = snap.data() as { studentCanManageReports?: boolean }
  // Absent (every parent account created before this setting existed) →
  // false, i.e. the pre-existing "only the parent manages it" behavior —
  // the explicit backward-compatibility rule (see lib/report-permissions.ts).
  return data.studentCanManageReports ?? false
}

async function setStudentCanManageReportsFirebase(parentId: string, value: boolean): Promise<void> {
  if (!db) return
  await updateDoc(doc(db, collections.users, parentId), { studentCanManageReports: value })
}

// ── Public API ────────────────────────────────────────────────

/** A student generates a fresh single-use code (valid 24h) for a parent to redeem. */
export async function generateStudentLinkCode(studentId: string, studentName: string): Promise<StudentLinkCode> {
  return isFirebaseConfigured ? generateStudentLinkCodeFirebase(studentId, studentName) : generateStudentLinkCodeMock(studentId, studentName)
}

/** A parent redeems a student's code, creating the bidirectional link. */
export async function redeemLinkCode(parentId: string, code: string): Promise<{ ok: true; studentId: string; studentName: string } | { ok: false; error: string }> {
  if (!code.trim()) return { ok: false, error: 'Wpisz kod.' }
  return isFirebaseConfigured ? redeemLinkCodeFirebase(parentId, code) : redeemLinkCodeMock(parentId, code)
}

/** Every student currently linked to this parent. Lesson counts are left at 0 here (to avoid a circular dependency with lessons.service.ts) — the parent dashboard overlays real counts by calling getStudentLessons per student. */
export async function getLinkedStudents(parentId: string): Promise<import('@/lib/types').LinkedStudentSummary[]> {
  const ids = isFirebaseConfigured ? await getLinkedStudentIdsFirebase(parentId) : getLinkedStudentIdsMock(parentId)
  const summaries = await Promise.all(
    ids.map(async (id) => {
      const profile = await getUserProfileById(id)
      if (!profile) return null
      return {
        id,
        name: profile.name,
        initials: profile.initials,
        avatarColor: profile.avatarColor,
        upcomingLessonsCount: 0,
        pendingConfirmationsCount: 0,
      }
    })
  )
  return summaries.filter((s): s is import('@/lib/types').LinkedStudentSummary => s !== null)
}

/** Every parent linked to this student — shown on the student dashboard so they know who's supervising their account. */
export async function getLinkedParents(studentId: string): Promise<LinkedPersonSummary[]> {
  const ids = isFirebaseConfigured ? await getLinkedParentIdsFirebase(studentId) : getLinkedParentIdsMock(studentId)
  const profiles = await Promise.all(ids.map((id) => getUserProfileById(id)))
  return profiles.filter((p): p is NonNullable<typeof p> => p !== null).map((p) => ({ id: p.id, name: p.name, initials: p.initials, avatarColor: p.avatarColor }))
}

/** Reads whether a parent has enabled "Pozwól uczniowi samodzielnie akceptować i odrzucać raporty" (see components/dashboard/parent-report-settings-card.tsx) — defaults to `false` if never set. */
export async function getStudentCanManageReports(parentId: string): Promise<boolean> {
  return isFirebaseConfigured ? getStudentCanManageReportsFirebase(parentId) : getStudentCanManageReportsMock(parentId)
}

/** Persists the parent's "let my student manage reports too" toggle. */
export async function setStudentCanManageReports(parentId: string, value: boolean): Promise<void> {
  if (isFirebaseConfigured) {
    await setStudentCanManageReportsFirebase(parentId, value)
  } else {
    setStudentCanManageReportsMock(parentId, value)
  }
}

/**
 * Who has confirmation authority (and financial responsibility framing)
 * for a student's next lesson report — their first linked parent if one
 * exists, otherwise the student themselves. Called once, at report-
 * submission time, and frozen onto the lesson (see Lesson.confirmingPartyId
 * and Lesson.studentCanManageReport in lib/types.ts) so a parent linking
 * later — or flipping their "let the student manage it too" setting later
 * — doesn't retroactively change responsibility for lessons already in
 * flight. `studentCanManage` is only meaningful (and only fetched) when a
 * parent is actually the confirming party; a student with no linked
 * parent always manages their own report, so it's `true` unconditionally
 * in that branch.
 */
export async function resolveConfirmingParty(studentId: string): Promise<{ id: string; role: 'student' | 'parent'; studentCanManage: boolean }> {
  const parentIds = isFirebaseConfigured ? await getLinkedParentIdsFirebase(studentId) : getLinkedParentIdsMock(studentId)
  if (parentIds.length > 0) {
    const parentId = parentIds[0]
    const studentCanManage = await getStudentCanManageReports(parentId)
    return { id: parentId, role: 'parent', studentCanManage }
  }
  return { id: studentId, role: 'student', studentCanManage: true }
}
