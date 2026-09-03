import { addDoc, collection, doc, getDoc, getDocs, query, updateDoc, where } from 'firebase/firestore'
import { studentLessonsData, studentStatsData, teacherDashboardDataMock, teacherLessonsData } from '@/data/lessons.data'
import { teachersData } from '@/data/teachers.data'
import { collections, db, isFirebaseConfigured } from '@/lib/firebase'
import { getStudentReviewForTeacher, getTeacherApplication, submitTeacherReview } from '@/services/teachers.service'
import { createNotification } from '@/services/notifications.service'
import { refundLessonPayment as stripeRefund, transferLessonPayment as stripeTransfer } from '@/services/stripe.service'
import { resolveConfirmingParty } from '@/services/family-link.service'
import { getOrCreateConversation, sendMessage, sendReportCardMessage, toParticipant, updateReportCardStatus } from '@/services/chat.service'
import { getUserProfileById } from '@/services/auth.service'
import { canManageLessonReport, computeReportManagerIds, getReportManagerIds } from '@/lib/report-permissions'
import type { Lesson, LessonBookingInput, LessonChangeRequest, LessonDispute, LessonDisputeReason, LessonReport, LessonReportCard, LessonReportCardStatus, StudentStats, TeacherDashboardData } from '@/lib/types'

// ─────────────────────────────────────────────────────────────
// Data-access layer for lessons/bookings.
//
// Lifecycle (see LessonStatus in lib/types.ts):
//   pending → upcoming → completed
//                 ↘ cancelled
//
// Real (Firebase-configured) mode: a Lesson doc is created ONLY by the
// Stripe webhook, once a real payment has actually succeeded (see
// app/api/stripe/webhook/route.ts + app/api/stripe/checkout/create-session)
// — there is no "book now, pay later" step and no client-writable
// "paid" flag. `createBooking`/`createBookingFirebase` below are
// consequently mock-mode-only now; the real flow starts at
// components/teacher/teacher-booking-calendar.tsx calling
// startLessonCheckout (services/stripe.service.ts) directly. The
// platform holds the payment on its own Stripe balance (the "Separate
// Charges and Transfers" pattern) until the teacher's post-lesson
// report is confirmed — see `transferLessonPayment` calls below,
// which create a real Stripe Transfer to the teacher's Connect
// account. The teacher still gets a real notification and must
// accept/reject the paid request (respondToBookingRequest) — a
// rejection issues a real Stripe Refund. Once confirmed, either side
// can request a cancel/reschedule (requestLessonChange →
// respondToLessonChange); an accepted cancel also refunds. When the
// call ends (completeLesson), the lesson becomes `completed` but the
// payment is *not* transferred to the teacher yet — the teacher still
// owes a report (submitLessonReport), and only once that report is
// confirmed (confirmLessonReport, disputed via disputeLessonReport +
// admin resolveDispute, or auto-confirmed after 24h — see
// autoConfirmOverdueReports) does the money actually move.
//
// Mock (no Firebase) mode is unchanged in spirit: a pure local demo,
// booking instantly "succeeds" with no real payment behind it at all
// (there never was one, even before Stripe — the old BeeCoins wallet
// sim is gone entirely — there was never a real payment processor in
// mock mode either way).
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
    // Pure local demo — no real payment processor in mock mode (see the
    // top-of-file comment), so this is "paid" the instant it's booked,
    // same honesty-about-simulation posture the old wallet sim had.
    paymentStatus: 'paid',
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
    studentCanManageReport: data.studentCanManageReport as boolean | undefined,
    reportConfirmedAt: data.reportConfirmedAt as number | undefined,
    dispute: data.dispute as LessonDispute | undefined,
    reportChatConversationId: data.reportChatConversationId as string | undefined,
    reportChatMessageId: data.reportChatMessageId as string | undefined,
    reportChatDeliveries: data.reportChatDeliveries as Lesson['reportChatDeliveries'],
    paymentStatus: data.paymentStatus as Lesson['paymentStatus'],
    priceGrosze: data.priceGrosze as number | undefined,
    commissionPercent: data.commissionPercent as number | undefined,
    platformFeeGrosze: data.platformFeeGrosze as number | undefined,
    teacherAmountGrosze: data.teacherAmountGrosze as number | undefined,
    stripeCheckoutSessionId: data.stripeCheckoutSessionId as string | undefined,
    stripePaymentIntentId: data.stripePaymentIntentId as string | undefined,
    stripeTransferId: data.stripeTransferId as string | undefined,
    stripeRefundId: data.stripeRefundId as string | undefined,
  }
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

async function finalizeReportConfirmation(lesson: Lesson, chatStatus: LessonReportCardStatus = 'confirmed'): Promise<void> {
  if (isFirebaseConfigured) {
    // Real Stripe Transfer to the teacher's connected account — see
    // app/api/stripe/lessons/[lessonId]/transfer/route.ts, which also
    // writes reportConfirmedAt/paymentReleased itself once the
    // transfer succeeds (server-side, re-verified against the real
    // lesson doc). Deliberately NOT swallowed here (unlike the refund
    // calls elsewhere in this file, which really are best-effort): a
    // failed Transfer — most commonly Stripe Test Mode's
    // `balance_insufficient` (a just-completed Checkout payment sits in
    // "pending" balance for a while before it's "available" to fund a
    // Transfer, see https://stripe.com/docs/testing#available-balance)
    // — must not be treated as a successful confirmation. Letting it
    // throw here means the report correctly stays "pending" (no chat
    // card flip, no misleading "Płatność zwolniona" notification below)
    // and the caller sees a real error instead of a false success.
    await stripeTransfer(lesson.id)
  } else {
    // Mock mode: no real payment ever moved, so there's nothing to
    // transfer — just record that the report was confirmed.
    await updateLessonDoc(lesson.id, { reportConfirmedAt: Date.now(), paymentReleased: true })
  }
  // Not awaited: the money has already genuinely moved (or been
  // recorded) by this point, which is what the caller is actually
  // waiting on — the chat card's status pill is a best-effort display
  // update (see flipReportCardStatus) that shouldn't add its own
  // Firestore round-trip to the confirming user's perceived wait.
  flipReportCardStatus(lesson, chatStatus)
  createNotification({
    userId: lesson.teacherId,
    type: 'payment',
    title: 'Płatność zwolniona',
    description: `Otrzymano ${lesson.price} zł za lekcję „${lesson.topic}" z ${lesson.studentName}.`,
  })
}

/** Flips every chat-delivered report card's status live — best-effort, never blocks the underlying financial/report action if chat delivery failed or the lesson predates this feature. */
async function flipReportCardStatus(lesson: Lesson, status: LessonReportCardStatus): Promise<void> {
  const deliveries = lesson.reportChatDeliveries?.length
    ? lesson.reportChatDeliveries
    : lesson.reportChatConversationId && lesson.reportChatMessageId
      ? [{ conversationId: lesson.reportChatConversationId, messageId: lesson.reportChatMessageId }]
      : []
  if (deliveries.length === 0) return
  try {
    await Promise.all(deliveries.map((delivery) => updateReportCardStatus(delivery.conversationId, delivery.messageId, status)))
  } catch {
    // best-effort — the chat card is a display layer, not the source of truth
  }
}

async function autoConfirmIfOverdue(lesson: Lesson): Promise<Lesson> {
  if (!lesson.report || lesson.reportConfirmedAt || lesson.dispute || !lesson.reportSubmittedAt) return lesson
  if (Date.now() - lesson.reportSubmittedAt < REPORT_AUTO_CONFIRM_MS) return lesson
  try {
    await finalizeReportConfirmation(lesson)
    return { ...lesson, reportConfirmedAt: Date.now(), paymentReleased: true }
  } catch (err) {
    // This runs opportunistically every time a lesson list is fetched
    // (see the section comment above) — unlike a manual confirm click,
    // there's no UI waiting for this specific error, so a failed
    // Transfer (finalizeReportConfirmation now throws instead of
    // swallowing it, see there) must not break the whole list fetch.
    // Leave the lesson as still-pending and let the next fetch retry.
    console.error('[autoConfirmIfOverdue] Transfer failed, will retry on next fetch:', err)
    return lesson
  }
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
 * only count lessons whose payment has actually been *transferred* to the
 * teacher (`paymentReleased`, via a confirmed/auto-confirmed report — see
 * finalizeReportConfirmation above, which triggers a real Stripe Transfer),
 * not merely `completed` — a completed-but-unconfirmed lesson's money is
 * still sitting on Runbee's own Stripe balance, not the teacher's.
 * `lessonsThisMonth`/`studentsThisMonth` reflect real
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
    ...(application?.photoUrl ? { photoUrl: application.photoUrl } : {}),
    specialty: application?.specialty ?? teacherDashboardDataMock.specialty,
    rating: application?.rating ?? 0,
    reviewCount: application?.reviewCount ?? 0,
    completionRate: application?.completionRate ?? 0,
    responseRate: application ? teacherDashboardDataMock.responseRate : 0,
    ...earnings,
  }
}

/**
 * Mock-mode-only local booking (see the top-of-file comment) —
 * instant, no real payment. In real (Firebase-configured) mode, a
 * lesson only ever comes from a successful Stripe payment (see
 * startLessonCheckout in services/stripe.service.ts, called directly
 * from components/teacher/teacher-booking-calendar.tsx); this throws
 * rather than silently creating an unpaid booking.
 */
export async function createBooking(input: LessonBookingInput): Promise<Lesson> {
  if (isFirebaseConfigured) {
    throw new Error('Rezerwacje przechodzą teraz przez płatność Stripe — użyj startLessonCheckout zamiast createBooking.')
  }
  return createBookingMock(input)
}

/** Teacher accepts/rejects a pending booking request. A rejection refunds the escrow hold placed at booking time — an acceptance leaves it held until the lesson's report is confirmed. */
export async function respondToBookingRequest(lesson: Lesson, decision: 'accepted' | 'rejected'): Promise<void> {
  const nextStatus = decision === 'accepted' ? 'upcoming' : 'cancelled'
  await updateLessonDoc(lesson.id, { status: nextStatus })
  if (decision === 'rejected' && isFirebaseConfigured) {
    await stripeRefund(lesson.id).catch((err) => console.error('[respondToBookingRequest] Refund failed:', err))
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
    if (isFirebaseConfigured) {
      await stripeRefund(lesson.id).catch((err) => console.error('[respondToLessonChange] Refund failed:', err))
    }
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
 * the lesson so a parent linking later — or changing their "let the
 * student manage reports too" setting later — doesn't retroactively
 * change who's responsible for a lesson already in flight (see
 * lib/report-permissions.ts for the exact rule).
 *
 * Delivered as a rich, interactive chat "card" (see
 * components/chat/report-card-message.tsx) in the teacher's conversation
 * with whoever actually has primary confirmation authority — never as a
 * dashboard list entry. If the confirming party is a linked parent and
 * that parent also allowed the student to manage reports, the same rich
 * report card is delivered to the student↔teacher thread too. Otherwise
 * the student gets a plain read-only notice that the parent has the next
 * step. Chat delivery is best-effort: if it fails, the report itself
 * still saves — chat is a display layer, not the source of truth.
 *
 * Performance: chat deliveries are started independently. The lesson doc
 * stores every successfully delivered card copy so later status changes
 * can update the parent and student threads consistently.
 */
export async function submitLessonReport(lesson: Lesson, report: LessonReport): Promise<void> {
  if (lesson.status !== 'completed' || lesson.report) return

  // Independent reads — neither depends on the other's result.
  const [confirmingParty, studentProfile] = await Promise.all([
    resolveConfirmingParty(lesson.studentId),
    getUserProfileById(lesson.studentId),
  ])

  const teacherParticipant = toParticipant({
    id: lesson.teacherId,
    name: lesson.teacherName,
    initials: lesson.teacherInitials,
    avatarColor: lesson.teacherColor,
    role: 'teacher',
    specialty: lesson.specialty,
  })

  const managerIds = computeReportManagerIds({
    studentId: lesson.studentId,
    confirmingPartyId: confirmingParty.id,
    confirmingPartyRole: confirmingParty.role,
    studentCanManageReport: confirmingParty.studentCanManage,
  })

  const card: LessonReportCard = {
    lessonId: lesson.id,
    teacherName: lesson.teacherName,
    studentName: lesson.studentName,
    topic: report.topic,
    price: lesson.price,
    progressRating: report.progressRating,
    engagementRating: report.engagementRating,
    homework: report.homework,
    tutorNote: report.tutorNote,
    nextTopic: report.nextTopic,
    status: 'pending',
    confirmingPartyId: confirmingParty.id,
    managerIds,
  }

  async function deliverPrimaryCard(): Promise<{ conversationId: string; messageId: string } | undefined> {
    try {
      // Reuse the student's already-fetched profile when they're their
      // own confirming party — saves a duplicate profile read.
      const confirmingProfile = confirmingParty.id === lesson.studentId ? studentProfile : await getUserProfileById(confirmingParty.id)
      const confirmingParticipant = toParticipant({
        id: confirmingParty.id,
        name: confirmingProfile?.name ?? lesson.studentName,
        initials: confirmingProfile?.initials ?? lesson.studentName.slice(0, 2).toUpperCase(),
        avatarColor: confirmingProfile?.avatarColor ?? '#F4B400',
        role: confirmingParty.role,
      })
      const conversationId = await getOrCreateConversation(teacherParticipant, confirmingParticipant)
      const messageId = await sendReportCardMessage(conversationId, teacherParticipant, card)
      return { conversationId, messageId }
    } catch {
      // best-effort — the report itself must still save even if chat delivery fails
      return undefined
    }
  }

  async function deliverStudentCopy(): Promise<{ conversationId: string; messageId: string } | undefined> {
    if (confirmingParty.id === lesson.studentId || !confirmingParty.studentCanManage) return undefined
    try {
      const studentParticipant = toParticipant({
        id: lesson.studentId,
        name: studentProfile?.name ?? lesson.studentName,
        initials: studentProfile?.initials ?? lesson.studentName.slice(0, 2).toUpperCase(),
        avatarColor: studentProfile?.avatarColor ?? '#F4B400',
        role: 'student',
      })
      const studentConversationId = await getOrCreateConversation(teacherParticipant, studentParticipant)
      const messageId = await sendReportCardMessage(studentConversationId, teacherParticipant, card)
      return { conversationId: studentConversationId, messageId }
    } catch {
      // best-effort
      return undefined
    }
  }

  async function notifyStudentOfParentReport(): Promise<void> {
    if (confirmingParty.id === lesson.studentId || confirmingParty.studentCanManage) return
    try {
      const studentParticipant = toParticipant({
        id: lesson.studentId,
        name: studentProfile?.name ?? lesson.studentName,
        initials: studentProfile?.initials ?? lesson.studentName.slice(0, 2).toUpperCase(),
        avatarColor: studentProfile?.avatarColor ?? '#F4B400',
        role: 'student',
      })
      const studentConversationId = await getOrCreateConversation(teacherParticipant, studentParticipant)
      await sendMessage(studentConversationId, teacherParticipant, `📋 Raport z lekcji „${report.topic}" został wysłany do Twojego rodzica do potwierdzenia.`)
    } catch {
      // best-effort
    }
  }

  // Card deliveries run concurrently; the plain student notice is
  // fire-and-forget because it does not need to be referenced later.
  const studentCopyPromise = deliverStudentCopy()
  const notifyStudentPromise = notifyStudentOfParentReport()
  const primary = await deliverPrimaryCard()
  const studentCopy = await studentCopyPromise
  const reportChatDeliveries = [primary, studentCopy].filter((delivery): delivery is { conversationId: string; messageId: string } => Boolean(delivery))

  await updateLessonDoc(lesson.id, {
    report,
    reportSubmittedAt: Date.now(),
    confirmingPartyId: confirmingParty.id,
    confirmingPartyRole: confirmingParty.role,
    studentCanManageReport: confirmingParty.studentCanManage,
    reportChatConversationId: primary?.conversationId,
    reportChatMessageId: primary?.messageId,
    reportChatDeliveries,
  })

  createNotification({
    userId: confirmingParty.id,
    type: 'lesson',
    title: 'Raport z lekcji gotowy do potwierdzenia',
    description: `${lesson.teacherName} przesłał(a) raport z lekcji „${lesson.topic}" na czacie. Potwierdź go w ciągu 24h — inaczej płatność zostanie zwolniona automatycznie.`,
  })
  if (confirmingParty.id !== lesson.studentId) {
    createNotification({
      userId: lesson.studentId,
      type: 'lesson',
      title: 'Raport z lekcji gotowy',
      description: confirmingParty.studentCanManage
        ? `${lesson.teacherName} przesłał(a) raport z lekcji „${lesson.topic}". Możesz go potwierdzić samodzielnie w zakładce Raporty.`
        : `${lesson.teacherName} przesłał(a) raport z lekcji „${lesson.topic}". Czeka na potwierdzenie rodzica.`,
    })
  }

  // Don't let a slow/failed student-notice delivery affect the caller —
  // it's a nice-to-have side effect, not something submitLessonReport's
  // own success should ever hinge on.
  notifyStudentPromise.catch(() => {})
}

/**
 * Rebuilds the same `LessonReportCard` shape the chat message got at
 * submission time, straight from a `Lesson` doc — used by /reports (see
 * components/dashboard/reports-client.tsx) so a report is findable and
 * actionable even if its chat message was never seen, its conversation
 * got buried in the list, or chat delivery failed outright (best-effort,
 * see submitLessonReport above). The Lesson doc is the source of truth
 * either way; this only re-derives what the chat card already computed
 * once. Returns undefined for lessons with no report yet.
 */
export function lessonToReportCard(lesson: Lesson): LessonReportCard | undefined {
  if (!lesson.report) return undefined
  const status: LessonReportCardStatus = lesson.dispute
    ? lesson.dispute.status === 'open'
      ? 'dispute_open'
      : lesson.dispute.status === 'resolved_teacher'
        ? 'dispute_resolved_teacher'
        : 'dispute_resolved_payer'
    : lesson.reportConfirmedAt
      ? 'confirmed'
      : 'pending'

  return {
    lessonId: lesson.id,
    teacherName: lesson.teacherName,
    studentName: lesson.studentName,
    topic: lesson.report.topic,
    price: lesson.price,
    progressRating: lesson.report.progressRating,
    engagementRating: lesson.report.engagementRating,
    homework: lesson.report.homework,
    tutorNote: lesson.report.tutorNote,
    nextTopic: lesson.report.nextTopic,
    status,
    confirmingPartyId: lesson.confirmingPartyId ?? lesson.studentId,
    managerIds: getReportManagerIds(lesson),
  }
}

/** Whoever is allowed to manage this lesson's report — the resolved confirming party (student or their linked parent), plus the student too when the parent has enabled "Pozwól uczniowi samodzielnie akceptować i odrzucać raporty" — approves it, releasing the held payment to the teacher. See lib/report-permissions.ts for the exact rule. */
export async function confirmLessonReport(lesson: Lesson, confirmedByUserId: string): Promise<void> {
  if (!lesson.report || lesson.reportConfirmedAt || lesson.dispute) return
  if (!canManageLessonReport(lesson, confirmedByUserId)) return
  await finalizeReportConfirmation(lesson)
}

/** Whoever is allowed to manage this lesson's report (see confirmLessonReport above) rejects it instead of approving it — parks the held payment until an admin resolves the dispute (see resolveDispute below). */
export async function disputeLessonReport(
  lesson: Lesson,
  reason: LessonDisputeReason,
  note: string,
  raisedBy: 'student' | 'parent',
  raisedByUserId: string,
): Promise<void> {
  if (!lesson.report || lesson.reportConfirmedAt || lesson.dispute) return
  if (!canManageLessonReport(lesson, raisedByUserId)) return
  const dispute: LessonDispute = { reason, note, raisedBy, raisedByUserId, raisedAt: Date.now(), status: 'open' }
  await updateLessonDoc(lesson.id, { dispute })
  flipReportCardStatus(lesson, 'dispute_open') // not awaited — best-effort display update, see finalizeReportConfirmation
  createNotification({
    userId: lesson.teacherId,
    type: 'lesson',
    title: 'Zgłoszono spór dotyczący raportu',
    description: `${raisedBy === 'parent' ? 'Rodzic ucznia' : lesson.studentName} zgłosił(a) spór dotyczący lekcji „${lesson.topic}". Support Runbee skontaktuje się w ciągu 3 dni roboczych.`,
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
    await finalizeReportConfirmation(lesson, 'dispute_resolved_teacher')
  } else {
    if (isFirebaseConfigured) {
      await stripeRefund(lesson.id).catch((err) => console.error('[resolveDispute] Refund failed:', err))
    }
    flipReportCardStatus(lesson, 'dispute_resolved_payer') // not awaited — best-effort display update, see finalizeReportConfirmation
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
 * Whether this student has actually completed a lesson with this
 * teacher, and may therefore review them.
 *
 * Reuses the system's existing notion of a finished lesson —
 * `status === 'completed'`, the same condition the review prompt, the
 * teacher's "needs a report" queue and the student's history already
 * key on — rather than inventing a second definition of completion.
 * Cancelled and merely-booked lessons never qualify, so a user who has
 * never sat through a lesson with a teacher cannot rate them.
 */
export async function canStudentReviewTeacher(studentId: string, teacherId: string): Promise<boolean> {
  const lessons = await getStudentLessons(studentId)
  return lessons.some((l) => l.teacherId === teacherId && l.status === 'completed')
}

/**
 * The student creates or updates their single review of a teacher.
 *
 * One student holds at most one review per teacher, no matter how many
 * lessons they take — submitting again edits the existing one (see
 * submitTeacherReview / upsertReview in teachers.service.ts). This
 * replaced a per-lesson model where ten lessons with the same teacher
 * produced ten separate reviews and ten votes in that teacher's average.
 *
 * Eligibility is verified here, server-side of the UI, so a client that
 * skipped the check still cannot write a review for a teacher the
 * student never completed a lesson with.
 *
 * The originating lesson is still marked `reviewed` so the per-lesson
 * "Oceń lekcję" prompt stops appearing for it; that flag is now only a
 * prompt-suppressor, not the thing that decides whether a review may
 * exist.
 */
export async function submitLessonReview(
  lesson: Lesson,
  rating: number,
  comment: string,
  author: { id: string; name: string; initials: string; avatarColor: string },
): Promise<void> {
  if (lesson.status !== 'completed') return
  if (!(await canStudentReviewTeacher(author.id, lesson.teacherId))) return

  const isUpdate = Boolean(
    await getStudentReviewForTeacher(lesson.teacherId, author.id),
  )

  await submitTeacherReview({
    teacherId: lesson.teacherId,
    authorId: author.id,
    author: author.name,
    authorInitials: author.initials,
    authorColor: author.avatarColor,
    rating,
    comment,
  })

  if (!lesson.reviewed) {
    if (isFirebaseConfigured && db) {
      await updateDoc(doc(db, collections.lessons, lesson.id), { reviewed: true })
    } else {
      updateLocalLesson(lesson.id, { reviewed: true })
    }
  }

  createNotification({
    userId: lesson.teacherId,
    type: 'review',
    title: isUpdate ? 'Zaktualizowana opinia ucznia' : 'Nowa opinia od ucznia',
    description: isUpdate
      ? `${author.name} zaktualizował(a) swoją opinię (${rating}/5).`
      : `${author.name} zostawił(a) opinię (${rating}/5) po lekcji „${lesson.topic}".`,
  })
}
