import assert from 'node:assert/strict'
import test from 'node:test'
import {
  formatTeachingLevels,
  normalizeTeachingLevels,
  teacherMatchesTeachingLevelFilter,
  teachingLevelLabel,
  teachingLevels,
} from '../lib/teaching-levels.ts'

test('teaching levels expose stable ids separately from UI labels', () => {
  assert.deepEqual(teachingLevels.map((level) => level.id), [
    'primary-school',
    'high-school',
    'technical-school',
    'matura',
    'university',
    'adults',
  ])
  assert.equal(teachingLevelLabel('primary-school'), 'Szkoła podstawowa')
})

test('legacy teacher without teachingLevels normalizes to an empty optional list', () => {
  assert.deepEqual(normalizeTeachingLevels(undefined), [])
  assert.equal(formatTeachingLevels(undefined), 'Nie podano')
})

test('normalizes multiple teaching levels without duplicates or unknown values', () => {
  assert.deepEqual(
    normalizeTeachingLevels(['primary-school', 'matura', 'matura', 'unknown', 'adults']),
    ['primary-school', 'matura', 'adults'],
  )
  assert.equal(formatTeachingLevels(['primary-school', 'matura']), 'Szkoła podstawowa, Matura')
})

test('teaching level marketplace filter keeps teachers visible when no level is selected', () => {
  assert.equal(teacherMatchesTeachingLevelFilter({ teachingLevels: undefined }, null), true)
})

test('teaching level marketplace filter matches selected levels only', () => {
  const teacher = { teachingLevels: ['primary-school', 'high-school'] }

  assert.equal(teacherMatchesTeachingLevelFilter(teacher, 'primary-school'), true)
  assert.equal(teacherMatchesTeachingLevelFilter(teacher, 'matura'), false)
})

test('legacy teacher without teachingLevels does not match an active level filter', () => {
  assert.equal(teacherMatchesTeachingLevelFilter({}, 'primary-school'), false)
})
