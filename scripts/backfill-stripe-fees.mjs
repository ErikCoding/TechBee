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
const writeEffectiveCommission = args.has('--write-effective-commission')
const verbose = args.has('--verbose')
const limitArg = process.argv.find((arg) => arg.startsWith('--limit='))
const lessonArg = process.argv.find((arg) => arg.startsWith('--lesson='))
const limit = limitArg ? Number(limitArg.split('=')[1]) : null
const lessonId = lessonArg?.split('=')[1]

function usage() {
  console.log(`
Usage:
  node scripts/backfill-stripe-fees.mjs [--write] [--limit=N] [--lesson=LESSON_ID] [--write-effective-commission] [--verbose]

Default mode is dry-run: it reads Firestore and Stripe but writes nothing.

Environment:
  FIREBASE_SERVICE_ACCOUNT_KEY  required
  STRIPE_SECRET_KEY             required; must match each lesson's livemode

Examples:
  node scripts/backfill-stripe-fees.mjs
  node scripts/backfill-stripe-fees.mjs --write --limit=20
  node scripts/backfill-stripe-fees.mjs --lesson=abc123 --write --verbose
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

function stripeKeyLivemode(key) {
  if (key.startsWith('sk_live_')) return true
  if (key.startsWith('sk_test_')) return false
  return null
}

function hasNumber(value) {
  return typeof value === 'number' && Number.isFinite(value)
}

function idSuffix(id) {
  return typeof id === 'string' && id.length > 8 ? `...${id.slice(-6)}` : id
}

async function readFeeSnapshot(stripe, paymentIntentId) {
  const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId, {
    expand: ['latest_charge.balance_transaction'],
  })
  const charge = paymentIntent.latest_charge && typeof paymentIntent.latest_charge !== 'string'
    ? paymentIntent.latest_charge
    : null
  if (!charge) return { ok: false, reason: 'missing_latest_charge' }

  const balanceTransaction = charge.balance_transaction && typeof charge.balance_transaction !== 'string'
    ? charge.balance_transaction
    : null
  if (!balanceTransaction) return { ok: false, reason: 'missing_balance_transaction' }
  if (!hasNumber(balanceTransaction.fee)) return { ok: false, reason: 'missing_balance_transaction_fee' }

  return {
    ok: true,
    stripeFeeGrosze: balanceTransaction.fee,
    stripeChargeId: charge.id,
    stripeBalanceTransactionId: balanceTransaction.id,
  }
}

function makeLogger() {
  const rows = []
  return {
    push(row) {
      rows.push(row)
      const fields = [
        row.action,
        row.lessonId,
        row.reason,
        row.livemode === undefined ? null : `livemode=${row.livemode}`,
        row.paymentIntentId ? `pi=${idSuffix(row.paymentIntentId)}` : null,
      ].filter(Boolean)
      console.log(fields.join(' | '))
    },
    rows,
  }
}

const serviceAccountRaw = process.env.FIREBASE_SERVICE_ACCOUNT_KEY
if (!serviceAccountRaw) {
  console.error('Missing FIREBASE_SERVICE_ACCOUNT_KEY.')
  process.exit(1)
}

const stripeSecretKey = process.env.STRIPE_SECRET_KEY
if (!stripeSecretKey) {
  console.error('Missing STRIPE_SECRET_KEY.')
  process.exit(1)
}

const configuredLivemode = stripeKeyLivemode(stripeSecretKey)
if (configuredLivemode === null) {
  console.error('STRIPE_SECRET_KEY must start with sk_live_ or sk_test_.')
  process.exit(1)
}

const serviceAccount = parseServiceAccountKey(serviceAccountRaw)
const app = getApps()[0] || initializeApp({ credential: cert(serviceAccount) })
const db = getFirestore(app)
const stripe = new Stripe(stripeSecretKey)
const logger = makeLogger()

let snap
if (lessonId) {
  const doc = await db.collection('lessons').doc(lessonId).get()
  snap = { docs: doc.exists ? [doc] : [] }
} else {
  let query = db.collection('lessons').where('paymentStatus', '==', 'paid')
  if (limit && Number.isFinite(limit) && limit > 0) query = query.limit(limit)
  snap = await query.get()
}

const summary = {
  mode: write ? 'write' : 'dry-run',
  configuredLivemode,
  paidLessonsScanned: snap.docs.length,
  stripeFeeMissing: 0,
  stripeFeeBackfillable: 0,
  stripeFeeWritten: 0,
  effectiveCommissionMissing: 0,
  effectiveCommissionBackfillable: 0,
  effectiveCommissionWritten: 0,
  skipped: 0,
  errors: 0,
}

for (const doc of snap.docs) {
  const lesson = doc.data()
  const needsStripeFee = !hasNumber(lesson.stripeFeeGrosze)
  const needsEffectiveCommission = !hasNumber(lesson.effectiveCommissionPercent) && hasNumber(lesson.commissionPercent)

  if (!needsStripeFee && !needsEffectiveCommission) continue
  if (needsStripeFee) summary.stripeFeeMissing += 1
  if (needsEffectiveCommission) summary.effectiveCommissionMissing += 1

  const lessonUpdates = {}
  let paymentSnapshot = null
  if (needsEffectiveCommission) {
    summary.effectiveCommissionBackfillable += 1
    if (writeEffectiveCommission) {
      lessonUpdates.effectiveCommissionPercent = lesson.commissionPercent
    }
  }

  if (needsStripeFee) {
    const lessonLivemode = Boolean(lesson.livemode)
    if (lessonLivemode !== configuredLivemode) {
      summary.skipped += 1
      logger.push({
        action: 'skip',
        lessonId: doc.id,
        reason: configuredLivemode ? 'requires_test_key_for_testmode_lesson' : 'requires_live_key_for_livemode_lesson',
        livemode: lessonLivemode,
      })
    } else if (typeof lesson.stripePaymentIntentId !== 'string' || !lesson.stripePaymentIntentId) {
      summary.skipped += 1
      logger.push({ action: 'skip', lessonId: doc.id, reason: 'missing_stripe_payment_intent_id', livemode: lessonLivemode })
    } else {
      try {
        const fee = await readFeeSnapshot(stripe, lesson.stripePaymentIntentId)
        if (!fee.ok) {
          summary.skipped += 1
          logger.push({
            action: 'skip',
            lessonId: doc.id,
            reason: fee.reason,
            livemode: lessonLivemode,
            ...(verbose ? { paymentIntentId: lesson.stripePaymentIntentId } : {}),
          })
        } else {
          summary.stripeFeeBackfillable += 1
          lessonUpdates.stripeFeeGrosze = fee.stripeFeeGrosze
          paymentSnapshot = {
            lessonId: doc.id,
            stripePaymentIntentId: lesson.stripePaymentIntentId,
            stripeFeeGrosze: fee.stripeFeeGrosze,
            stripeChargeId: fee.stripeChargeId,
            stripeBalanceTransactionId: fee.stripeBalanceTransactionId,
            livemode: lessonLivemode,
            updatedAt: Date.now(),
          }
          logger.push({
            action: write ? 'write-ready' : 'dry-run-ready',
            lessonId: doc.id,
            reason: `fee=${fee.stripeFeeGrosze}`,
            livemode: lessonLivemode,
            ...(verbose ? { paymentIntentId: lesson.stripePaymentIntentId } : {}),
          })
        }
      } catch (err) {
        summary.errors += 1
        logger.push({
          action: 'error',
          lessonId: doc.id,
          reason: err instanceof Error ? err.message : String(err),
          livemode: lessonLivemode,
          ...(verbose ? { paymentIntentId: lesson.stripePaymentIntentId } : {}),
        })
      }
    }
  }

  if (write && (Object.keys(lessonUpdates).length > 0 || paymentSnapshot)) {
    if (Object.keys(lessonUpdates).length > 0) {
      await doc.ref.update(lessonUpdates)
    }
    if (paymentSnapshot) {
      await db.collection('lessonPaymentSnapshots').doc(doc.id).set(paymentSnapshot, { merge: true })
    }
    if (hasNumber(lessonUpdates.stripeFeeGrosze)) summary.stripeFeeWritten += 1
    if (hasNumber(lessonUpdates.effectiveCommissionPercent)) summary.effectiveCommissionWritten += 1
  }
}

console.log(JSON.stringify(summary, null, 2))
if (!write) {
  console.log('Dry-run only. Re-run with --write to persist Stripe fee snapshots.')
}
if (summary.effectiveCommissionBackfillable > 0 && !writeEffectiveCommission) {
  console.log('Missing effectiveCommissionPercent can be copied from historical commissionPercent with --write-effective-commission; commissionSource is never inferred by this script.')
}
