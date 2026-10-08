import type { Lesson } from './types'

type PackageLessonAction = Pick<
  Lesson,
  | 'teacherId'
  | 'studentId'
  | 'payerId'
  | 'paymentSource'
  | 'packageId'
  | 'packageCreditState'
  | 'status'
  | 'pendingChange'
  | 'report'
  | 'reportConfirmedAt'
  | 'paymentReleased'
  | 'stripeTransferId'
>

export type PackageLessonActionDecision = { ok: true } | { ok: false; status: 403 | 409; error: string }

function isLessonParty(lesson: PackageLessonAction, uid: string): boolean {
  const payerId = lesson.payerId ?? lesson.studentId
  return uid === lesson.teacherId || uid === lesson.studentId || uid === payerId
}

export function canCancelPackageLessonCredit(lesson: PackageLessonAction, uid: string): PackageLessonActionDecision {
  if (lesson.paymentSource !== 'package' || !lesson.packageId) {
    return { ok: false, status: 409, error: 'Ta lekcja nie korzysta z pakietu.' }
  }
  if (lesson.packageCreditState === 'returned') {
    return isLessonParty(lesson, uid) ? { ok: true } : { ok: false, status: 403, error: 'Brak dostępu do tej lekcji.' }
  }
  if (lesson.packageCreditState !== 'reserved') {
    return { ok: false, status: 409, error: 'Tego kredytu nie można już zwrócić automatycznie.' }
  }
  if (lesson.status === 'completed' || lesson.report || lesson.reportConfirmedAt || lesson.paymentReleased || lesson.stripeTransferId) {
    return { ok: false, status: 409, error: 'Odbytej lub rozliczonej lekcji z pakietu nie można zwrócić do pakietu.' }
  }
  if (lesson.status === 'pending') {
    return uid === lesson.teacherId
      ? { ok: true }
      : { ok: false, status: 403, error: 'Tylko nauczyciel może odrzucić oczekującą rezerwację z pakietu.' }
  }
  if (lesson.status === 'upcoming' && lesson.pendingChange?.type === 'cancel') {
    const requestedBy = lesson.pendingChange.requestedBy
    if (requestedBy === 'student' && uid === lesson.teacherId) return { ok: true }
    if (requestedBy === 'teacher' && (uid === lesson.studentId || uid === (lesson.payerId ?? lesson.studentId))) return { ok: true }
    return { ok: false, status: 403, error: 'Tę prośbę o odwołanie musi zaakceptować druga strona lekcji.' }
  }
  return { ok: false, status: 409, error: 'Lekcję z pakietu można zwrócić tylko po odrzuceniu oczekującej rezerwacji albo zaakceptowaniu prośby o odwołanie.' }
}

export function canCompletePackageLessonCredit(lesson: PackageLessonAction, uid: string): PackageLessonActionDecision {
  if (lesson.paymentSource !== 'package' || !lesson.packageId) {
    return { ok: false, status: 409, error: 'Ta lekcja nie korzysta z pakietu.' }
  }
  if (uid !== lesson.teacherId && uid !== lesson.studentId) {
    return { ok: false, status: 403, error: 'Brak dostępu do tej lekcji.' }
  }
  if (lesson.packageCreditState === 'used' && lesson.status === 'completed') return { ok: true }
  if (lesson.packageCreditState !== 'reserved') {
    return { ok: false, status: 409, error: 'Kredyt tej lekcji nie jest w stanie reserved.' }
  }
  if (lesson.status !== 'upcoming') {
    return { ok: false, status: 409, error: 'Tylko potwierdzoną nadchodzącą lekcję można oznaczyć jako odbytą.' }
  }
  if (lesson.pendingChange || lesson.report || lesson.reportConfirmedAt || lesson.paymentReleased || lesson.stripeTransferId) {
    return { ok: false, status: 409, error: 'Ta lekcja nie jest już w stanie pozwalającym na automatyczne oznaczenie jako odbyta.' }
  }
  return { ok: true }
}

