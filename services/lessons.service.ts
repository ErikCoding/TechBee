import { addDoc, collection, getDocs, query, where } from 'firebase/firestore'
import { studentLessonsData, studentStatsData, teacherDashboardDataMock } from '@/data/lessons.data'
import { teachersData } from '@/data/teachers.data'
import { collections, db, isFirebaseConfigured } from '@/lib/firebase'
import type { Lesson, LessonBookingInput, StudentStats, TeacherDashboardData } from '@/lib/types'

// ─────────────────────────────────────────────────────────────
// Data-access layer for lessons/bookings.
//
// `createBooking` is the one genuinely new write path here: a
// student picks a date/time on a teacher's profile and it produces
// a real `Lesson` record, scoped to that student (and mirrored for
// that teacher), that shows up on the dashboards afterwards.
//
// Everything else keeps the platform's rich static demo data as a
// baseline (so the seeded demo accounts still look populated) and
// merges any bookings made during the session on top of it.
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

/** Best-effort bridge between a signed-in teacher account and its entry in the teacher catalog (matched by name). */
function resolveTeacherCatalogId(teacherName?: string): string {
  if (!teacherName) return teachersData[0]?.id ?? '1'
  return teachersData.find((t) => t.name === teacherName)?.id ?? teachersData[0]?.id ?? '1'
}

// ── Mock (localStorage) ──────────────────────────────────────

function createBookingMock(input: LessonBookingInput): Lesson {
  const lesson: Lesson = {
    id: `local-${Date.now()}`,
    teacherName: input.teacherName,
    teacherInitials: input.teacherInitials,
    teacherColor: input.teacherColor,
    specialty: input.specialty,
    date: input.date,
    time: input.time,
    duration: input.duration,
    status: 'upcoming',
    price: input.price,
    topic: input.topic,
  }
  writeLocal(studentBookingsKey(input.studentId), [lesson, ...readLocal<Lesson>(studentBookingsKey(input.studentId))])

  const teacherRecord = {
    id: lesson.id,
    studentName: input.studentName,
    topic: input.topic,
    date: input.date,
    time: input.time,
    duration: input.duration,
    price: input.price,
  }
  writeLocal(teacherBookingsKey(input.teacherId), [
    teacherRecord,
    ...readLocal<typeof teacherRecord>(teacherBookingsKey(input.teacherId)),
  ])

  return lesson
}

function getStudentLessonsMock(userId?: string): Lesson[] {
  const local = userId ? readLocal<Lesson>(studentBookingsKey(userId)) : []
  const base = !userId || userId === DEMO_STUDENT_ID ? studentLessonsData : []
  return [...local, ...base]
}

function getTeacherDashboardMock(teacherName?: string): TeacherDashboardData {
  const catalogId = resolveTeacherCatalogId(teacherName)
  const local = readLocal<{ id: string; studentName: string; topic: string; date: string; time: string; duration: number; price: number }>(
    teacherBookingsKey(catalogId),
  )
  if (local.length === 0) return teacherDashboardDataMock
  return {
    ...teacherDashboardDataMock,
    upcomingLessons: [...local, ...teacherDashboardDataMock.upcomingLessons],
  }
}

// ── Firebase ──────────────────────────────────────────────────

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
    status: 'upcoming' as const,
    createdAt: Date.now(),
  }
  const ref = await addDoc(collection(db, collections.lessons), payload)
  return {
    id: ref.id,
    teacherName: payload.teacherName,
    teacherInitials: payload.teacherInitials,
    teacherColor: payload.teacherColor,
    specialty: payload.specialty,
    date: payload.date,
    time: payload.time,
    duration: payload.duration,
    status: 'upcoming',
    price: payload.price,
    topic: payload.topic,
  }
}

async function getStudentLessonsFirebase(userId?: string): Promise<Lesson[]> {
  if (!db || !userId) return []
  const snap = await getDocs(query(collection(db, collections.lessons), where('studentId', '==', userId)))
  return snap.docs.map((d) => {
    const data = d.data()
    return {
      id: d.id,
      teacherName: data.teacherName,
      teacherInitials: data.teacherInitials,
      teacherColor: data.teacherColor,
      specialty: data.specialty,
      date: data.date,
      time: data.time,
      duration: data.duration,
      status: data.status,
      price: data.price,
      topic: data.topic,
    } satisfies Lesson
  })
}

async function getTeacherDashboardFirebase(teacherName?: string): Promise<TeacherDashboardData> {
  // No name means this is the initial server-rendered fetch (no signed-in
  // user context is available during SSR, so a `lessons` query would be
  // rejected by security rules anyway). Return the baseline immediately —
  // the real per-teacher data is re-fetched client-side once the signed-in
  // user is known (see components/dashboard/teacher-lessons-section.tsx).
  if (!db || !teacherName) return teacherDashboardDataMock
  const catalogId = resolveTeacherCatalogId(teacherName)
  const snap = await getDocs(query(collection(db, collections.lessons), where('teacherId', '==', catalogId)))
  const bookings = snap.docs.map((d) => {
    const data = d.data()
    return { id: d.id, studentName: data.studentName, topic: data.topic, date: data.date, time: data.time, duration: data.duration, price: data.price }
  })
  if (bookings.length === 0) return teacherDashboardDataMock
  return { ...teacherDashboardDataMock, upcomingLessons: [...bookings, ...teacherDashboardDataMock.upcomingLessons] }
}

// ── Public API ────────────────────────────────────────────────

export async function getStudentLessons(userId?: string): Promise<Lesson[]> {
  return isFirebaseConfigured ? getStudentLessonsFirebase(userId) : getStudentLessonsMock(userId)
}

export async function getStudentStats(_userId?: string): Promise<StudentStats> {
  // TODO(firebase): aggregate from `lessons` + `users/{uid}` doc, or a Cloud Function
  return studentStatsData
}

export async function getTeacherDashboard(teacherName?: string): Promise<TeacherDashboardData> {
  return isFirebaseConfigured ? getTeacherDashboardFirebase(teacherName) : getTeacherDashboardMock(teacherName)
}

/** Creates a real, persisted lesson booking from a student's chosen date/time slot on a teacher's profile. */
export async function createBooking(input: LessonBookingInput): Promise<Lesson> {
  return isFirebaseConfigured ? createBookingFirebase(input) : createBookingMock(input)
}
