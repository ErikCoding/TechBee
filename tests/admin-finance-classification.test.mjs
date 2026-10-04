import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
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

test('admin finance UI labels per-row net as transaction net, not full Runbee net', () => {
  const source = readFileSync(new URL('../components/admin/admin-platform-wallet.tsx', import.meta.url), 'utf8')

  assert.equal(source.includes('Netto transakcji'), true)
  assert.equal(source.includes('Wynik Runbee'), true)
  assert.equal(source.includes('Runbee netto'), false)
  assert.equal(source.includes('Zarobek netto Runbee'), false)
})

test('global Stripe/Connect details moved out of the green summary tile and into payment history', () => {
  const source = readFileSync(new URL('../components/admin/admin-platform-wallet.tsx', import.meta.url), 'utf8')

  assert.equal(source.includes('Ostatnie płatności i koszty'), true)
  assert.equal(source.includes('Globalne koszty Stripe/Connect'), false)
  assert.equal(source.includes("entry.transactionType === 'stripe_connect_fee'"), true)
})
