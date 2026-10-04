import assert from 'node:assert/strict'
import test from 'node:test'
import { classifyLessonFinanceEntry, classifyPackageFinanceEntry } from '../lib/admin-finance-classification.ts'

test('single lessons are classified separately from trial and package-funded lessons', () => {
  assert.equal(classifyLessonFinanceEntry({}), 'single_lesson')
  assert.equal(classifyLessonFinanceEntry({ lessonKind: 'regular' }), 'single_lesson')
})

test('trial lessons are classified from lessonKind', () => {
  assert.equal(classifyLessonFinanceEntry({ lessonKind: 'trial' }), 'trial_lesson')
})

test('package-funded lessons are classified from paymentSource and do not depend on lessonKind', () => {
  assert.equal(classifyLessonFinanceEntry({ paymentSource: 'package', lessonKind: 'regular' }), 'package_lesson')
  assert.equal(classifyLessonFinanceEntry({ paymentSource: 'package', lessonKind: 'trial' }), 'package_lesson')
})

test('package purchases 5 and 10 use the package purchase classification', () => {
  assert.equal(classifyPackageFinanceEntry({ packageSize: 5 }), 'package_purchase')
  assert.equal(classifyPackageFinanceEntry({ packageSize: 10 }), 'package_purchase')
})
