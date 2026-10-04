import assert from 'node:assert/strict'
import test from 'node:test'
import {
  buildWeeklyLessonOccurrences,
  canJoinLesson,
  lessonStartAtMs,
  timestampMatchesZonedDateTime,
  zonedDateTimeToMs,
} from '../lib/lesson-time.ts'

test('converts Europe/Warsaw summer lesson time to the correct UTC instant', () => {
  assert.equal(zonedDateTimeToMs('2026-09-23', '19:00'), Date.parse('2026-09-23T17:00:00.000Z'))
})

test('converts Europe/Warsaw winter lesson time without hardcoded summer offset', () => {
  assert.equal(zonedDateTimeToMs('2026-12-23', '19:00'), Date.parse('2026-12-23T18:00:00.000Z'))
})

test('detects a stored UTC timestamp that no longer matches the booking wall time', () => {
  const wrongProductionTimestamp = Date.parse('2026-09-23T19:00:00.000Z')
  const correctTimestamp = Date.parse('2026-09-23T17:00:00.000Z')

  assert.equal(timestampMatchesZonedDateTime(wrongProductionTimestamp, '2026-09-23', '19:00'), false)
  assert.equal(timestampMatchesZonedDateTime(correctTimestamp, '2026-09-23', '19:00'), true)
})

test('lessonStartAtMs repairs the old UTC-server offset when dateIso and time disagree with scheduledStartAt', () => {
  const lesson = {
    scheduledStartAt: Date.parse('2026-09-23T19:00:00.000Z'),
    date: '23 wrz',
    dateIso: '2026-09-23',
    time: '19:00',
  }

  assert.equal(lessonStartAtMs(lesson), Date.parse('2026-09-23T17:00:00.000Z'))
})

test('join window opens exactly 5 minutes before the Europe/Warsaw lesson start', () => {
  const lesson = {
    date: '23 wrz',
    dateIso: '2026-09-23',
    time: '19:00',
    duration: 60,
    status: 'upcoming',
  }

  assert.equal(canJoinLesson(lesson, Date.parse('2026-09-23T16:54:59.999Z')).canJoin, false)
  assert.equal(canJoinLesson(lesson, Date.parse('2026-09-23T16:55:00.000Z')).canJoin, true)
})

test('timezone helpers do not throw when the browser cannot resolve the IANA time zone', () => {
  const fallback = zonedDateTimeToMs('2026-09-23', '19:00', 'Unsupported/Zone')
  assert.equal(Number.isFinite(fallback), true)
  assert.equal(timestampMatchesZonedDateTime(Date.parse('2026-09-23T17:00:00.000Z'), '2026-09-23', '19:00', 'Unsupported/Zone'), true)
})

test('weekly lesson occurrences keep the same Europe/Warsaw wall-clock time across DST', () => {
  const occurrences = buildWeeklyLessonOccurrences({ firstDateIso: '2026-10-20', time: '18:00', count: 3 })
  assert.deepEqual(occurrences?.map((occurrence) => ({ dateIso: occurrence.dateIso, time: occurrence.time })), [
    { dateIso: '2026-10-20', time: '18:00' },
    { dateIso: '2026-10-27', time: '18:00' },
    { dateIso: '2026-11-03', time: '18:00' },
  ])
  assert.equal(occurrences?.[0].scheduledStartAt, Date.parse('2026-10-20T16:00:00.000Z'))
  assert.equal(occurrences?.[1].scheduledStartAt, Date.parse('2026-10-27T17:00:00.000Z'))
  assert.equal(timestampMatchesZonedDateTime(occurrences?.[1].scheduledStartAt ?? 0, '2026-10-27', '18:00'), true)
})
