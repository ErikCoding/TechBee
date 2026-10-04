import assert from 'node:assert/strict'
import test from 'node:test'
import { normalizeTeacherApplicationCategoryIds } from '../lib/teacher-application-categories.ts'

const categories = [
  { id: 'plc' },
  { id: 'history' },
  { id: 'mathematics' },
]

test('teacher profile text does not auto-add matching category names', () => {
  const profileText = [
    'Programowanie PLC',
    'Historia automatyzacji w przemyśle',
    'TIA Portal, sterowniki PLC, Historia zmian w instalacji',
  ].join(' ')

  assert.equal(profileText.includes('Historia'), true)

  const selectedCategoryIds = normalizeTeacherApplicationCategoryIds(categories, 'plc', ['plc'])

  assert.deepEqual(selectedCategoryIds, ['plc'])
  assert.equal(selectedCategoryIds.includes('history'), false)
})
