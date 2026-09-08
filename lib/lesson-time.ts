import type { BookedLessonSlot, Lesson } from '@/lib/types'

export const LESSON_JOIN_EARLY_MINUTES = 5
export const LESSON_BUFFER_MINUTES = 15
export const LESSON_END_WARNING_MINUTES = 10

const DAY_MS = 24 * 60 * 60 * 1000
const MONTHS_PL = ['sty', 'lut', 'mar', 'kwi', 'maj', 'cze', 'lip', 'sie', 'wrz', 'paź', 'lis', 'gru']

export function timeToMinutes(time: string): number | null {
  const [h, m] = time.split(':').map(Number)
  if (!Number.isFinite(h) || !Number.isFinite(m) || h < 0 || h > 23 || m < 0 || m > 59) return null
  return h * 60 + m
}

export function minutesToTime(minutes: number): string {
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

export function dateIsoFromLocalDate(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export function parsePolishDayLabel(dayLabel: string, reference = new Date()): string | null {
  const [, rawDayMonth] = dayLabel.split(',').map((part) => part.trim())
  if (!rawDayMonth) return null

  const [rawDay, rawMonth] = rawDayMonth.split(/\s+/)
  const day = Number(rawDay)
  const month = MONTHS_PL.findIndex((m) => m === rawMonth?.toLowerCase())
  if (!Number.isFinite(day) || day < 1 || month < 0) return null

  let year = reference.getFullYear()
  const candidate = new Date(year, month, day)
  if (candidate.getTime() < reference.getTime() - DAY_MS) {
    year += 1
  }
  return dateIsoFromLocalDate(new Date(year, month, day))
}

export function lessonDateIso(lesson: Pick<Lesson, 'date' | 'dateIso'>, reference = new Date()): string | null {
  return lesson.dateIso ?? parsePolishDayLabel(lesson.date, reference)
}

export function lessonStartAtMs(
  lesson: Pick<Lesson, 'scheduledStartAt' | 'date' | 'dateIso' | 'time'>,
  reference = new Date(),
): number | null {
  if (typeof lesson.scheduledStartAt === 'number') return lesson.scheduledStartAt
  const dateIso = lessonDateIso(lesson, reference)
  const minutes = timeToMinutes(lesson.time)
  if (!dateIso || minutes === null) return null
  const [year, month, day] = dateIso.split('-').map(Number)
  return new Date(year, month - 1, day, Math.floor(minutes / 60), minutes % 60).getTime()
}

export function lessonEndAtMs(lesson: Pick<Lesson, 'scheduledStartAt' | 'date' | 'dateIso' | 'time' | 'duration'>): number | null {
  const start = lessonStartAtMs(lesson)
  if (start === null) return null
  return start + lesson.duration * 60 * 1000
}

export function lessonAutoEndAtMs(lesson: Pick<Lesson, 'scheduledStartAt' | 'date' | 'dateIso' | 'time' | 'duration'>): number | null {
  const end = lessonEndAtMs(lesson)
  if (end === null) return null
  return end + LESSON_BUFFER_MINUTES * 60 * 1000
}

export function formatDurationClock(ms: number): string {
  const totalSeconds = Math.max(0, Math.ceil(ms / 1000))
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60
  if (hours > 0) return `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
  return `${minutes}:${String(seconds).padStart(2, '0')}`
}

export function canJoinLesson(
  lesson: Pick<Lesson, 'scheduledStartAt' | 'date' | 'dateIso' | 'time' | 'duration' | 'status'>,
  now = Date.now(),
  options: { allowEarlyJoin?: boolean } = {},
): { canJoin: boolean; reason?: string; startsAt?: number; autoEndsAt?: number } {
  if (lesson.status === 'pending') return { canJoin: false, reason: 'Lekcja czeka jeszcze na potwierdzenie nauczyciela.' }
  if (lesson.status === 'cancelled') return { canJoin: false, reason: 'Lekcja została odwołana.' }
  if (lesson.status === 'completed') return { canJoin: false, reason: 'Lekcja została już zakończona.' }

  const startsAt = lessonStartAtMs(lesson) ?? undefined
  const autoEndsAt = lessonAutoEndAtMs(lesson) ?? undefined
  if (!startsAt || !autoEndsAt || options.allowEarlyJoin) return { canJoin: true, startsAt, autoEndsAt }
  if (now < startsAt - LESSON_JOIN_EARLY_MINUTES * 60 * 1000) {
    return { canJoin: false, reason: 'Do lekcji będzie można dołączyć 5 minut przed startem.', startsAt, autoEndsAt }
  }
  if (now > autoEndsAt) {
    return { canJoin: false, reason: 'Czas tej lekcji już minął.', startsAt, autoEndsAt }
  }
  return { canJoin: true, startsAt, autoEndsAt }
}

export function activeBookingSlots(slots: BookedLessonSlot[]): BookedLessonSlot[] {
  return slots.filter((slot) => slot.status === 'pending' || slot.status === 'upcoming')
}

export function slotOverlapsBookedLesson({
  dateIso,
  time,
  duration,
  booked,
}: {
  dateIso: string
  time: string
  duration: number
  booked: BookedLessonSlot[]
}): boolean {
  const start = timeToMinutes(time)
  if (start === null) return true
  const end = start + duration + LESSON_BUFFER_MINUTES

  return activeBookingSlots(booked).some((lesson) => {
    const lessonIso = lesson.dateIso ?? parsePolishDayLabel(lesson.date)
    const lessonStart = timeToMinutes(lesson.time)
    if (lessonIso !== dateIso || lessonStart === null) return false
    const lessonEnd = lessonStart + lesson.duration + LESSON_BUFFER_MINUTES
    return start < lessonEnd && lessonStart < end
  })
}
