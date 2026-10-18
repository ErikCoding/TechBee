import assert from 'node:assert/strict'
import test from 'node:test'
import { typescriptLoader } from './helpers/load-typescript.mjs'

const load = typescriptLoader()
const { normalizeIntervals, normalizeAvailability, availabilityIntervals, fitsAvailability, warsawDateIso, isBookableDate } = load('lib/availability-core.ts')
const { buildAvailability } = load('lib/availability.ts')
const { lessonSlotLockIds } = load('lib/lesson-slot-locks.ts')
const legacy = { availability: ['Mon'], availabilityStart: '08:00', availabilityEnd: '12:00' }
const multi = { ...legacy, availabilityHours: { Mon: { start: '08:00', end: '12:00', intervals: [{ start: '18:00', end: '21:00' }, { start: '08:00', end: '12:00' }] } } }

test('old global and per-day schedules retain their windows without migration', () => {
  assert.deepEqual(availabilityIntervals('Mon', legacy), [{ start: '08:00', end: '12:00' }])
  assert.deepEqual(availabilityIntervals('Mon', { ...legacy, availabilityHours: { Mon: { start: '09:00', end: '11:00' } } }), [{ start: '09:00', end: '11:00' }])
})
test('multiple ranges sort, round-trip and preserve inactive day hours', () => {
  const saved = normalizeAvailability(multi)
  assert.equal(saved.Mon.intervals[0].start, '08:00')
  assert.deepEqual(normalizeAvailability({ ...multi, availability: [], availabilityHours: saved }), saved)
  assert.equal(fitsAvailability({ ...multi, availability: [] }, '2026-10-19', '09:00', 60), false)
  assert.equal(fitsAvailability({ ...multi, availabilityHours: saved }, '2026-10-19', '18:00', 120), true)
  assert.equal(normalizeIntervals(Array.from({ length: 6 }, (_, i) => ({ start: `${10 + i}:00`, end: `${10 + i}:30` }))).length, 6)
})
test('invalid, reversed, overlapping and empty intervals are rejected', () => {
  for (const ranges of [[], [{ start: '25:00', end: '26:00' }], [{ start: '10:00', end: '10:00' }], [{ start: '11:00', end: '10:00' }], [{ start: '9:00', end: '10:00' }], [{ start: '09:00:00', end: '10:00' }], [{ start: '08:00', end: '12:00' }, { start: '11:00', end: '13:00' }]]) {
    assert.throws(() => normalizeIntervals(ranges))
  }
})
test('all of a lesson must fit one interval, including at exact boundaries', () => {
  for (const [time, duration, allowed] of [['08:00', 60, true], ['11:00', 60, true], ['11:30', 60, false], ['14:00', 60, false], ['11:00', 480, false], ['18:00', 120, true], ['20:00', 60, true], ['20:30', 60, false]]) {
    assert.equal(fitsAvailability(multi, '2026-10-19', time, duration), allowed)
  }
  assert.equal(fitsAvailability(multi, '2026-10-20', '09:00', 60), false)
  assert.equal(fitsAvailability(multi, '2026-02-30', '09:00', 60), false)
})
test('Warsaw date boundaries and DST are independent of the machine zone', () => {
  assert.equal(warsawDateIso(Date.parse('2026-10-18T22:30:00Z')), '2026-10-19')
  assert.equal(isBookableDate('2026-10-19', Date.parse('2026-10-18T22:30:00Z')), false)
  const sunday = { availability: ['Sun'], availabilityStart: '01:00', availabilityEnd: '05:00' }
  assert.equal(fitsAvailability(sunday, '2026-03-29', '02:30', 30), false)
  assert.equal(fitsAvailability(sunday, '2026-03-29', '03:30', 30), true)
  assert.equal(fitsAvailability(sunday, '2026-03-29', '01:30', 120), false)
  assert.equal(fitsAvailability(sunday, '2026-10-25', '01:30', 120), false)
  assert.equal(fitsAvailability(sunday, '2026-10-25', '02:30', 30), true)
})
test('calendar respects breaks, lesson end and existing booking buffer', () => {
  const schedule = { ...multi, availability: ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'] }
  const first = buildAvailability(schedule.availability, { start: '08:00', end: '12:00' }, 1)[0]
  const weekday = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][new Date(`${first.isoDate}T12:00:00Z`).getUTCDay()]
  const options = { duration: 60, availabilityHours: { [weekday]: multi.availabilityHours.Mon }, bookedLessons: [{ dateIso: first.isoDate, time: '09:00', duration: 60, status: 'upcoming' }] }
  const slots = buildAvailability(schedule.availability, undefined, 1, options)[0].slots
  assert.equal(slots.find((slot) => slot.time === '18:00').status, 'available')
  assert.equal(slots.some((slot) => slot.time === '14:00'), false)
  assert.equal(slots.find((slot) => slot.time === '11:30').status, 'outside')
  assert.equal(slots.find((slot) => slot.time === '10:00').status, 'booked')
})
test('off-grid starts share locks with overlapping on-grid bookings', () => {
  const one = lessonSlotLockIds('teacher', '2026-10-19', '08:00', 60)
  const two = lessonSlotLockIds('teacher', '2026-10-19', '08:10', 60)
  assert.ok(one.some((id) => two.includes(id)))
  assert.ok(one.includes('teacher__2026-10-19__09-00'))
})
