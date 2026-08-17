import { addDoc, collection, doc, getDoc, getDocs, query, updateDoc, where } from 'firebase/firestore'
import { studentLessonsData, studentStatsData, teacherDashboardDataMock, teacherLessonsData } from '@/data/lessons.data'
import { teachersData } from '@/data/teachers.data'
import { collections, db, isFirebaseConfigured } from '@/lib/firebase'
import { getTeacherApplication, submitTeacherReview } from '@/services/teachers.service'
import { createNotification } from '@/services/notifications.service'
import { holdLessonPayment, refundLessonPayment, releaseLessonPayment } from '@/services/wallet.service'
import { resolveConfirmingParty } from '@/services/family-link.service'
import type { Lesson, LessonBookingInput, LessonChangeRequest, LessonDispute, LessonDisputeReason, LessonReport, StudentStats, TeacherDashboardData } from '@/lib/types'

// ─────────────────────────────────────────────────────────────
// Data-access layer for lessons/bookings.
//
// Lifecycle (see LessonStatus in lib/types.ts):
//   pending → upcoming → completed
//                 ↘ cancelled
//
// `createBooking` places an escrow hold on the payer's wallet right
// away (see holdLessonPayment in wallet.service.ts) — the payer is
// whoever booked (a student, or a linked parent booking on their
// behalf, see LessonBookingInput.payer). The teacher gets a real
// notification and must accept/reject the request
// (respondToBookingRequest) — a rejection refunds the hold. Once
// confirmed, either side can request a cancel/reschedule
// (requestLessonChange → respondToLessonChange); an accepted cancel
// also refunds the hold. When the call ends (completeLesson), the
// lesson becomes `completed` but the held payment is *not* released
// yet — the teacher still owes a report (submitLessonReport), and
// only once that report is confirmed (confirmLessonReport, disputed
// via disputeLessonReport + admin resolveDispute, or auto-confirmed
// after 24h — see autoConfirmOverdueReports) does the money actually
// move to the teacher.
// ─────────────────────────────────────────────────────────────

const DEMO_STUDENT_ID = 'u3'
const REPORT_AUTO_CONFIRM_MS = 24 * 60 * 60 * 1000

function isBrowser() {
  return typeof window !== 'undefined'
}

function studentBookingsKey(studentId: string) {
  return `techbee.lessons.student.${studentId}`
}

function teacherBookingsKey(teacherCatalogId: string) {
  return `techbee.lessons.teacherCatalog.${teacherCatalogId}`
}

function parentBookingsKey(parentId: string) {
  return `techbee.lessons.parent.${parentId}`
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
  const payer = input.payer ?? { id: input.studentId, role: 'student' as const }
  const holdTransactionId = await holdLessonPayment(payer.id, input.price, input.topic)
  if (!holdTransactionId) throw new Error('Niewystarczające środki na koncie płacącego — doładuj portfel.')

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
    createdAt: Date.now(),
    payerId: payer.id,
    payerRole: payer.role,
    holdTransactionId,
  }
  writeLocal(studentBookingsKey(input.studentId), [lesson, ...readLocal<Lesson>(studentBookingsKey(input.studentId))])
  writeLocal(teacherBookingsKey(input.teacherId), [lesson, ...readLocal<Lesson>(teacherBookingsKey(input.teacherId))])
  if (payer.role === 'parent') {
    writeLocal(parentBookingsKey(payer.id), [lesson, ...readLocal<Lesson>(parentBookingsKey(payer.id))])
  }
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

function getParentLessonsMock(parentId?: string): Lesson[] {
  if (!parentId) return []
  return readLocal<Lesson>(parentBookingsKey(parentId))
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
    createdAt: data.createdAt as number | undefined,
    completedAt: data.completedAt as number | undefined,
    reviewed: data.reviewed as boolean | undefined,
    payerId: data.payerId as string | undefined,
    payerRole: data.payerRole as Lesson['payerRole'],
    holdTransactionId: data.holdTransactionId as string | undefined,
    paymentReleased: data.paymentReleased as boolean | undefined,
    report: data.report as LessonReport | undefined,
    reportSubmittedAt: data.reportSubmittedAt as number | undefined,
    confirmingPartyId: data.confirmingPartyId as string | undefined,
    confirmingPartyRole: data.confirmingPartyRole as Lesson['confirmingPartyRole'],
    reportConfirmedAt: data.reportConfirmedAt as number | undefined,
    dispute: data.dispute as LessonDispute | undefined,
  }
}

async function createBookingFirebase(input: LessonBookingInput): Promise<Lesson> {
  if (!db) throw new Error('Firebase nie jest skonfigurowane.')
  const payer = input.payer ?? { id: input.studentId, role: 'student' as const }
  const holdTransactionId = await holdLessonPayment(payer.id, input.price, input.topic)
  if (!holdTransactionId) throw new Error('Niewystarczające środki na koncie płacącego — doładuj portfel.')

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
    payerId: payer.id,
    payerRole: payer.role,
    holdTransactionId,
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

async function getParentLessonsFirebase(parentId?: string): Promise<Lesson[]> {
  if (!db || !parentId) return []
  const snap = await getDocs(query(collection(db, collections.lessons), where('payerId', '==', parentId)))
  return snap.docs.map((d) => mapLessonDoc(d.id, d.data()))
}

async function getLessonByIdFirebase(id: string): Promise<Lesson | undefined> {
  if (!db) return undefined
  const snap = await getDoc(doc(db, collections.lessons, id))
  return snap.exists() ? mapLessonDoc(snap.id, snap.data()) : undefined
}

// ── Escrow report auto-confirmation (lazy, no cron needed) ──────
//
// There's no scheduled-function infra in this stack, so the
// blueprint's "24h auto-confirm" rule is enforced opportunistically:
// every time a lesson list (or a single lesson) is fetched, any
// report that's been sitting unconfirmed/undisputed past the window
// is finalized right there before the result is returned.

async function finalizeReportConfirmation(lesson: Lesson): Promise<void> {
  const payerId = lesson.payerId ?? lesson.studentId
  await updateLessonDoc(lesson.id, { reportConfirmedAt: Date.now(), paymentReleased: true })
  await releaseLessonPayment(payerId, lesson.teacherId, lesson.teacherName, lesson.price, lesson.topic, lesson.holdTransactionId)
  createNotification({
    userId: lesson.teacherId,
    type: 'payment',
    title: 'Płatność zwolniona',
    description: `Otrzymano ${lesson.price} zł za lekcję „${lesson.topic}" z ${lesson.studentName}.`,
  })
}

async function autoConfirmIfOverdue(lesson: Lesson): Promise<Lesson> {
  if (!lesson.report || lesson.reportConfirmedAt || lesson.dispute || !lesson.reportSubmittedAt) return lesson
  if (Date.now() - lesson.reportSubmittedAt < REPORT_AUTO_CONFIRM_MS) return lesson
  await finalizeReportConfirmation(lesson)
  return { ...lesson, reportConfirmedAt: Date.now(), paymentReleased: true }
}

async function autoConfirmOverdueReports(lessons: Lesson[]): Promise<Lesson[]> {
  if (lessons.length === 0) return lessons
  return Promise.all(lessons.map(autoConfirmIfOverdue))
}

/** Writes a partial update to a lesson doc in whichever mode is active — `null` clears a field in Firestore (see respondToLessonChange for why). */
/**
 * Firestore's `updateDoc` throws ("Unsupported field value: undefined")
 * the moment ANY value in the patch — even nested inside an object, like
 * `report.homework` when the teacher left it blank — is `undefined`.
 * `report`/`dispute` are built with optional fields set to `undefined`
 * when empty (see LessonReportModal), so every report submission was
 * silently failing in Firebase mode (mock/localStorage mode never hit
 * this, since JSON.stringify drops undefined keys, which is why the bug
 * wasn't obvious there). Recursively dropping undefined keys before the
 * write — instead of requiring every call site to remember to omit them
 * — fixes this class of bug for good.
 */
function stripUndefinedDeep<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map((v) => stripUndefinedDeep(v)) as unknown as T
  }
  if (value !== null && typeof value === 'object' && !(value instanceof Date)) {
    const result: Record<string, unknown> = {}
    for (const [key, v] of Object.entries(value as Record<string, unknown>)) {
      if (v === undefined) continue
      result[key] = stripUndefinedDeep(v)
    }
    return result as T
  }
  return value
}

async function updateLessonDoc(id: string, patch: Record<string, unknown>): Promise<void> {
  if (isFirebaseConfigured && db) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Firestore's updateDoc field-path typing can't express an arbitrary partial patch object; see the same cast pattern above in respondToLessonChange's predecessor.
    await updateDoc(doc(db, collections.lessons, id), stripUndefinedDeep(patch) as any)
  } else {
    updateLocalLesson(id, patch as Partial<Lesson>)
  }
}

// ── Public API ────────────────────────────────────────────────

export async function getStudentLessons(userId?: string): Promise<Lesson[]> {
  const lessons = isFirebaseConfigured ? await getStudentLessonsFirebase(userId) : getStudentLessonsMock(userId)
  return autoConfirmOverdueReports(lessons)
}

/** The signed-in teacher's own lessons across every status — replaces the old ad-hoc upcomingLessons/pendingRequests split baked into TeacherDashboardData; the UI filters by `status`/`pendingChange` itself. */
export async function getTeacherLessons(teacherId?: string, teacherName?: string): Promise<Lesson[]> {
  const lessons = isFirebaseConfigured ? await getTeacherLessonsFirebase(teacherId) : getTeacherLessonsMock(teacherName)
  return autoConfirmOverdueReports(lessons)
}

/** Lessons a parent has personally booked/paid for (across any of their linked students) — see services/family-link.service.ts for the linking itself. */
export async function getParentLessons(parentId?: string): Promise<Lesson[]> {
  const lessons = isFirebaseConfigured ? await getParentLessonsFirebase(parentId) : getParentLessonsMock(parentId)
  return autoConfirmOverdueReports(lessons)
}

export async function getLessonById(id: string): Promise<Lesson | undefined> {
  const lesson = isFirebaseConfigured
    ? await getLessonByIdFirebase(id)
    : readAllLocalLessonKeys().map((key) => readLocal<Lesson>(key).find((l) => l.id === id)).find(Boolean) ?? [...studentLessonsData, ...teacherLessonsData].find((l) => l.id === id)
  if (!lesson) return undefined
  return autoConfirmIfOverdue(lesson)
}

/** Every lesson with an open dispute, across every teacher/student — the admin disputes queue (see app/admin/disputes). */
export async function getOpenDisputes(): Promise<Lesson[]> {
  if (isFirebaseConfigured) {
    if (!db) return []
    const snap = await getDocs(query(collection(db, collections.lessons), where('dispute.status', '==', 'open')))
    return snap.docs.map((d) => mapLessonDoc(d.id, d.data()))
  }
  const seen = new Map<string, Lesson>()
  for (const key of readAllLocalLessonKeys()) {
    for (const lesson of readLocal<Lesson>(key)) {
      if (lesson.dispute?.status === 'open') seen.set(lesson.id, lesson)
    }
  }
  return [...seen.values()]
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

const MONTH_LABELS_PL = ['Sty', 'Lut', 'Mar', 'Kwi', 'Maj', 'Cze', 'Lip', 'Sie', 'Wrz', 'Paź', 'Lis', 'Gru']

/**
 * Real earnings/activity figures computed straight from the teacher's own
 * lesson docs — no demo baseline involved. `totalEarnings`/`monthlyEarnings`
 * only count lessons whose held payment has actually been *released*
 * (`paymentReleased`, via a confirmed/auto-confirmed report — see
 * releaseLessonPayment in wallet.service.ts), not merely `completed` —
 * a completed-but-unconfirmed lesson's money is still sitting in escrow,
 * not the teacher's. `lessonsThisMonth`/`studentsThisMonth` reflect real
 * booking activity this month (`createdAt`-scoped, cancelled bookings
 * excluded) since those describe demand, not just completed calls.
 */
function computeTeacherEarnings(lessons: Lesson[]) {
  const completed = lessons.filter((l) => l.status === 'completed' && l.paymentReleased && l.completedAt)
  const totalEarnings = completed.reduce((sum, l) => sum + l.price, 0)

  const now = new Date()
  const isSameMonth = (ts: number, ref: Date) => {
    const d = new Date(ts)
    return d.getFullYear() === ref.getFullYear() && d.getMonth() === ref.getMonth()
  }

  const monthlyEarnings = completed
    .filter((l) => isSameMonth(l.completedAt!, now))
    .reduce((sum, l) => sum + l.price, 0)

  const activeThisMonth = lessons.filter((l) => l.status !== 'cancelled' && l.createdAt && isSameMonth(l.createdAt, now))
  const lessonsThisMonth = activeThisMonth.length
  const studentsThisMonth = new Set(activeThisMonth.map((l) => l.studentId)).size

  const earningsChart = Array.from({ length: 6 }, (_, i) => {
    const monthDate = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1)
    const amount = completed
      .filter((l) => isSameMonth(l.completedAt!, monthDate))
      .reduce((sum, l) => sum + l.price, 0)
    return { month: MONTH_LABELS_PL[monthDate.getMonth()], amount }
  })

  return { totalEarnings, monthlyEarnings, lessonsThisMonth, studentsThisMonth, earningsChart }
}

/** Rating/earnings summary only — the lesson list is fetched separately via getTeacherLessons. */
export async function getTeacherDashboard(teacherName?: string, userId?: string): Promise<TeacherDashboardData> {
  if (!isFirebaseConfigured || !userId) return teacherDashboardDataMock
  // Real rating/reviewCount/completionRate come from the teacher's own
  // Firestore application doc — the shared mock dataset's numbers belong to
  // a fictional "Marek Kowalski" character. Earnings/activity figures are
  // computed from the teacher's real lesson docs (see computeTeacherEarnings)
  // — honest zeros for a brand-new teacher instead of demo filler.
  const application = await getTeacherApplication(userId)
  const lessons = await autoConfirmOverdueReports(await getTeacherLessonsFirebase(userId))
  const earnings = computeTeacherEarnings(lessons)
  return {
    name: application?.name ?? teacherDashboardDataMock.name,
    initials: application?.initials ?? teacherDashboardDataMock.initials,
    avatarColor: application?.avatarColor ?? teacherDashboardDataMock.avatarColor,
    specialty: application?.specialty ?? teacherDashboardDataMock.specialty,
    rating: application?.rating ?? 0,
    reviewCount: application?.reviewCount ?? 0,
    completionRate: application?.completionRate ?? 0,
    responseRate: application ? teacherDashboardDataMock.responseRate : 0,
    ...earnings,
  }
}

/** Creates a real, persisted lesson *request* — status starts at 'pending' and only becomes a confirmed booking once the teacher accepts it. */
export async function createBooking(input: LessonBookingInput): Promise<Lesson> {
  return isFirebaseConfigured ? createBookingFirebase(input) : createBookingMock(input)
}

/** Teacher accepts/rejects a pending booking request. A rejection refunds the escrow hold placed at booking time — an acceptance leaves it held until the lesson's report is confirmed. */
export async function respondToBookingRequest(lesson: Lesson, decision: 'accepted' | 'rejected'): Promise<void> {
  const nextStatus = decision === 'accepted' ? 'upcoming' : 'cancelled'
  await updateLessonDoc(lesson.id, { status: nextStatus })
  if (decision === 'rejected') {
    const payerId = lesson.payerId ?? lesson.studentId
    await refundLessonPayment(payerId, lesson.price, lesson.topic, lesson.holdTransactionId)
  }
  createNotification({
    userId: lesson.studentId,
    type: 'lesson',
    title: decision === 'accepted' ? 'Lekcja potwierdzona!' : 'Prośba o lekcję odrzucona',
    description: decision === 'accepted'
      ? `${lesson.teacherName} potwierdził(a) lekcję „${lesson.topic}" — ${lesson.date} o ${lesson.time}.`
      : `${lesson.teacherName} nie może przeprowadzić lekcji „${lesson.topic}" w tym terminie. Środki zostały zwrócone.`,
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

/** The party who *didn't* request the change accepts/rejects it. An accepted cancel refunds the escrow hold; a reschedule leaves it held (the lesson still happens, just at a different time). */
export async function respondToLessonChange(lesson: Lesson, decision: 'accepted' | 'rejected'): Promise<void> {
  const change = lesson.pendingChange
  if (!change) return

  // Firestore rejects `undefined` field values (see toParticipant() in
  // chat.service.ts for the same gotcha) — `null` is how a field gets
  // cleared instead.
  const patch: Record<string, unknown> = { pendingChange: isFirebaseConfigured ? null : undefined }
  let refunded = false
  if (decision === 'accepted' && change.type === 'cancel') {
    patch.status = 'cancelled'
    const payerId = lesson.payerId ?? lesson.studentId
    await refundLessonPayment(payerId, lesson.price, lesson.topic, lesson.holdTransactionId)
    refunded = true
  } else if (decision === 'accepted' && change.type === 'reschedule') {
    patch.date = change.newDate ?? lesson.date
    patch.time = change.newTime ?? lesson.time
  }

  await updateLessonDoc(lesson.id, patch)

  const requesterId = change.requestedBy === 'student' ? lesson.studentId : lesson.teacherId
  const responderLabel = change.requestedBy === 'student' ? lesson.teacherName : lesson.studentName
  const actionLabel = change.type === 'cancel' ? 'odwołanie' : 'przełożenie'
  createNotification({
    userId: requesterId,
    type: 'lesson',
    title: decision === 'accepted' ? `Prośba o ${actionLabel} zaakceptowana` : `Prośba o ${actionLabel} odrzucona`,
    description: decision === 'accepted'
      ? `${responderLabel} zaakceptował(a) Twoją prośbę dotyczącą lekcji „${lesson.topic}".${refunded ? ' Środki zostały zwrócone.' : ''}`
      : `${responderLabel} odrzucił(a) Twoją prośbę dotyczącą lekcji „${lesson.topic}".`,
  })
}

/**
 * Marks a lesson completed once the call ends (see
 * components/lesson/lesson-room-client.tsx) — the held payment is
 * *not* released here. The teacher still owes a report
 * (submitLessonReport); only a confirmed/auto-confirmed report
 * actually moves the money (see finalizeReportConfirmation above).
 * Idempotent: does nothing if the lesson is already
 * completed/cancelled or can't be found.
 */
export async function completeLesson(lessonId: string): Promise<void> {
  const lesson = await getLessonById(lessonId)
  if (!lesson || lesson.status === 'completed' || lesson.status === 'cancelled') return

  const completedAt = Date.now()
  await updateLessonDoc(lessonId, { status: 'completed', completedAt })

  createNotification({
    userId: lesson.teacherId,
    type: 'lesson',
    title: 'Lekcja zakończona',
    description: `Lekcja „${lesson.topic}" z ${lesson.studentName} zakończona. Uzupełnij raport, aby otrzymać płatność.`,
  })
  createNotification({
    userId: lesson.studentId,
    type: 'lesson',
    title: 'Lekcja zakończona',
    description: `Lekcja „${lesson.topic}" z ${lesson.teacherName} zakończona. Środki zostaną zwolnione po potwierdzeniu raportu nauczyciela.`,
  })
}

/**
 * The tutor's required last step (see LessonReport in lib/types.ts) —
 * starts the confirmation window. Confirmation authority is resolved
 * *now*, once, via services/family-link.service.ts, and frozen onto
 * the lesson so a parent linking later doesn't retroactively change
 * who's responsible for a lesson already in flight.
 */
export async function submitLessonReport(lesson: Lesson, report: LessonReport): Promise<void> {
  if (lesson.status !== 'completed' || lesson.report) return

  const confirmingParty = await resolveConfirmingParty(lesson.studentId)
  await updateLessonDoc(lesson.id, {
    report,
    reportSubmittedAt: Date.now(),
    confirmingPartyId: confirmingParty.id,
    confirmingPartyRole: confirmingParty.role,
  })

  createNotification({
    userId: confirmingParty.id,
    type: 'lesson',
    title: 'Raport z lekcji gotowy do potwierdzenia',
    description: `${lesson.teacherName} przesłał(a) raport z lekcji „${lesson.topic}". Potwierdź go w ciągu 24h — inaczej płatność zostanie zwolniona automatycznie.`,
  })
  if (confirmingParty.id !== lesson.studentId) {
    createNotification({
      userId: lesson.studentId,
      type: 'lesson',
      title: 'Raport z lekcji gotowy',
      description: `${lesson.teacherName} przesłał(a) raport z lekcji „${lesson.topic}". Czeka na potwierdzenie rodzica.`,
    })
  }
}

/** The confirming party (student, or their linked parent — see Lesson.confirmingPartyId) approves the report, releasing the held payment to the teacher. */
export async function confirmLessonReport(lesson: Lesson, confirmedByUserId: string): Promise<void> {
  if (!lesson.report || lesson.reportConfirmedAt || lesson.dispute) return
  if (lesson.confirmingPartyId && lesson.confirmingPartyId !== confirmedByUserId) return
  await finalizeReportConfirmation(lesson)
}

/** The confirming party rejects the report instead of approving it — parks the held payment until an admin resolves the dispute (see resolveDispute below). */
export async function disputeLessonReport(
  lesson: Lesson,
  reason: LessonDisputeReason,
  note: string,
  raisedBy: 'student' | 'parent',
  raisedByUserId: string,
): Promise<void> {
  if (!lesson.report || lesson.reportConfirmedAt || lesson.dispute) return
  const dispute: LessonDispute = { reason, note, raisedBy, raisedByUserId, raisedAt: Date.now(), status: 'open' }
  await updateLessonDoc(lesson.id, { dispute })
  createNotification({
    userId: lesson.teacherId,
    type: 'lesson',
    title: 'Zgłoszono spór dotyczący raportu',
    description: `${raisedBy === 'parent' ? 'Rodzic ucznia' : lesson.studentName} zgłosił(a) spór dotyczący lekcji „${lesson.topic}". Support Techbee skontaktuje się w ciągu 3 dni roboczych.`,
  })
}

/** Admin resolves an open dispute — either finalizes the report (releasing payment to the teacher) or refunds the payer. */
export async function resolveDispute(lesson: Lesson, resolution: 'teacher' | 'payer', resolutionNote: string, adminId: string): Promise<void> {
  if (!lesson.dispute || lesson.dispute.status !== 'open') return

  const resolvedDispute: LessonDispute = {
    ...lesson.dispute,
    status: resolution === 'teacher' ? 'resolved_teacher' : 'resolved_payer',
    resolutionNote,
    resolvedAt: Date.now(),
    resolvedByAdminId: adminId,
  }
  await updateLessonDoc(lesson.id, { dispute: resolvedDispute })

  const payerId = lesson.payerId ?? lesson.studentId
  if (resolution === 'teacher') {
    await finalizeReportConfirmation(lesson)
  } else {
    await refundLessonPayment(payerId, lesson.price, lesson.topic, lesson.holdTransactionId)
    createNotification({
      userId: payerId,
      type: 'payment',
      title: 'Spór rozstrzygnięty na Twoją korzyść',
      description: `Zwrócono ${lesson.price} zł za lekcję „${lesson.topic}".`,
    })
  }
  createNotification({
    userId: lesson.teacherId,
    type: 'lesson',
    title: 'Spór rozstrzygnięty',
    description: resolution === 'teacher'
      ? `Spór dot. lekcji „${lesson.topic}" rozstrzygnięto na Twoją korzyść — płatność została zwolniona.`
      : `Spór dot. lekcji „${lesson.topic}" rozstrzygnięto na korzyść ucznia/rodzica — środki zostały zwrócone.`,
  })
}

/**
 * The student leaves a rating + review for a completed lesson — a light
 * "as-verification" signal that they actually took the lesson, per the
 * request. Appends a real review to the teacher's profile (recomputing
 * their rating/reviewCount) and marks the lesson `reviewed` so the "Oceń
 * lekcję" prompt doesn't show again. No-ops if the lesson isn't completed
 * yet or was already reviewed.
 */
export async function submitLessonReview(
  lesson: Lesson,
  rating: number,
  comment: string,
  author: { name: string; initials: string; avatarColor: string },
): Promise<void> {
  if (lesson.status !== 'completed' || lesson.reviewed) return

  await submitTeacherReview({
    teacherId: lesson.teacherId,
    author: author.name,
    authorInitials: author.initials,
    authorColor: author.avatarColor,
    rating,
    comment,
  })

  if (isFirebaseConfigured && db) {
    await updateDoc(doc(db, collections.lessons, lesson.id), { reviewed: true })
  } else {
    updateLocalLesson(lesson.id, { reviewed: true })
  }

  createNotification({
    userId: lesson.teacherId,
    type: 'review',
    title: 'Nowa opinia od ucznia',
    description: `${author.name} zostawił(a) opinię (${rating}/5) po lekcji „${lesson.topic}".`,
  })
}
