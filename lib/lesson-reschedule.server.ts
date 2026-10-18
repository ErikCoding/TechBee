import type { Firestore } from 'firebase-admin/firestore'
import { fitsAvailability, isBookableDate } from './availability-core'
import { lessonSlotLockIds } from './lesson-slot-locks'
import { lessonStartAtMs, polishDayLabelFromDateIso, slotOverlapsBookedLesson, zonedDateTimeToMs } from './lesson-time'
import type { Lesson } from './types'
import type { LessonEmailLesson } from './email/lesson-event-emails-core'

export type RescheduleInput = {
  lessonId: string
  requestId: string
  action: 'request' | 'accepted' | 'rejected'
  dateIso?: string
  time?: string
  note?: string
  expectedRequestedAt?: number
}

export class ScheduleError extends Error {
  constructor(message: string, readonly status = 409) { super(message) }
}

export async function rescheduleLesson(database: Firestore, uid: string, input: RescheduleInput, now = Date.now()) {
  if (!/^[\w-]{1,200}$/.test(input.lessonId) || !/^[\w-]{8,100}$/.test(input.requestId)
    || !['request', 'accepted', 'rejected'].includes(input.action)
    || (input.note !== undefined && (typeof input.note !== 'string' || input.note.length > 4000))) {
    throw new ScheduleError('Nieprawidłowe żądanie zmiany terminu.', 400)
  }
  const lessonRef = database.collection('lessons').doc(input.lessonId)
  const operationRef = lessonRef.collection('scheduleOperations').doc(`${uid}_${input.requestId}`)
  const fingerprint = JSON.stringify([input.action, input.dateIso ?? null, input.time ?? null, input.note ?? '', input.expectedRequestedAt ?? null])
  return database.runTransaction(async (tx) => {
    const [operation, snap, actorSnap] = await Promise.all([
      tx.get(operationRef), tx.get(lessonRef), tx.get(database.collection('users').doc(uid)),
    ])
    const actor = actorSnap.data()
    if (!actor || ['deactivated', 'deleted'].includes(actor.accountStatus)) throw new ScheduleError('Brak dostępu.', 403)
    if (!snap.exists) throw new ScheduleError('Nie znaleziono lekcji.', 404)
    const lesson = { ...snap.data(), id: snap.id } as Lesson
    const student = await tx.get(database.collection('users').doc(lesson.studentId))
    const admin = actor.role === 'admin'
    const teacherSide = uid === lesson.teacherId
    const studentSide = uid === lesson.studentId || uid === lesson.payerId
      || (actor.role === 'parent' && (student.data()?.linkedParentIds ?? []).includes(uid))
    if (!admin && !teacherSide && !studentSide) throw new ScheduleError('Brak dostępu do tej lekcji.', 403)
    if (operation.exists) {
      if (operation.data()?.fingerprint !== fingerprint) throw new ScheduleError('Identyfikator był już użyty dla innej operacji.')
      return operation.data()!.result as { event: 'change_requested' | 'rescheduled' | null; lesson: LessonEmailLesson; emailActorUid: string }
    }
    if (lesson.status !== 'upcoming' || (lessonStartAtMs(lesson) ?? 0) <= now) throw new ScheduleError('Możesz zmienić tylko przyszłą, potwierdzoną lekcję.')
    const requestedBy = teacherSide ? 'teacher' : 'student'
    const change = lesson.pendingChange
    if (input.action !== 'request' && (!change || change.type !== 'reschedule' || change.requestedAt !== input.expectedRequestedAt)) {
      throw new ScheduleError('Prośba zmieniła się. Odśwież lekcję.')
    }
    if (input.action !== 'request' && !admin && change?.requestedBy === requestedBy) throw new ScheduleError('Prośbę musi rozpatrzyć druga strona.', 403)
    if (input.action === 'request' && change && change.requestedBy !== requestedBy) throw new ScheduleError('Najpierw rozpatrz istniejącą prośbę.')
    const dateIso = input.action === 'request' ? input.dateIso : change?.newDateIso
    const time = input.action === 'request' ? input.time : change?.newTime
    let nextLocks: ReturnType<typeof database.doc>[] = []
    let oldLocks: ReturnType<typeof database.doc>[] = []
    if (input.action !== 'rejected') {
      const teacher = await tx.get(database.collection('teachers').doc(lesson.teacherId))
      const schedule = teacher.data()
      if (!schedule || (schedule.status && schedule.status !== 'approved') || !dateIso || !time
        || !isBookableDate(dateIso, now) || !fitsAvailability(schedule, dateIso, time, lesson.duration)) {
        throw new ScheduleError('Wybrany termin nie mieści się w dostępności nauczyciela.')
      }
      const active = await tx.get(database.collection('lessons').where('teacherId', '==', lesson.teacherId).where('status', 'in', ['pending', 'upcoming']))
      if (slotOverlapsBookedLesson({ dateIso, time, duration: lesson.duration, booked: active.docs.filter((doc) => doc.id !== lesson.id).map((doc) => doc.data() as Lesson) })) {
        throw new ScheduleError('Ten termin jest już zajęty.')
      }
      if (input.action === 'accepted') {
        nextLocks = lessonSlotLockIds(lesson.teacherId, dateIso, time, lesson.duration).map((id) => database.collection('lessonSlotLocks').doc(id))
        const locks = await Promise.all(nextLocks.map((ref) => tx.get(ref)))
        for (const lock of locks) {
          if (!lock.exists || lock.data()?.lessonId === lesson.id) continue
          const owner = lock.data()?.lessonId
          if (typeof owner !== 'string') throw new ScheduleError('Termin jest zablokowany.')
          const other = await tx.get(database.collection('lessons').doc(owner))
          if (other.exists && slotOverlapsBookedLesson({ dateIso, time, duration: lesson.duration, booked: [other.data() as Lesson] })) throw new ScheduleError('Ten termin jest już zajęty.')
        }
        const previous = await tx.get(database.collection('lessonSlotLocks').where('lessonId', '==', lesson.id))
        oldLocks = previous.docs.map((doc) => doc.ref)
      }
    }
    const version = Math.max(now, (change?.requestedAt ?? 0) + 1, (lesson.rescheduledAt ?? 0) + 1)
    const patch = input.action === 'request' ? {
      pendingChange: { type: 'reschedule' as const, requestedBy, requestedAt: version, newDate: polishDayLabelFromDateIso(dateIso!)!, newDateIso: dateIso!, newTime: time!, note: input.note?.trim() ?? '' },
    } : input.action === 'accepted' ? {
      pendingChange: null, dateIso: dateIso!, date: polishDayLabelFromDateIso(dateIso!)!, time: time!,
      scheduledStartAt: zonedDateTimeToMs(dateIso!, time!)!, rescheduledAt: now,
    } : { pendingChange: null }
    for (const ref of oldLocks) if (!nextLocks.some((next) => next.id === ref.id)) tx.delete(ref)
    for (const ref of nextLocks) tx.set(ref, { teacherId: lesson.teacherId, lessonId: lesson.id, dateIso, time, createdAt: now })
    tx.update(lessonRef, patch)
    const updated = { ...lesson, ...patch }
    const emailLesson: LessonEmailLesson = {
      id: lesson.id, teacherId: lesson.teacherId, studentId: lesson.studentId, payerId: lesson.payerId ?? lesson.studentId,
      teacherName: lesson.teacherName, studentName: lesson.studentName, topic: lesson.topic,
      date: updated.date, time: updated.time, status: lesson.status,
      pendingChange: updated.pendingChange ?? null,
      ...(updated.rescheduledAt ? { rescheduledAt: updated.rescheduledAt } : {}),
    }
    const result = { event: input.action === 'request' ? 'change_requested' as const : input.action === 'accepted' ? 'rescheduled' as const : null, lesson: emailLesson, emailActorUid: teacherSide ? lesson.teacherId : lesson.studentId }
    tx.set(operationRef, { fingerprint, result, actorUid: uid, createdAt: now })
    const recipient = input.action === 'request' ? (teacherSide ? lesson.studentId : lesson.teacherId) : (change?.requestedBy === 'teacher' ? lesson.teacherId : lesson.studentId)
    tx.set(database.collection('notifications').doc(`schedule_${lesson.id}_${uid}_${input.requestId}`), {
      userId: recipient, type: 'lesson', title: input.action === 'request' ? 'Prośba o przełożenie lekcji' : input.action === 'accepted' ? 'Termin lekcji zmieniony' : 'Prośba o przełożenie odrzucona',
      description: `${lesson.topic}${input.action !== 'rejected' ? `: ${dateIso} ${time}` : ''}`,
      date: new Date(now).toLocaleDateString('pl-PL', { timeZone: 'Europe/Warsaw' }), read: false, createdAt: now,
    })
    return result
  })
}
