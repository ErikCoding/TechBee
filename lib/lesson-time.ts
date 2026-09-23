import type { BookedLessonSlot, Lesson } from '@/lib/types'

export const LESSON_JOIN_EARLY_MINUTES = 5
export const LESSON_BUFFER_MINUTES = 15
export const LESSON_END_WARNING_MINUTES = 10
export const LESSON_TIME_ZONE = 'Europe/Warsaw'

const DAY_MS = 24 * 60 * 60 * 1000
const MONTHS_PL = ['sty', 'lut', 'mar', 'kwi', 'maj', 'cze', 'lip', 'sie', 'wrz', 'paź', 'lis', 'gru']
const TIME_ZONE_FORMATTER_CACHE = new Map<string, Intl.DateTimeFormat>()

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

function formatterForTimeZone(timeZone: string): Intl.DateTimeFormat {
  const cached = TIME_ZONE_FORMATTER_CACHE.get(timeZone)
  if (cached) return cached
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    calendar: 'gregory',
    numberingSystem: 'latn',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  })
  TIME_ZONE_FORMATTER_CACHE.set(timeZone, formatter)
  return formatter
}

function zonedParts(timestamp: number, timeZone = LESSON_TIME_ZONE): {
  year: number
  month: number
  day: number
  hour: number
  minute: number
} | null {
  const date = new Date(timestamp)
  if (Number.isNaN(date.getTime())) return null
  const parts = formatterForTimeZone(timeZone).formatToParts(date)
  const value = (type: Intl.DateTimeFormatPartTypes) => Number(parts.find((part) => part.type === type)?.value)
  const result = {
    year: value('year'),
    month: value('month'),
    day: value('day'),
    hour: value('hour'),
    minute: value('minute'),
  }
  if (Object.values(result).some((part) => !Number.isFinite(part))) return null
  return result
}

function timeZoneOffsetAt(timestamp: number, timeZone = LESSON_TIME_ZONE): number {
  const parts = zonedParts(timestamp, timeZone)
  if (!parts) return 0
  const wallAsUtc = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute)
  return wallAsUtc - timestamp
}

export function zonedDateTimeToMs(dateIso: string, time: string, timeZone = LESSON_TIME_ZONE): number | null {
  const [year, month, day] = dateIso.split('-').map(Number)
  const minutes = timeToMinutes(time)
  if (
    minutes === null ||
    !Number.isFinite(year) ||
    !Number.isFinite(month) ||
    !Number.isFinite(day) ||
    month < 1 ||
    month > 12 ||
    day < 1 ||
    day > 31
  ) {
    return null
  }

  const wallAsUtc = Date.UTC(year, month - 1, day, Math.floor(minutes / 60), minutes % 60)
  const firstPass = wallAsUtc - timeZoneOffsetAt(wallAsUtc, timeZone)
  const secondPass = wallAsUtc - timeZoneOffsetAt(firstPass, timeZone)
  return Number.isNaN(secondPass) ? null : secondPass
}

export function timestampMatchesZonedDateTime(timestamp: number, dateIso: string, time: string, timeZone = LESSON_TIME_ZONE): boolean {
  const parts = zonedParts(timestamp, timeZone)
  if (!parts) return false
  const formattedDate = `${parts.year}-${String(parts.month).padStart(2, '0')}-${String(parts.day).padStart(2, '0')}`
  const formattedTime = `${String(parts.hour).padStart(2, '0')}:${String(parts.minute).padStart(2, '0')}`
  return formattedDate === dateIso && formattedTime === time
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
  const dateIso = lessonDateIso(lesson, reference)
  const wallClockStartAt = dateIso ? zonedDateTimeToMs(dateIso, lesson.time) : null
  if (typeof lesson.scheduledStartAt === 'number' && Number.isFinite(lesson.scheduledStartAt)) {
    if (!dateIso || timestampMatchesZonedDateTime(lesson.scheduledStartAt, dateIso, lesson.time)) {
      return lesson.scheduledStartAt
    }
    return wallClockStartAt ?? lesson.scheduledStartAt
  }
  return wallClockStartAt
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
