// ─────────────────────────────────────────────────────────────
// Turns a teacher's weekly availability into concrete bookable slots,
// including lesson length, a 15-minute post-lesson buffer and already
// booked/pending lessons. The same calculations are reused by the
// client calendar and the server-side Stripe checkout guard.
// ─────────────────────────────────────────────────────────────

import type { AvailabilityHours, BookedLessonSlot, WeekdayCode } from '@/lib/types'
import { dateIsoFromLocalDate, minutesToTime, slotOverlapsBookedLesson, timeToMinutes } from '@/lib/lesson-time'

const WEEKDAY_CODES: WeekdayCode[] = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const WEEKDAY_LABELS_PL = ['Niedz', 'Pon', 'Wt', 'Śr', 'Czw', 'Pt', 'Sob']
const MONTHS_PL = ['sty', 'lut', 'mar', 'kwi', 'maj', 'cze', 'lip', 'sie', 'wrz', 'paź', 'lis', 'gru']
const DEFAULT_HOURS = { start: '09:00', end: '17:00' }
export const BOOKING_WINDOW_DAYS = 30
export const DEFAULT_AVAILABILITY_HOURS = DEFAULT_HOURS

export type AvailabilitySlot = {
  time: string
  status: 'available' | 'booked' | 'outside'
}

export type AvailabilityDay = {
  isoDate: string
  weekdayLabel: string
  dayLabel: string
  slots: AvailabilitySlot[]
}

export type WorkingHours = { start: string; end: string }

export function getAvailabilityHoursForWeekday(
  weekday: WeekdayCode,
  fallback: WorkingHours = DEFAULT_HOURS,
  availabilityHours?: AvailabilityHours,
): WorkingHours {
  const dayHours = availabilityHours?.[weekday]
  return {
    start: dayHours?.start || fallback.start || DEFAULT_HOURS.start,
    end: dayHours?.end || fallback.end || DEFAULT_HOURS.end,
  }
}

/** Half-hour starts inside the teacher's working window. A slot still has to fit the whole lesson before it becomes bookable. */
function generatePotentialSlots(start: string, end: string): string[] {
  const startMin = timeToMinutes(start)
  const endMin = timeToMinutes(end)
  if (startMin === null || endMin === null || endMin <= startMin) {
    return ['09:00', '10:30', '12:00', '14:00', '15:30']
  }
  const slots: string[] = []
  for (let m = startMin; m < endMin; m += 30) {
    slots.push(minutesToTime(m))
  }
  return slots
}

export function buildAvailability(
  availability: string[],
  hours: { start: string; end: string } = DEFAULT_HOURS,
  daysAhead = BOOKING_WINDOW_DAYS,
  options: { duration?: number; bookedLessons?: BookedLessonSlot[]; availabilityHours?: AvailabilityHours } = {},
): AvailabilityDay[] {
  const duration = options.duration ?? 60
  const bookedLessons = options.bookedLessons ?? []
  const days: AvailabilityDay[] = []
  const today = new Date()
  for (let i = 1; i <= daysAhead; i++) {
    const date = new Date(today)
    date.setDate(today.getDate() + i)
    const code = WEEKDAY_CODES[date.getDay()]
    if (!availability.includes(code)) continue
    const isoDate = dateIsoFromLocalDate(date)
    const dayHours = getAvailabilityHoursForWeekday(code, hours, options.availabilityHours)
    const allSlots = generatePotentialSlots(dayHours.start, dayHours.end)
    const endMin = timeToMinutes(dayHours.end) ?? timeToMinutes(DEFAULT_HOURS.end)!
    const slots = allSlots.map((time) => {
      const startMin = timeToMinutes(time)
      const fitsWorkingWindow = startMin !== null && startMin + duration <= endMin
      const booked = fitsWorkingWindow && slotOverlapsBookedLesson({
        dateIso: isoDate,
        time,
        duration,
        booked: bookedLessons,
      })
      return {
        time,
        status: !fitsWorkingWindow ? 'outside' : booked ? 'booked' : 'available',
      } satisfies AvailabilitySlot
    })

    days.push({
      isoDate,
      weekdayLabel: WEEKDAY_LABELS_PL[date.getDay()],
      dayLabel: `${WEEKDAY_LABELS_PL[date.getDay()]}, ${date.getDate()} ${MONTHS_PL[date.getMonth()]}`,
      slots,
    })
  }
  return days
}
