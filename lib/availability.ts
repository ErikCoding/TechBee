// ─────────────────────────────────────────────────────────────
// Turns a teacher's weekly availability (e.g. ['Mon','Wed','Fri'])
// into concrete bookable date/time slots for the next N days.
// A fixed daily slot template keeps this simple for the demo —
// a real implementation would read/write per-slot availability
// (and lock a slot once booked) in Firestore.
// ─────────────────────────────────────────────────────────────

const WEEKDAY_CODES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const WEEKDAY_LABELS_PL = ['Niedz', 'Pon', 'Wt', 'Śr', 'Czw', 'Pt', 'Sob']
const MONTHS_PL = ['sty', 'lut', 'mar', 'kwi', 'maj', 'cze', 'lip', 'sie', 'wrz', 'paź', 'lis', 'gru']
const DAILY_SLOTS = ['09:00', '11:00', '14:00', '16:00', '18:00']

export type AvailabilityDay = {
  isoDate: string
  weekdayLabel: string
  dayLabel: string
  slots: string[]
}

export function buildAvailability(availability: string[], daysAhead = 14): AvailabilityDay[] {
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
      // A couple of slots rotate out on some days so the calendar feels less mechanical.
      slots: (date.getDate() + i) % 3 === 0 ? DAILY_SLOTS.slice(0, 3) : DAILY_SLOTS.slice(0, 4),
    })
  }
  return days
}
