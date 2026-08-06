import { addDoc, collection, doc, getDoc, getDocs, query, updateDoc, where } from 'firebase/firestore'
import { studentLessonsData, studentStatsData, teacherDashboardDataMock, teacherLessonsData } from '@/data/lessons.data'
import { teachersData } from '@/data/teachers.data'
import { collections, db, isFirebaseConfigured } from '@/lib/firebase'
import { getTeacherApplication } from '@/services/teachers.service'
import { createNotification } from '@/services/notifications.service'
import { transferLessonPayment } from '@/services/wallet.service'
import type { Lesson, LessonBookingInput, LessonChangeRequest, StudentStats, TeacherDashboardData } from '@/lib/types'

// ─────────────────────────────────────────────────────────────
// Data-access layer for lessons/bookings.
//
// Lifecycle (see LessonStatus in lib/types.ts):
//   pending → upcoming → completed
//                 ↘ cancelled
//
// `createBooking` only ever produces a `pending` lesson — nothing is
// confirmed and no money moves yet. The teacher gets a real
// notification and must accept/reject it (respondToBookingRequest).
// Once confirmed, either side can request a cancel/reschedule
// (requestLessonChange), which again needs the other party's
// confirmation (respondToLessonChange). Payment only actually moves
// from the student's wallet to the teacher's when the lesson is
// marked completed (completeLesson) — i.e. when the call ends, see
// components/lesson/lesson-room-client.tsx.
// ─────────────────────────────────────────────────────────────

const DEMO_STUDENT_ID = 'u3'

function isBrowser() {
  return typeof window !== 'undefined'
}

function studentBookingsKey(studentId: string) {
  return `techbee.lessons.student.${studentId}`
}

function teacherBookingsKey(teacherCatalogId: string) {
  return `techbee.lessons.teacherCatalog.${teacherCatalogId}`
}

function readLocal<T>(key: string): T[] {
  if (!isBrowser()) return []
  try {
    return JSON.parse(window.localStorage.getItem(key) ?? '[]') as T[]
  } catch {
    return []
  }
}

function writeLocal<T>(key: string, value: T[]) {
  if (!isBrowser()) return
  window.localStorage.setItem(key, JSON.stringify(value))
}

/** Lesson docs are duplicated across the student's and teacher's localStorage keys in mock mode, so an update (status/pendingChange change) has to patch every key that might hold a copy. */
function updateLocalLesson(id: string, patch: Partial<Lesson>): Lesson | undefined {
  if (!isBrowser()) return undefined
  let updated: Lesson | undefined
  for (const storageKey of readAllLocalLessonKeys()) {
    const list = readLocal<Lesson>(storageKey)
    const idx = list.findIndex((l) => l.id === id)
    if (idx !== -1) {
      list[idx] = { ...list[idx], ...patch }
      updated = list[idx]
      writeLocal(storageKey, list)
    }
  }
  return updated
}

function readAllLocalLessonKeys(): string[] {
  if (!isBrowser()) return []
  return Object.keys(window.localStorage).filter((k) => k.startsWith('techbee.lessons.'))
}

/** Best-effort bridge between a signed-in teacher account and its entry in the teacher catalog (matched by name) — mock mode only. */
function resolveTeacherCatalogId(teacherName?: string): string {
  if (!teacherName) return teachersData[0]?.id ?? '1'
  return teachersData.find((t) => t.name === teacherName)?.id ?? teachersData[0]?.id ?? '1'
}

// ── Mock (localStorage) ──────────────────────────────────────

async function createBookingMock(input: LessonBookingInput): Promise<Lesson> {
  const lesson: Lesson = {
    id: `local-${Date.now()}`,
    teacherId: input.teacherId,
    studentId: input.studentId,
    teacherName: input.teacherName,
    studentName: input.studentName,
    teacherInitials: input.teacherInitials,
    teacherColor: input.teacherColor,
    specialty: input.specialty,
    date: input.date,
    time: input.time,
    duration: input.duration,
    status: 'pending',
    price: input.price,
    topic: input.topic,
  }
  writeLocal(studentBookingsKey(input.studentId), [lesson, ...readLocal<Lesson>(studentBookingsKey(input.studentId))])
  writeLocal(teacherBookingsKey(input.teacherId), [lesson, ...readLocal<Lesson>(teacherBookingsKey(input.teacherId))])
  return lesson
}

function getStudentLessonsMock(userId?: string): Lesson[] {
  const local = userId ? readLocal<Lesson>(studentBookingsKey(userId)) : []
  const base = !userId || userId === DEMO_STUDENT_ID ? studentLessonsData : []
  return [...local, ...base]
}

function getTeacherLessonsMock(teacherName?: string): Lesson[] {
  const catalogId = resolveTeacherCatalogId(teacherName)
  const local = readLocal<Lesson>(teacherBookingsKey(catalogId))
  return [...local, ...teacherLessonsData]
}

// ── Firebase ──────────────────────────────────────────────────

function mapLessonDoc(id: string, data: Record<string, unknown>): Lesson {
  return {
    id,
    teacherId: (data.teacherId as string) ?? '',
    studentId: (data.studentId as string) ?? '',
    teacherName: data.teacherName as string,
    studentName: (data.studentName as string) ?? '',
    teacherInitials: data.teacherInitials as string,
    teacherColor: data.teacherColor as string,
    specialty: data.specialty as string,
    date: data.date as string,
    time: data.time as string,
    duration: data.duration as number,
    status: (data.status as Lesson['status']) ?? 'upcoming',
    price: data.price as number,
    topic: data.topic as string,
    pendingChange: data.pendingChange as LessonChangeRequest | undefined,
  }
}

async function createBookingFirebase(input: LessonBookingInput): Promise<Lesson> {
  if (!db) throw new Error('Firebase nie jest skonfigurowane.')
  const payload = {
    teacherId: input.teacherId,
    teacherName: input.teacherName,
    teacherInitials: input.teacherInitials,
    teacherColor: input.teacherColor,
    specialty: input.specialty,
    studentId: input.studentId,
    studentName: input.studentName,
    date: input.date,
    time: input.time,
    duration: input.duration,
    price: input.price,
    topic: input.topic,
    status: 'pending' as const,
    createdAt: Date.now(),
  }
  const ref = await addDoc(collection(db, collections.lessons), payload)

  // Notify the teacher that a booking is awaiting their confirmation — this
  // only reaches a real inbox for teachers who applied for real (their
  // Firestore doc id / `teacherId` here is their actual auth uid); for the
  // legacy static demo catalog there's no matching real account to notify.
  createNotification({
    userId: input.teacherId,
    type: 'lesson',
    title: 'Nowa prośba o rezerwację',
    description: `${input.studentName} prosi o lekcję „${input.topic}" — ${input.date} o ${input.time}. Potwierdź lub odrzuć w panelu.`,
  })

  return { id: ref.id, ...payload }
}

async function getStudentLessonsFirebase(userId?: string): Promise<Lesson[]> {
  if (!db || !userId) return []
  const snap = await getDocs(query(collection(db, collections.lessons), where('studentId', '==', userId)))
  return snap.docs.map((d) => mapLessonDoc(d.id, d.data()))
}

async function getTeacherLessonsFirebase(teacherId?: string): Promise<Lesson[]> {
  if (!db || !teacherId) return []
  const snap = await getDocs(query(collection(db, collections.lessons), where('teacherId', '==', teacherId)))
  return snap.docs.map((d) => mapLessonDoc(d.id, d.data()))
}

async function getLessonByIdFirebase(id: string): Promise<Lesson | undefined> {
  if (!db) return undefined
  const snap = await getDoc(doc(db, collections.lessons, id))
  return snap.exists() ? mapLessonDoc(snap.id, snap.data()) : undefined
}

// ── Public API ────────────────────────────────────────────────

export async function getStudentLessons(userId?: string): Promise<Lesson[]> {
  return isFirebaseConfigured ? getStudentLessonsFirebase(userId) : getStudentLessonsMock(userId)
}

/** The signed-in teacher's own lessons across every status — replaces the old ad-hoc upcomingLessons/pendingRequests split baked into TeacherDashboardData; the UI filters by `status`/`pendingChange` itself. */
export async function getTeacherLessons(teacherId?: string, teacherName?: string): Promise<Lesson[]> {
  return isFirebaseConfigured ? getTeacherLessonsFirebase(teacherId) : getTeacherLessonsMock(teacherName)
}

export async function getLessonById(id: string): Promise<Lesson | undefined> {
  if (!isFirebaseConfigured) {
    const keys = readAllLocalLessonKeys()
    for (const key of keys) {
      const found = readLocal<Lesson>(key).find((l) => l.id === id)
      if (found) return found
    }
    return [...studentLessonsData, ...teacherLessonsData].find((l) => l.id === id)
  }
  return getLessonByIdFirebase(id)
}

/**
 * Lesson-count/hours/teacher-count are real, computed from the
 * student's actual completed/upcoming Firestore `lessons` docs
 * (cancelled ones don't count — they never happened). Everything
 * else here (certificates, streak, BeePoints, wallet balance,
 * category progress) has no underlying tracking system yet, so it
 * stays the demo baseline.
 */
export async function getStudentStats(userId?: string): Promise<StudentStats> {
  if (!isFirebaseConfigured || !userId) return studentStatsData
  const lessons = (await getStudentLessonsFirebase(userId)).filter((l) => l.status !== 'cancelled')
  if (lessons.length === 0) return { ...studentStatsData, totalLessons: 0, hoursLearned: 0, teachersWorkedWith: 0 }
  const totalLessons = lessons.length
  const hoursLearned = Math.round((lessons.reduce((sum, l) => sum + l.duration, 0) / 60) * 10) / 10
  const teachersWorkedWith = new Set(lessons.map((l) => l.teacherName)).size
  return { ...studentStatsData, totalLessons, hoursLearned, teachersWorkedWith }
}

/** Rating/earnings summary only — the lesson list is fetched separately via getTeacherLessons. */
export async function getTeacherDashboard(teacherName?: string, userId?: string): Promise<TeacherDashboardData> {
  if (!isFirebaseConfigured || !userId) return teacherDashboardDataMock
  // Real rating/reviewCount/completionRate come from the teacher's own
  // Firestore application doc — the shared mock dataset's numbers belong to
  // a fictional "Marek Kowalski" character. Earnings figures stay demo —
  // there's no real payment processing, only the simulated wallet transfer.
  const application = await getTeacherApplication(userId)
  if (!application) return teacherDashboardDataMock
  return {
    ...teacherDashboardDataMock,
    rating: application.rating,
    reviewCount: application.reviewCount,
    completionRate: application.completionRate,
  }
}

/** Creates a real, persisted lesson *request* — status starts at 'pending' and only becomes a confirmed booking once the teacher accepts it. */
export async function createBooking(input: LessonBookingInput): Promise<Lesson> {
  return isFirebaseConfigured ? createBookingFirebase(input) : createBookingMock(input)
}

/** Teacher accepts/rejects a pending booking request. No wallet movement either way — money only moves at completion. */
export async function respondToBookingRequest(lesson: Lesson, decision: 'accepted' | 'rejected'): Promise<void> {
  const nextStatus = decision === 'accepted' ? 'upcoming' : 'cancelled'
  if (isFirebaseConfigured && db) {
    await updateDoc(doc(db, collections.lessons, lesson.id), { status: nextStatus })
  } else {
    updateLocalLesson(lesson.id, { status: nextStatus })
  }
  createNotification({
    userId: lesson.studentId,
    type: 'lesson',
    title: decision === 'accepted' ? 'Lekcja potwierdzona!' : 'Prośba o lekcję odrzucona',
    description: decision === 'accepted'
      ? `${lesson.teacherName} potwierdził(a) lekcję „${lesson.topic}" — ${lesson.date} o ${lesson.time}.`
      : `${lesson.teacherName} nie może przeprowadzić lekcji „${lesson.topic}" w tym terminie.`,
  })
}

/** Either party requests a cancel/reschedule of an upcoming lesson — sits on the doc until the *other* party responds. */
export async function requestLessonChange(lesson: Lesson, requestedBy: 'student' | 'teacher', change: Omit<LessonChangeRequest, 'requestedBy'>): Promise<void> {
  const pendingChange: LessonChangeRequest = { ...change, requestedBy }
  if (isFirebaseConfigured && db) {
    await updateDoc(doc(db, collections.lessons, lesson.id), { pendingChange })
  } else {
    updateLocalLesson(lesson.id, { pendingChange })
  }
  const recipientId = requestedBy === 'student' ? lesson.teacherId : lesson.studentId
  const requesterLabel = requestedBy === 'student' ? lesson.studentName : lesson.teacherName
  const actionLabel = change.type === 'cancel' ? 'odwołanie' : 'przełożenie'
  createNotification({
    userId: recipientId,
    type: 'lesson',
    title: `Prośba o ${actionLabel} lekcji`,
    description: `${requesterLabel} prosi o ${actionLabel} lekcji „${lesson.topic}"${change.newDate ? ` na ${change.newDate}${change.newTime ? ` o ${change.newTime}` : ''}` : ''}. Potwierdź lub odrzuć w panelu.`,
  })
}

/** The party who *didn't* request the change accepts/rejects it. */
export async function respondToLessonChange(lesson: Lesson, decision: 'accepted' | 'rejected'): Promise<void> {
  const change = lesson.pendingChange
  if (!change) return

  // Firestore rejects `undefined` field values (see toParticipant() in
  // chat.service.ts for the same gotcha) — `null` is how a field gets
  // cleared instead.
  const firestorePatch: Record<string, unknown> = { pendingChange: null }
  const localPatch: Partial<Lesson> = { pendingChange: undefined }
  if (decision === 'accepted' && change.type === 'cancel') {
    firestorePatch.status = 'cancelled'
    localPatch.status = 'cancelled'
  } else if (decision === 'accepted' && change.type === 'reschedule') {
    firestorePatch.date = change.newDate ?? lesson.date
    firestorePatch.time = change.newTime ?? lesson.time
    localPatch.date = change.newDate ?? lesson.date
    localPatch.time = change.newTime ?? lesson.time
  }

  if (isFirebaseConfigured && db) {
    await updateDoc(doc(db, collections.lessons, lesson.id), firestorePatch as Record<string, string>)
  } else {
    updateLocalLesson(lesson.id, localPatch)
  }

  const requesterId = change.requestedBy === 'student' ? lesson.studentId : lesson.teacherId
  const responderLabel = change.requestedBy === 'student' ? lesson.teacherName : lesson.studentName
  const actionLabel = change.type === 'cancel' ? 'odwołanie' : 'przełożenie'
  createNotification({
    userId: requesterId,
    type: 'lesson',
    title: decision === 'accepted' ? `Prośba o ${actionLabel} zaakceptowana` : `Prośba o ${actionLabel} odrzucona`,
    description: decision === 'accepted'
      ? `${responderLabel} zaakceptował(a) Twoją prośbę dotyczącą lekcji „${lesson.topic}".`
      : `${responderLabel} odrzucił(a) Twoją prośbę dotyczącą lekcji „${lesson.topic}".`,
  })
}

/**
 * Marks a lesson completed and moves its price from the student's
 * wallet to the teacher's — the one point where the simulated
 * payment actually happens (see services/wallet.service.ts). Called
 * when a call ends in the lesson room. Idempotent: does nothing if
 * the lesson is already completed/cancelled or can't be found.
 */
export async function completeLesson(lessonId: string): Promise<void> {
  const lesson = await getLessonById(lessonId)
  if (!lesson || lesson.status === 'completed' || lesson.status === 'cancelled') return

  if (isFirebaseConfigured && db) {
    await updateDoc(doc(db, collections.lessons, lessonId), { status: 'completed' })
  } else {
    updateLocalLesson(lessonId, { status: 'completed' })
  }

  await transferLessonPayment(lesson.studentId, lesson.teacherId, lesson.price, lesson.teacherName, lesson.topic)

  createNotification({
    userId: lesson.teacherId,
    type: 'payment',
    title: 'Otrzymano płatność',
    description: `Otrzymano ${lesson.price} zł za lekcję „${lesson.topic}" z ${lesson.studentName}.`,
  })
  createNotification({
    userId: lesson.studentId,
    type: 'payment',
    title: 'Lekcja zakończona — płatność pobrana',
    description: `Z portfela pobrano ${lesson.price} zł za lekcję „${lesson.topic}" z ${lesson.teacherName}.`,
  })
}
