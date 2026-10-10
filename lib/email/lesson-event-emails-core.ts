import type { ProductEmailInput } from './product-notifications-core'

export type LessonEmailEvent =
  | 'booking_accepted'
  | 'change_requested'
  | 'cancelled'
  | 'rescheduled'
  | 'report_ready'
  | 'dispute_opened'
  | 'dispute_resolved'

export const LESSON_EMAIL_EVENTS: readonly LessonEmailEvent[] = [
  'booking_accepted', 'change_requested', 'cancelled', 'rescheduled', 'report_ready', 'dispute_opened', 'dispute_resolved',
]

export function isLessonEmailEvent(value: unknown): value is LessonEmailEvent {
  return typeof value === 'string' && (LESSON_EMAIL_EVENTS as readonly string[]).includes(value)
}

export type LessonEmailLesson = {
  id: string
  studentId: string
  teacherId: string
  payerId?: string
  studentName?: string
  teacherName?: string
  topic?: string
  date?: string
  time?: string
  status?: string
  rescheduledAt?: number
  pendingChange?: { type?: string; requestedBy?: string; requestedAt?: number; newDate?: string; newTime?: string; note?: string } | null
  report?: unknown
  reportSubmittedAt?: number
  reportConfirmedAt?: number | null
  confirmingPartyId?: string
  studentCanManageReport?: boolean
  dispute?: { status?: string; raisedByUserId?: string; resolvedAt?: number; raisedAt?: number } | null
}

export type LessonEmailPlan =
  | { ok: true; emails: ProductEmailInput[] }
  | { ok: false; status: 400 | 403 | 409; error: string }

const MAX_RECENT_MS = 60 * 60 * 1000

function unique(ids: (string | undefined)[]): string[] {
  return [...new Set(ids.filter((id): id is string => typeof id === 'string' && id.length > 0))]
}

function termDetail(lesson: LessonEmailLesson) {
  return { label: 'Termin', value: `${lesson.date ?? ''} ${lesson.time ?? ''}`.trim() || '—' }
}

/**
 * Decides — from the lesson document the server just loaded, never from
 * client-supplied facts — who gets which email for a lesson event, and
 * whether the event is actually true (state check) and caused by an
 * authorised actor. Each email carries an idempotency key tied to the
 * concrete state it announces, so repeated calls never mail twice.
 */
export function planLessonEventEmails(input: {
  event: LessonEmailEvent
  lesson: LessonEmailLesson
  actorUid: string
  actorIsAdmin: boolean
  now: number
  appUrl: (path: string) => string
}): LessonEmailPlan {
  const { event, lesson, actorUid, actorIsAdmin, now } = input
  const payer = lesson.payerId || lesson.studentId
  const studentSide = unique([lesson.studentId, lesson.payerId])
  const everyone = unique([lesson.studentId, lesson.payerId, lesson.teacherId])
  const actorIsTeacher = actorUid === lesson.teacherId
  const actorIsStudentSide = studentSide.includes(actorUid)
  const cta = { label: 'Otwórz panel lekcji', href: input.appUrl('/dashboard') }
  const base = `lesson:${lesson.id}`
  const topic = lesson.topic || 'Lekcja'
  const details = [termDetail(lesson), { label: 'Temat', value: topic }]
  const forbidden = { ok: false as const, status: 403 as const, error: 'Brak uprawnień do tego zdarzenia.' }
  const notApplicable = { ok: false as const, status: 409 as const, error: 'Zdarzenie nie odpowiada aktualnemu stanowi lekcji.' }

  if (event === 'booking_accepted') {
    if (!actorIsTeacher) return forbidden
    if (lesson.status !== 'upcoming') return notApplicable
    return { ok: true, emails: studentSide.map((uid) => ({
      eventId: `${base}:booking-accepted:${uid}`,
      recipientUid: uid,
      type: 'lessons.bookingCreated' as const,
      subject: 'Rezerwacja lekcji potwierdzona',
      title: 'Nauczyciel potwierdził lekcję',
      preheader: `${lesson.teacherName ?? 'Nauczyciel'} potwierdził(a) termin lekcji.`,
      body: `${lesson.teacherName ?? 'Nauczyciel'} potwierdził(a) rezerwację. Lekcja odbędzie się w umówionym terminie.`,
      details,
      cta,
    })) }
  }

  if (event === 'change_requested') {
    const pending = lesson.pendingChange
    if (!pending?.type || (pending.type !== 'cancel' && pending.type !== 'reschedule') || typeof pending.requestedAt !== 'number') return notApplicable
    const requestedByStudent = pending.requestedBy === 'student'
    if (requestedByStudent ? !actorIsStudentSide : !actorIsTeacher) return forbidden
    if (now - pending.requestedAt > MAX_RECENT_MS) return notApplicable
    const recipients = requestedByStudent ? [lesson.teacherId] : studentSide
    const action = pending.type === 'cancel' ? 'odwołanie' : 'przełożenie'
    const requester = requestedByStudent ? lesson.studentName : lesson.teacherName
    return { ok: true, emails: recipients.map((uid) => ({
      eventId: `${base}:change-request:${pending.requestedAt}:${uid}`,
      recipientUid: uid,
      type: 'lessons.bookingChanged' as const,
      subject: `Prośba o ${action} lekcji`,
      title: `Prośba o ${action} lekcji`,
      preheader: `${requester ?? 'Druga strona'} prosi o ${action} lekcji.`,
      body: `${requester ?? 'Druga strona'} prosi o ${action} lekcji „${topic}”.${pending.newDate ? ` Proponowany termin: ${pending.newDate}${pending.newTime ? ` o ${pending.newTime}` : ''}.` : ''}${pending.note ? ` Powód: ${pending.note}` : ''} Potwierdź albo odrzuć prośbę w panelu.`,
      details,
      cta,
    })) }
  }

  if (event === 'cancelled') {
    if (!everyone.includes(actorUid)) return forbidden
    if (lesson.status !== 'cancelled') return notApplicable
    return { ok: true, emails: everyone.filter((uid) => uid !== actorUid).map((uid) => ({
      eventId: `${base}:cancelled:${uid}`,
      recipientUid: uid,
      type: 'lessons.bookingCancelled' as const,
      subject: 'Lekcja została odwołana',
      title: 'Lekcja została odwołana',
      preheader: `Lekcja „${topic}” została odwołana.`,
      body: `Lekcja „${topic}” z ${lesson.teacherName ?? 'nauczycielem'} została odwołana.${uid === payer ? ' Jeśli lekcja była opłacona, zwrot lub zwrot kredytu do pakietu zostanie zrealizowany osobno.' : ''}`,
      details,
      cta,
    })) }
  }

  if (event === 'rescheduled') {
    if (!everyone.includes(actorUid)) return forbidden
    if (typeof lesson.rescheduledAt !== 'number' || now - lesson.rescheduledAt > MAX_RECENT_MS || lesson.status === 'cancelled') return notApplicable
    return { ok: true, emails: everyone.filter((uid) => uid !== actorUid).map((uid) => ({
      eventId: `${base}:rescheduled:${lesson.rescheduledAt}:${uid}`,
      recipientUid: uid,
      type: 'lessons.bookingChanged' as const,
      subject: 'Zmieniono termin lekcji',
      title: 'Termin lekcji został zmieniony',
      preheader: `Nowy termin lekcji „${topic}”.`,
      body: `Termin lekcji „${topic}” został zmieniony. Nowy termin znajdziesz poniżej.`,
      details,
      cta,
    })) }
  }

  if (event === 'report_ready') {
    if (!actorIsTeacher) return forbidden
    if (!lesson.report || typeof lesson.reportSubmittedAt !== 'number' || lesson.reportConfirmedAt) return notApplicable
    const recipients = unique([lesson.confirmingPartyId || lesson.studentId, lesson.studentCanManageReport ? lesson.studentId : undefined])
    return { ok: true, emails: recipients.map((uid) => ({
      eventId: `${base}:report-ready:${lesson.reportSubmittedAt}:${uid}`,
      recipientUid: uid,
      type: 'reports.reportReady' as const,
      subject: 'Raport z lekcji czeka na potwierdzenie',
      title: 'Raport z lekcji jest gotowy',
      preheader: `${lesson.teacherName ?? 'Nauczyciel'} przesłał(a) raport z lekcji.`,
      body: `${lesson.teacherName ?? 'Nauczyciel'} przesłał(a) raport z lekcji „${topic}”. Potwierdź go lub zgłoś zastrzeżenia w ciągu 24 godzin — po tym czasie raport zostanie potwierdzony automatycznie, a płatność zwolniona nauczycielowi.`,
      details: [{ label: 'Lekcja', value: topic }],
      cta: { label: 'Otwórz raport', href: input.appUrl('/reports') },
    })) }
  }

  if (event === 'dispute_opened') {
    const dispute = lesson.dispute
    if (!dispute || dispute.status !== 'open') return notApplicable
    if (dispute.raisedByUserId !== actorUid) return forbidden
    return { ok: true, emails: [{
      eventId: `${base}:dispute-opened:${dispute.raisedAt ?? 0}:${lesson.teacherId}`,
      recipientUid: lesson.teacherId,
      type: 'reports.reportReady' as const,
      required: true,
      subject: 'Zgłoszono zastrzeżenia do raportu',
      title: 'Zgłoszono zastrzeżenia do raportu',
      preheader: `Uczeń lub rodzic zgłosił zastrzeżenia do lekcji „${topic}”.`,
      body: `Do raportu z lekcji „${topic}” zgłoszono zastrzeżenia. Płatność jest wstrzymana do czasu rozstrzygnięcia przez Runbee. Skontaktujemy się w ciągu 3 dni roboczych.`,
      details: [termDetail(lesson)],
      cta,
    }] }
  }

  // dispute_resolved
  if (!actorIsAdmin) return forbidden
  const dispute = lesson.dispute
  if (!dispute || (dispute.status !== 'resolved_teacher' && dispute.status !== 'resolved_payer')) return notApplicable
  const forTeacher = dispute.status === 'resolved_teacher'
  const recipients = unique([lesson.teacherId, payer])
  return { ok: true, emails: recipients.map((uid) => ({
    eventId: `${base}:dispute-resolved:${dispute.resolvedAt ?? 0}:${uid}`,
    recipientUid: uid,
    type: 'reports.reportAccepted' as const,
    required: true,
    subject: 'Spór dotyczący lekcji rozstrzygnięty',
    title: 'Spór został rozstrzygnięty',
    preheader: `Rozstrzygnięto spór dotyczący lekcji „${topic}”.`,
    body: forTeacher
      ? `Spór dotyczący lekcji „${topic}” rozstrzygnięto na korzyść nauczyciela — płatność została zwolniona.`
      : `Spór dotyczący lekcji „${topic}” rozstrzygnięto na korzyść ucznia lub rodzica — środki zostaną zwrócone.`,
    details: [termDetail(lesson)],
    cta,
  })) }
}

export type LessonReminderLesson = LessonEmailLesson & { scheduledStartAt?: number; paymentStatus?: string; paymentSource?: string }

export const REMINDER_WINDOW_MS = 24 * 60 * 60 * 1000

/** Lessons that are confirmed (upcoming), start inside the next 24h and have an exact start timestamp. */
export function isReminderDue(lesson: LessonReminderLesson, now: number, windowMs = REMINDER_WINDOW_MS): boolean {
  if (lesson.status !== 'upcoming') return false
  if (typeof lesson.scheduledStartAt !== 'number') return false
  return lesson.scheduledStartAt > now && lesson.scheduledStartAt - now <= windowMs
}

export function planLessonReminderEmails(lesson: LessonReminderLesson, appUrl: (path: string) => string): ProductEmailInput[] {
  const recipients = unique([lesson.studentId, lesson.payerId, lesson.teacherId])
  const topic = lesson.topic || 'Lekcja'
  return recipients.map((uid) => ({
    // tied to the start timestamp: a rescheduled lesson gets a fresh reminder, an unchanged one never two
    eventId: `lesson:${lesson.id}:reminder-24h:${lesson.scheduledStartAt}:${uid}`,
    recipientUid: uid,
    type: 'lessons.lessonReminder' as const,
    subject: 'Przypomnienie o jutrzejszej lekcji',
    title: 'Lekcja już wkrótce',
    preheader: `Lekcja „${topic}” odbędzie się w ciągu najbliższych 24 godzin.`,
    body: `Przypominamy o lekcji „${topic}”. Dołącz do niej z panelu Runbee w umówionym terminie.`,
    details: [termDetail(lesson), { label: 'Temat', value: topic }],
    cta: { label: 'Otwórz panel lekcji', href: appUrl('/dashboard') },
  }))
}
