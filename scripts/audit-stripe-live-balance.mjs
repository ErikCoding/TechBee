#!/usr/bin/env node

import Stripe from 'stripe'

const secretKey = process.env.STRIPE_SECRET_KEY

if (!secretKey) {
  console.error('Missing STRIPE_SECRET_KEY in the terminal environment.')
  process.exit(1)
}

if (!secretKey.startsWith('sk_live_')) {
  console.error('Refusing to run: STRIPE_SECRET_KEY must be a live key (sk_live_...).')
  process.exit(1)
}

const stripe = new Stripe(secretKey, {
  apiVersion: '2026-07-29.dahlia',
  appInfo: { name: 'Runbee balance audit', version: '1.0.0' },
})

const PLN = new Intl.NumberFormat('pl-PL', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

function money(amount) {
  if (typeof amount !== 'number' || !Number.isFinite(amount)) return '—'
  return `${PLN.format(amount / 100)}`
}

function iso(seconds) {
  if (!seconds) return '—'
  return new Date(seconds * 1000).toISOString()
}

function maskId(value) {
  if (!value) return null
  const id = typeof value === 'string' ? value : value.id
  if (!id || typeof id !== 'string') return null
  if (id.length <= 10) return `${id.slice(0, 3)}…`
  return `${id.slice(0, 5)}…${id.slice(-4)}`
}

function sourceId(source) {
  if (!source) return null
  return typeof source === 'string' ? source : source.id
}

function sourceType(source) {
  if (!source) return null
  return typeof source === 'string' ? source.split('_')[0] : source.object
}

function add(group, key, bt) {
  if (!group[key]) {
    group[key] = { count: 0, amount: 0, fee: 0, net: 0 }
  }
  group[key].count += 1
  group[key].amount += bt.amount ?? 0
  group[key].fee += bt.fee ?? 0
  group[key].net += bt.net ?? 0
}

function compactBalanceTransaction(bt) {
  return {
    id: maskId(bt.id),
    date: iso(bt.created),
    type: bt.type,
    amount: bt.amount,
    amountPln: money(bt.amount),
    fee: bt.fee,
    feePln: money(bt.fee),
    net: bt.net,
    netPln: money(bt.net),
    status: bt.status,
    availableOn: iso(bt.available_on),
    currency: bt.currency,
    sourceType: sourceType(bt.source),
    sourceId: maskId(bt.source),
  }
}

async function fetchAllBalanceTransactions() {
  const rows = []
  await stripe.balanceTransactions
    .list({
      limit: 100,
      expand: ['data.source'],
    })
    .autoPagingEach((bt) => {
      rows.push(bt)
    })
  rows.sort((a, b) => a.created - b.created || String(a.id).localeCompare(String(b.id)))
  return rows
}

async function getBalanceTransaction(id) {
  if (!id) return null
  if (typeof id !== 'string') return id
  return stripe.balanceTransactions.retrieve(id)
}

async function getCharge(idOrCharge) {
  if (!idOrCharge) return null
  if (typeof idOrCharge !== 'string') return idOrCharge
  return stripe.charges.retrieve(idOrCharge, {
    expand: ['balance_transaction', 'payment_intent'],
  })
}

async function getPaymentIntent(idOrPaymentIntent) {
  if (!idOrPaymentIntent) return null
  if (typeof idOrPaymentIntent !== 'string') return idOrPaymentIntent
  return stripe.paymentIntents.retrieve(idOrPaymentIntent)
}

async function getRefund(idOrRefund) {
  if (!idOrRefund) return null
  if (typeof idOrRefund !== 'string') return idOrRefund
  return stripe.refunds.retrieve(idOrRefund, {
    expand: ['charge.balance_transaction', 'payment_intent'],
  })
}

async function describeRefund(refundBt) {
  const refundId = sourceId(refundBt.source)
  if (!refundId) {
    return {
      refundBalanceTransaction: compactBalanceTransaction(refundBt),
      error: 'Refund balance transaction has no source refund id.',
    }
  }

  const refund = await getRefund(refundId)
  const charge = await getCharge(refund.charge)
  const paymentIntent = await getPaymentIntent(refund.payment_intent || charge?.payment_intent)
  const chargeBt = await getBalanceTransaction(charge?.balance_transaction)
  const refundAmount = refund.amount ?? Math.abs(refundBt.amount ?? 0)
  const chargeAmount = charge?.amount ?? null
  const fullRefund = typeof chargeAmount === 'number' ? refundAmount >= chargeAmount : null

  return {
    refundId: maskId(refund.id),
    chargeId: maskId(charge?.id),
    paymentIntentId: maskId(paymentIntent?.id || refund.payment_intent || charge?.payment_intent),
    date: iso(refund.created || refundBt.created),
    chargeAmount,
    chargeAmountPln: money(chargeAmount),
    chargeFee: chargeBt?.fee ?? null,
    chargeFeePln: money(chargeBt?.fee),
    chargeNet: chargeBt?.net ?? null,
    chargeNetPln: money(chargeBt?.net),
    refundAmount,
    refundAmountPln: money(refundAmount),
    refundBalanceTransactionAmount: refundBt.amount,
    refundBalanceTransactionAmountPln: money(refundBt.amount),
    refundBalanceTransactionFee: refundBt.fee,
    refundBalanceTransactionFeePln: money(refundBt.fee),
    refundBalanceTransactionNet: refundBt.net,
    refundBalanceTransactionNetPln: money(refundBt.net),
    fullOrPartial: fullRefund === null ? 'unknown' : fullRefund ? 'full' : 'partial',
    feeReturnedOrAdjustment: (refundBt.fee ?? 0) < 0,
    finalOperationNet: (chargeBt?.net ?? 0) + (refundBt.net ?? 0),
    finalOperationNetPln: money((chargeBt?.net ?? 0) + (refundBt.net ?? 0)),
    chargeBalanceTransaction: chargeBt ? compactBalanceTransaction(chargeBt) : null,
    refundBalanceTransaction: compactBalanceTransaction(refundBt),
  }
}

function printTable(title, rows) {
  console.log(`\n${title}`)
  console.log('-'.repeat(title.length))
  console.log(JSON.stringify(rows, null, 2))
}

const balanceTransactions = await fetchAllBalanceTransactions()
const balance = await stripe.balance.retrieve()

const totals = { count: 0, amount: 0, fee: 0, net: 0 }
const byType = {}
const byStatus = {}

for (const bt of balanceTransactions) {
  totals.count += 1
  totals.amount += bt.amount ?? 0
  totals.fee += bt.fee ?? 0
  totals.net += bt.net ?? 0
  add(byType, bt.type || 'unknown', bt)
  add(byStatus, bt.status || 'unknown', bt)
}

const refunds = []
for (const bt of balanceTransactions.filter((row) => row.type === 'refund')) {
  try {
    refunds.push(await describeRefund(bt))
  } catch (err) {
    refunds.push({
      refundBalanceTransaction: compactBalanceTransaction(bt),
      error: err instanceof Error ? err.message : String(err),
    })
  }
}

const currentBalance = {
  available: balance.available.map((row) => ({
    amount: row.amount,
    amountPln: money(row.amount),
    currency: row.currency,
    sourceTypes: row.source_types,
  })),
  pending: balance.pending.map((row) => ({
    amount: row.amount,
    amountPln: money(row.amount),
    currency: row.currency,
    sourceTypes: row.source_types,
  })),
}

const compactTransactions = balanceTransactions.map(compactBalanceTransaction)

printTable('All balance transactions', compactTransactions)
printTable('Refund analysis', refunds)
printTable('Reconciliation totals', {
  allBalanceTransactions: {
    count: totals.count,
    amount: totals.amount,
    amountPln: money(totals.amount),
    fee: totals.fee,
    feePln: money(totals.fee),
    net: totals.net,
    netPln: money(totals.net),
  },
  byType: Object.fromEntries(Object.entries(byType).map(([key, value]) => [key, {
    ...value,
    amountPln: money(value.amount),
    feePln: money(value.fee),
    netPln: money(value.net),
  }])),
  byStatus: Object.fromEntries(Object.entries(byStatus).map(([key, value]) => [key, {
    ...value,
    amountPln: money(value.amount),
    feePln: money(value.fee),
    netPln: money(value.net),
  }])),
  currentStripeBalance: currentBalance,
})

const availablePln = balance.available.filter((row) => row.currency === 'pln').reduce((sum, row) => sum + row.amount, 0)
const pendingPln = balance.pending.filter((row) => row.currency === 'pln').reduce((sum, row) => sum + row.amount, 0)
const teacherLiabilityGrosze = Number(process.env.RUNBEE_TEACHER_LIABILITY_GROSZE)
const dashboardRunbeeNetGrosze = Number(process.env.RUNBEE_DASHBOARD_NET_GROSZE)
const hasRunbeeComparison = Number.isFinite(teacherLiabilityGrosze) && Number.isFinite(dashboardRunbeeNetGrosze)
const stripeSurplusOverTeacherLiability = hasRunbeeComparison ? availablePln - teacherLiabilityGrosze : null

printTable('Runbee optional focused check', {
  availablePln,
  availablePlnFormatted: money(availablePln),
  pendingPln,
  pendingPlnFormatted: money(pendingPln),
  teacherLiabilityGrosze: hasRunbeeComparison ? teacherLiabilityGrosze : null,
  teacherLiabilityPln: hasRunbeeComparison ? money(teacherLiabilityGrosze) : null,
  stripeSurplusOverTeacherLiability,
  stripeSurplusOverTeacherLiabilityPln: hasRunbeeComparison ? money(stripeSurplusOverTeacherLiability) : null,
  dashboardRunbeeNetGrosze: hasRunbeeComparison ? dashboardRunbeeNetGrosze : null,
  dashboardRunbeeNetPln: hasRunbeeComparison ? money(dashboardRunbeeNetGrosze) : null,
  differenceBetweenDashboardNetAndStripeSurplus: hasRunbeeComparison ? dashboardRunbeeNetGrosze - stripeSurplusOverTeacherLiability : null,
  differenceBetweenDashboardNetAndStripeSurplusPln: hasRunbeeComparison ? money(dashboardRunbeeNetGrosze - stripeSurplusOverTeacherLiability) : null,
  note: 'Set RUNBEE_TEACHER_LIABILITY_GROSZE and RUNBEE_DASHBOARD_NET_GROSZE to include this comparison.',
})
