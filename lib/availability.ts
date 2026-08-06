// ─────────────────────────────────────────────────────────────
// Turns a teacher's weekly availability (e.g. ['Mon','Wed','Fri']
// plus a working-hours window like "09:00"–"17:00", both set on the
// teacher application form) into concrete bookable date/time slots
// for the next N days. A real implementation would read/write
// per-slot availability (and lock a slot once booked) in Firestore —
// this generates slots from the teacher's real hour range, but
// doesn't yet check which ones are already booked elsewhere.
// ─────────────────────────────────────────────────────────────

const WEEKDAY_CODES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const WEEKDAY_LABELS_PL = ['Niedz', 'Pon', 'Wt', 'Śr', 'Czw', 'Pt', 'Sob']
const MONTHS_PL = ['sty', 'lut', 'mar', 'kwi', 'maj', 'cze', 'lip', 'sie', 'wrz', 'paź', 'lis', 'gru']
const DEFAULT_HOURS = { start: '09:00', end: '17:00' }

export type AvailabilityDay = {
  isoDate: string
  weekdayLabel: string
  dayLabel: string
  slots: string[]
}

/** Every hour on the hour between `start` and `end` (exclusive of end, since a lesson needs at least an hour after it) — e.g. "09:00"–"13:00" → ["09:00","10:00","11:00","12:00"]. */
function generateHourlySlots(start: string, end: string): string[] {
  const [startH] = start.split(':').map(Number)
  const [endH] = end.split(':').map(Number)
  if (!Number.isFinite(startH) || !Number.isFinite(endH) || endH <= startH) {
    return ['09:00', '11:00', '14:00', '16:00']
  }
  const slots: string[] = []
  for (let h = startH; h < endH; h++) {
    slots.push(`${String(h).padStart(2, '0')}:00`)
  }
  return slots
}

export function buildAvailability(
  availability: string[],
  hours: { start: string; end: string } = DEFAULT_HOURS,
  daysAhead = 14,
): AvailabilityDay[] {
  const allSlots = generateHourlySlots(hours.start || DEFAULT_HOURS.start, hours.end || DEFAULT_HOURS.end)
  const days: AvailabilityDay[] = []
  const today = new Date()
  for (let i = 1; i <= daysAhead; i++) {
    const date = new Date(today)
    date.setDate(today.getDate() + i)
    const code = WEEKDAY_CODES[date.getDay()]
    if (!availability.includes(code)) continue
    days.push({
      isoDate: date.toISOString().slice(0, 10),
      weekdayLabel: WEEKDAY_LABELS_PL[date.getDay()],
      dayLabel: `${WEEKDAY_LABELS_PL[date.getDay()]}, ${date.getDate()} ${MONTHS_PL[date.getMonth()]}`,
      // A slot rotates out on some days so the calendar feels less mechanical, without ever going below 2 remaining options.
      slots: (date.getDate() + i) % 3 === 0 && allSlots.length > 2 ? allSlots.slice(0, -1) : allSlots,
    })
  }
  return days
}
