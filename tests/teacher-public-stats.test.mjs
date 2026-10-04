import assert from 'node:assert/strict'
import test from 'node:test'
import { computeTeacherPublicStatsFromLessons } from '../lib/teacher-public-stats.ts'

test('teacher public stats count completed lessons and unique students only', () => {
  const stats = computeTeacherPublicStatsFromLessons([
    { status: 'completed', studentId: 'student-1' },
    { status: 'completed', studentId: 'student-1' },
    { status: 'completed', studentId: 'student-2' },
    { status: 'upcoming', studentId: 'student-3' },
    { status: 'pending', studentId: 'student-4' },
    { status: 'cancelled', studentId: 'student-5' },
  ])

  assert.deepEqual(stats, {
    lessons: 3,
    students: 2,
  })
})

test('teacher public stats return zeroes when there are no completed lessons', () => {
  assert.deepEqual(
    computeTeacherPublicStatsFromLessons([
      { status: 'pending', studentId: 'student-1' },
      { status: 'upcoming', studentId: 'student-2' },
    ]),
    { lessons: 0, students: 0 },
  )
})
