import assert from 'node:assert/strict'
import test from 'node:test'
import { buildLedgerEntries, csvCell, ledgerToCsv, quarterRangeFor, summarizeQuarter, warningLevel } from '../lib/revenue-ledger-core.ts'
import { hasWithdrawalConsent } from '../lib/withdrawal-consent.ts'

const inQ4 = new Date('2026-11-10T10:00:00.000Z').getTime()
const inQ3 = new Date('2026-09-20T10:00:00.000Z').getTime()

test('quarter range uses Europe/Warsaw calendar quarters', () => {
  const q = quarterRangeFor(inQ4)
  assert.equal(q.label, '2026 Q4')
  assert.ok(q.startMs <= new Date('2026-10-01T00:00:00+02:00').getTime() + 1)
  assert.equal(new Date(q.endMs).toISOString(), '2026-12-31T23:00:00.000Z')
  assert.equal(quarterRangeFor(inQ3).label, '2026 Q3')
})

test('ledger counts only paid live lessons and packages, skips package-source lessons and refunds', () => {
  const entries = buildLedgerEntries([
    { id: 'a', paymentStatus: 'paid', livemode: true, createdAt: inQ4, subtotalGrosze: 10000, studentServiceFeeGrosze: 299, studentTotalGrosze: 10299, platformFeeGrosze: 800, teacherAmountGrosze: 9200 },
    { id: 'b', paymentStatus: 'refunded', livemode: true, createdAt: inQ4, studentTotalGrosze: 5000 },
    { id: 'c', paymentStatus: 'paid', livemode: false, createdAt: inQ4, studentTotalGrosze: 5000 },
    { id: 'd', paymentStatus: 'paid', livemode: true, paymentSource: 'package', createdAt: inQ4, studentTotalGrosze: 5000 },
  ], [
    { id: 'p', livemode: true, status: 'active', createdAt: inQ4, packageSize: 5, usedCredits: 2, subtotalGrosze: 50000, studentServiceFeeGrosze: 1500, studentTotalGrosze: 51500, platformFeePerLessonGrosze: 800 },
    { id: 'q', livemode: true, status: 'refunded', createdAt: inQ4, studentTotalGrosze: 99999 },
  ])
  assert.deepEqual(entries.map((e) => e.documentId), ['a', 'p'])
  const summary = summarizeQuarter(entries, quarterRangeFor(inQ4), 10813.5)
  assert.equal(summary.runbeeRevenueGrosze, 299 + 800 + 1500 + 1600)
  assert.equal(summary.turnoverGrosze, 10299 + 51500)
  assert.equal(summary.entryCount, 2)
})

test('entries from another quarter do not count', () => {
  const entries = buildLedgerEntries([{ id: 'x', paymentStatus: 'paid', livemode: true, createdAt: inQ3, studentTotalGrosze: 100000, platformFeeGrosze: 8000 }], [])
  assert.equal(summarizeQuarter(entries, quarterRangeFor(inQ4), 10813.5).turnoverGrosze, 0)
})

test('warning thresholds at 80%, 95% and 100%', () => {
  assert.equal(warningLevel(0.79), 'none')
  assert.equal(warningLevel(0.8), 'warning_80')
  assert.equal(warningLevel(0.95), 'warning_95')
  assert.equal(warningLevel(1), 'exceeded')
})

test('csv escapes separators, quotes and spreadsheet formulas', () => {
  assert.equal(csvCell('a;b'), '"a;b"')
  assert.equal(csvCell('say "hi"'), '"say ""hi"""')
  assert.equal(csvCell('=SUM(A1)'), "'=SUM(A1)")
  assert.equal(csvCell(12), '12')
  const csv = ledgerToCsv(buildLedgerEntries([{ id: 'a', paymentStatus: 'paid', livemode: true, createdAt: inQ4, subtotalGrosze: 10000, studentServiceFeeGrosze: 299, studentTotalGrosze: 10299, platformFeeGrosze: 800, teacherAmountGrosze: 9200 }], []))
  assert.ok(csv.startsWith('﻿Data płatności;'))
  assert.ok(csv.includes('102,99;2,99;8,00;10,99;92,00'))
  assert.ok(csv.includes('brak'))
})

test('withdrawal consent must be explicitly true', () => {
  assert.equal(hasWithdrawalConsent(true), true)
  for (const v of [false, undefined, null, 'true', 1]) assert.equal(hasWithdrawalConsent(v), false)
})
