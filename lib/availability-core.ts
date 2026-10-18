import type { AvailabilityHours, AvailabilityInterval, WeekdayCode } from './types'
import { LESSON_TIME_ZONE, minutesToTime, timeToMinutes, timestampMatchesZonedDateTime, zonedDateTimeToMs } from './lesson-time'

export const WEEKDAY_CODES: WeekdayCode[] = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
export const BOOKING_WINDOW_DAYS = 30
export const DEFAULT_AVAILABILITY_HOURS = { start: '09:00', end: '17:00' }
export type AvailabilitySchedule = {
  availability?: string[]
  availabilityStart?: string
  availabilityEnd?: string
  availabilityHours?: AvailabilityHours
}

export function normalizeIntervals(value: unknown): AvailabilityInterval[] {
  if (!Array.isArray(value) || !value.length) throw new Error('Dodaj przynajmniej jeden przedział albo wyłącz dzień.')
  const intervals = value.map((item) => {
    if (!item || typeof item.start !== 'string' || typeof item.end !== 'string'
      || !/^\d{2}:\d{2}$/.test(item.start) || !/^\d{2}:\d{2}$/.test(item.end)) {
      throw new Error('Podaj godziny w formacie HH:MM.')
    }
    const start = timeToMinutes(item.start)
    const end = timeToMinutes(item.end)
    if (start === null || end === null || end <= start) throw new Error('Godzina „Do” musi być późniejsza niż „Od”.')
    return { start: item.start, end: item.end }
  }).sort((a, b) => a.start.localeCompare(b.start))
  for (let i = 1; i < intervals.length; i++) {
    if (intervals[i].start < intervals[i - 1].end) throw new Error('Przedziały godzin nie mogą się nakładać.')
  }
  return intervals
}

export function availabilityIntervals(day: WeekdayCode, schedule: AvailabilitySchedule): AvailabilityInterval[] {
  const entry = schedule.availabilityHours?.[day]
  return normalizeIntervals(entry && 'intervals' in entry ? entry.intervals : [{
    start: entry?.start || schedule.availabilityStart || DEFAULT_AVAILABILITY_HOURS.start,
    end: entry?.end || schedule.availabilityEnd || DEFAULT_AVAILABILITY_HOURS.end,
  }])
}

/** Validate active and retained inactive days before any trusted write. */
export function normalizeAvailability(schedule: AvailabilitySchedule): AvailabilityHours {
  if (!Array.isArray(schedule.availability) || schedule.availability.some((day) => !WEEKDAY_CODES.includes(day as WeekdayCode))) {
    throw new Error('Nieprawidłowe dni dostępności.')
  }
  if (schedule.availabilityHours != null && (typeof schedule.availabilityHours !== 'object' || Array.isArray(schedule.availabilityHours))) {
    throw new Error('Nieprawidłowy harmonogram.')
  }
  const result: AvailabilityHours = {}
  const days = new Set([...schedule.availability, ...Object.keys(schedule.availabilityHours ?? {})])
  for (const day of days) {
    if (!WEEKDAY_CODES.includes(day as WeekdayCode)) throw new Error('Nieprawidłowy dzień dostępności.')
    try {
      const intervals = availabilityIntervals(day as WeekdayCode, schedule)
      result[day as WeekdayCode] = { ...intervals[0], intervals }
    } catch (error) {
      throw new Error(`${day}: ${error instanceof Error ? error.message : 'Sprawdź godziny.'}`)
    }
  }
  return result
}

export function warsawDateIso(now = Date.now()): string {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: LESSON_TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(now)
  const part = (type: string) => parts.find((p) => p.type === type)!.value
  return `${part('year')}-${part('month')}-${part('day')}`
}

export function addCalendarDays(dateIso: string, count: number): string {
  const date = new Date(`${dateIso}T12:00:00Z`)
  date.setUTCDate(date.getUTCDate() + count)
  return date.toISOString().slice(0, 10)
}

export function fitsAvailability(schedule: AvailabilitySchedule, dateIso: string, time: string, duration: number): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateIso) || !/^\d{2}:\d{2}$/.test(time) || !Number.isInteger(duration) || duration <= 0) return false
  const timestamp = zonedDateTimeToMs(dateIso, time)
  if (timestamp === null || !timestampMatchesZonedDateTime(timestamp, dateIso, time)) return false
  const day = WEEKDAY_CODES[new Date(`${dateIso}T12:00:00Z`).getUTCDay()]
  if (!schedule.availability?.includes(day)) return false
  try {
    const start = timeToMinutes(time)!
    // A clock-change crossing has no one-to-one wall-clock slot/lock representation.
    if (start + duration >= 24 * 60 || !timestampMatchesZonedDateTime(timestamp + duration * 60000, dateIso, minutesToTime(start + duration))) return false
    return availabilityIntervals(day, schedule).some((range) => start >= timeToMinutes(range.start)! && start + duration <= timeToMinutes(range.end)!)
  } catch { return false }
}

export function isBookableDate(dateIso: string, now = Date.now(), maxDays = BOOKING_WINDOW_DAYS): boolean {
  const today = warsawDateIso(now)
  return dateIso > today && dateIso <= addCalendarDays(today, maxDays)
}

export function formatAvailabilityDay(day: WeekdayCode, schedule: AvailabilitySchedule): string {
  try { return availabilityIntervals(day, schedule).map(({ start, end }) => `${start}-${end}`).join(', ') }
  catch { return 'Godziny wymagają poprawy' }
}
