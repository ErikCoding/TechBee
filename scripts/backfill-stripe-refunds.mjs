#!/usr/bin/env node

import { existsSync } from 'node:fs'
import process, { loadEnvFile } from 'node:process'
import { cert, getApps, initializeApp } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import Stripe from 'stripe'

const envPath = process.env.DOTENV_CONFIG_PATH || '.env.local'
if (existsSync(envPath)) {
  loadEnvFile(envPath)
}

const args = new Set(process.argv.slice(2))
const write = args.has('--write')
const verbose = args.has('--verbose')
const limitArg = process.argv.find((arg) => arg.startsWith('--limit='))
const limit = limitArg ? Number(limitArg.split('=')[1]) : null

function usage() {
  console.log(`
Usage:
  node scripts/backfill-stripe-refunds.mjs [--write] [--limit=N] [--verbose]

Default mode is dry-run: it reads Stripe and Firestore but writes nothing.

Environment:
  FIREBASE_SERVICE_ACCOUNT_KEY  required
  STRIPE_SECRET_KEY             required; must be a live key (sk_live_...)
`)
}

if (args.has('--help')) {
  usage()
  process.exit(0)
}

function parseServiceAccountKey(raw) {
  try {
    return JSON.parse(raw)
  } catch {
    return JSON.parse(Buffer.from(raw, 'base64').toString('utf-8'))
  }
}

function hasNumber(value) {
  return typeof value === 'number' && Number.isFinite(value)
}

function mask(id) {
  return typeof id === 'string' && id.length > 10 ? `${id.slice(0, 5)}...${id.slice(-4)}` : id
}

async function findLessonByPaymentIntent(db, paymentIntentId) {
  if (!paymentIntentId) return null
  const snap = await db.collection('lessons').where('stripePaymentIntentId', '==', paymentIntentId).limit(1).get()
  if (snap.empty) return null
  return { id: snap.docs[0].id, ref: snap.docs[0].ref, data: snap.docs[0].data() }
}

async function readRefundEvent(stripe, db, refundBalanceTransaction) {
  const refundId = typeof refundBalanceTransaction.source === 'string'
    ? refundBalanceTransaction.source
    : refundBalanceTransaction.source?.id
  if (!refundId) return { ok: false, reason: 'missing_refund_source' }

  const refund = await stripe.refunds.retrieve(refundId, {
    expand: ['charge.balance_transaction', 'payment_intent'],
  })
  const charge = refund.charge && typeof refund.charge !== 'string' ? refund.charge : null
  const chargeBalanceTransaction = charge?.balance_transaction && typeof charge.balance_transaction !== 'string'
    ? charge.balance_transaction
    : null
  if (!charge) return { ok: false, reason: 'missing_charge' }
  if (typeof charge.livemode !== 'boolean') return { ok: false, reason: 'missing_charge_livemode' }
  if (!chargeBalanceTransaction || !hasNumber(chargeBalanceTransaction.net)) return { ok: false, reason: 'missing_charge_balance_transaction' }

  const paymentIntentId = typeof refund.payment_intent === 'string'
    ? refund.payment_intent
    : refund.payment_intent?.id
      ?? (typeof charge.payment_intent === 'string' ? charge.payment_intent : charge.payment_intent?.id)
  const lesson = await findLessonByPaymentIntent(db, paymentIntentId)
  const fullRefund = (charge.amount_refunded ?? 0) >= charge.amount

  return {
    ok: true,
    id: refundBalanceTransaction.id,
    event: {
      type: 'refund',
      amountGrosze: refundBalanceTransaction.amount,
      feeGrosze: refundBalanceTransaction.fee,
      netGrosze: refundBalanceTransaction.net,
      currency: refundBalanceTransaction.currency,
      status: refundBalanceTransaction.status,
      availableOn: refundBalanceTransaction.available_on ? refundBalanceTransaction.available_on * 1000 : undefined,
      createdAt: refundBalanceTransaction.created * 1000,
      stripeBalanceTransactionId: refundBalanceTransaction.id,
      stripeRefundId: refund.id,
      stripeChargeId: charge.id,
      ...(paymentIntentId ? { stripePaymentIntentId: paymentIntentId } : {}),
      chargeAmountGrosze: charge.amount,
      chargeFeeGrosze: chargeBalanceTransaction.fee,
      chargeNetGrosze: chargeBalanceTransaction.net,
      refundAmountGrosze: refund.amount,
      fullRefund,
      ...(lesson ? { lessonId: lesson.id } : {}),
      livemode: charge.livemode,
      recordedAt: Date.now(),
    },
    lesson,
    fullRefund,
  }
}

const serviceAccountRaw = process.env.FIREBASE_SERVICE_ACCOUNT_KEY
if (!serviceAccountRaw) {
  console.error('Missing FIREBASE_SERVICE_ACCOUNT_KEY.')
  process.exit(1)
}

const stripeSecretKey = process.env.STRIPE_SECRET_KEY
if (!stripeSecretKey?.startsWith('sk_live_')) {
  console.error('Missing live STRIPE_SECRET_KEY (sk_live_...).')
  process.exit(1)
}

const app = getApps()[0] || initializeApp({ credential: cert(parseServiceAccountKey(serviceAccountRaw)) })
const db = getFirestore(app)
const stripe = new Stripe(stripeSecretKey)

const summary = {
  mode: write ? 'write' : 'dry-run',
  scannedRefundBalanceTransactions: 0,
  backfillable: 0,
  written: 0,
  skippedExisting: 0,
  skipped: 0,
  errors: 0,
}

const refundTransactions = []
await stripe.balanceTransactions
  .list({ limit: 100, type: 'refund', expand: ['data.source'] })
  .autoPagingEach((bt) => {
    if (!limit || refundTransactions.length < limit) refundTransactions.push(bt)
  })

for (const bt of refundTransactions) {
  summary.scannedRefundBalanceTransactions += 1
  const existing = await db.collection('stripeFinancialEvents').doc(bt.id).get()
  if (existing.exists) {
    summary.skippedExisting += 1
    console.log(`skip-existing | bt=${mask(bt.id)}`)
    continue
  }

  try {
    const prepared = await readRefundEvent(stripe, db, bt)
    if (!prepared.ok) {
      summary.skipped += 1
      console.log(`skip | bt=${mask(bt.id)} | ${prepared.reason}`)
      continue
    }
    summary.backfillable += 1
    console.log(`${write ? 'write-ready' : 'dry-run-ready'} | bt=${mask(bt.id)} | refund=${mask(prepared.event.stripeRefundId)} | charge=${mask(prepared.event.stripeChargeId)} | lesson=${prepared.event.lessonId ?? 'none'} | amount=${prepared.event.amountGrosze} | net=${prepared.event.netGrosze} | livemode=${prepared.event.livemode}`)
    if (verbose) console.log(JSON.stringify({ ...prepared.event, stripeRefundId: mask(prepared.event.stripeRefundId), stripeChargeId: mask(prepared.event.stripeChargeId), stripePaymentIntentId: mask(prepared.event.stripePaymentIntentId), stripeBalanceTransactionId: mask(prepared.event.stripeBalanceTransactionId) }, null, 2))

    if (write) {
      await db.collection('stripeFinancialEvents').doc(prepared.id).set(prepared.event, { merge: true })
      if (prepared.lesson && prepared.fullRefund && prepared.lesson.data.paymentStatus !== 'refunded') {
        await prepared.lesson.ref.update({
          stripeRefundId: prepared.event.stripeRefundId,
          paymentStatus: 'refunded',
          status: 'cancelled',
        })
      }
      summary.written += 1
    }
  } catch (err) {
    summary.errors += 1
    console.log(`error | bt=${mask(bt.id)} | ${err instanceof Error ? err.message : String(err)}`)
  }
}

console.log(JSON.stringify(summary, null, 2))
if (!write) console.log('Dry-run only. Re-run with --write to persist refund financial events.')
