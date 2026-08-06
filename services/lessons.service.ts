import { addDoc, collection, getDocs, query, where } from 'firebase/firestore'
import { studentLessonsData, studentStatsData, teacherDashboardDataMock } from '@/data/lessons.data'
import { teachersData } from '@/data/teachers.data'
import { collections, db, isFirebaseConfigured } from '@/lib/firebase'
import { getTeacherApplication } from '@/services/teachers.service'
import { createNotification } from '@/services/notifications.service'
import { transferLessonPayment } from '@/services/wallet.service'
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

async function createBookingMock(input: LessonBookingInput): Promise<Lesson> {
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

  await transferLessonPayment(input.studentId, input.teacherId, input.price, input.teacherName, input.topic)

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

  // Notify the teacher — this only reaches a real inbox for teachers who
  // applied for real (their Firestore doc id / `teacherId` here is their
  // actual auth uid, per resolveTeacherCatalogId's docs above); for the
  // legacy static demo catalog there's no matching real account to notify.
  createNotification({
    userId: input.teacherId,
    type: 'lesson',
    title: 'Nowa rezerwacja lekcji',
    description: `${input.studentName} zarezerwował(a) lekcję „${input.topic}" — ${input.date} o ${input.time}.`,
  })

  // Moves the price from the student's wallet to the teacher's — the
  // simulated payment transfer.
  await transferLessonPayment(input.studentId, input.teacherId, input.price, input.teacherName, input.topic)

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

async function getTeacherDashboardFirebase(teacherName?: string, userId?: string): Promise<TeacherDashboardData> {
  // No name means this is the initial server-rendered fetch (no signed-in
  // user context is available during SSR, so a `lessons` query would be
  // rejected by security rules anyway). Return the baseline immediately —
  // the real per-teacher data is re-fetched client-side once the signed-in
  // user is known (see components/dashboard/teacher-lessons-section.tsx).
  if (!db || !teacherName) return teacherDashboardDataMock

  // Real rating/reviewCount/completionRate come from the teacher's own
  // Firestore application doc (`teachers/{uid}`) — the shared mock dataset's
  // numbers belong to a fictional "Marek Kowalski" character and have
  // nothing to do with whoever is actually signed in. Earnings figures stay
  // demo throughout — there's no real payment processing yet.
  const ratingOverride = userId ? await getTeacherApplication(userId) : undefined

  const catalogId = resolveTeacherCatalogId(teacherName)
  const snap = await getDocs(query(collection(db, collections.lessons), where('teacherId', '==', catalogId)))
  const bookings = snap.docs.map((d) => {
    const data = d.data()
    return { id: d.id, studentName: data.studentName, topic: data.topic, date: data.date, time: data.time, duration: data.duration, price: data.price }
  })

  const base = bookings.length === 0 ? teacherDashboardDataMock : { ...teacherDashboardDataMock, upcomingLessons: [...bookings, ...teacherDashboardDataMock.upcomingLessons] }
  if (!ratingOverride) return base
  return {
    ...base,
    rating: ratingOverride.rating,
    reviewCount: ratingOverride.reviewCount,
    completionRate: ratingOverride.completionRate,
  }
}

// ── Public API ────────────────────────────────────────────────

export async function getStudentLessons(userId?: string): Promise<Lesson[]> {
  return isFirebaseConfigured ? getStudentLessonsFirebase(userId) : getStudentLessonsMock(userId)
}

/**
 * Lesson-count/hours/teacher-count are real, computed from the
 * student's actual Firestore `lessons` docs. Everything else here
 * (certificates, streak, BeePoints, wallet balance, category
 * progress) has no underlying tracking system yet, so it stays the
 * demo baseline — those aren't things this function can honestly
 * compute today.
 */
export async function getStudentStats(userId?: string): Promise<StudentStats> {
  if (!isFirebaseConfigured || !userId) return studentStatsData
  const lessons = await getStudentLessonsFirebase(userId)
  if (lessons.length === 0) return { ...studentStatsData, totalLessons: 0, hoursLearned: 0, teachersWorkedWith: 0 }
  const totalLessons = lessons.length
  const hoursLearned = Math.round((lessons.reduce((sum, l) => sum + l.duration, 0) / 60) * 10) / 10
  const teachersWorkedWith = new Set(lessons.map((l) => l.teacherName)).size
  return { ...studentStatsData, totalLessons, hoursLearned, teachersWorkedWith }
}

export async function getTeacherDashboard(teacherName?: string, userId?: string): Promise<TeacherDashboardData> {
  return isFirebaseConfigured ? getTeacherDashboardFirebase(teacherName, userId) : getTeacherDashboardMock(teacherName)
}

/** Creates a real, persisted lesson booking from a student's chosen date/time slot on a teacher's profile. */
export async function createBooking(input: LessonBookingInput): Promise<Lesson> {
  return isFirebaseConfigured ? createBookingFirebase(input) : createBookingMock(input)
}
