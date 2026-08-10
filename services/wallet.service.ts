import { addDoc, collection, doc, getDoc, getDocs, increment, query, setDoc, updateDoc, where } from 'firebase/firestore'
import { collections, db, isFirebaseConfigured } from '@/lib/firebase'
import { formatChatTime } from '@/lib/utils'
import type { Transaction, WalletStats } from '@/lib/types'

// ─────────────────────────────────────────────────────────────
// Data-access layer for the BeeCoins wallet.
//
// This is the one part of the platform that's explicitly allowed to
// stay a simulation (no real payment processor) — but it's a *real*,
// working simulation: balances and transactions are genuinely
// persisted (Firestore `wallets/{uid}` + `walletTransactions`) and
// change when you top up, withdraw, or book a lesson (which moves
// the price from the student's balance to the teacher's). Nothing
// here is static/decorative data anymore.
//
// New wallets start with a demo starter balance so booking flows are
// actually testable without a manual top-up first.
// ─────────────────────────────────────────────────────────────

const STARTER_BALANCE = 1000
const ZERO_STATS: WalletStats = { balance: 0, pending: 0, totalSpent: 0, totalTopups: 0 }
const MOCK_WALLETS_KEY = 'techbee.wallet.stats'
const MOCK_TX_KEY = 'techbee.wallet.transactions'

function isBrowser() {
  return typeof window !== 'undefined'
}

function todayLabel() {
  return new Date().toLocaleDateString('pl-PL', { day: 'numeric', month: 'short', year: 'numeric' })
}

// ── Mock (localStorage) ──────────────────────────────────────

function readMockStats(userId: string): WalletStats {
  if (!isBrowser()) return ZERO_STATS
  try {
    const all = JSON.parse(window.localStorage.getItem(MOCK_WALLETS_KEY) ?? '{}') as Record<string, WalletStats>
    if (!all[userId]) {
      all[userId] = { balance: STARTER_BALANCE, pending: 0, totalSpent: 0, totalTopups: 0 }
      window.localStorage.setItem(MOCK_WALLETS_KEY, JSON.stringify(all))
    }
    return all[userId]
  } catch {
    return ZERO_STATS
  }
}

function writeMockStats(userId: string, stats: WalletStats) {
  if (!isBrowser()) return
  try {
    const all = JSON.parse(window.localStorage.getItem(MOCK_WALLETS_KEY) ?? '{}') as Record<string, WalletStats>
    all[userId] = stats
    window.localStorage.setItem(MOCK_WALLETS_KEY, JSON.stringify(all))
  } catch {
    // ignore
  }
}

function readMockTransactions(userId: string): Transaction[] {
  if (!isBrowser()) return []
  try {
    const all = JSON.parse(window.localStorage.getItem(MOCK_TX_KEY) ?? '{}') as Record<string, Transaction[]>
    return all[userId] ?? []
  } catch {
    return []
  }
}

function pushMockTransaction(userId: string, tx: Transaction) {
  if (!isBrowser()) return
  try {
    const all = JSON.parse(window.localStorage.getItem(MOCK_TX_KEY) ?? '{}') as Record<string, Transaction[]>
    all[userId] = [tx, ...(all[userId] ?? [])]
    window.localStorage.setItem(MOCK_TX_KEY, JSON.stringify(all))
  } catch {
    // ignore
  }
}

function applyMockDelta(userId: string, tx: Transaction) {
  const stats = readMockStats(userId)
  const next: WalletStats = {
    balance: stats.balance + tx.amount,
    pending: stats.pending,
    totalSpent: stats.totalSpent + (tx.amount < 0 ? Math.abs(tx.amount) : 0),
    totalTopups: stats.totalTopups + (tx.type === 'credit' && tx.amount > 0 ? tx.amount : 0),
  }
  writeMockStats(userId, next)
  pushMockTransaction(userId, tx)
}

function getWalletStatsMock(userId?: string): WalletStats {
  if (!userId) return ZERO_STATS
  return readMockStats(userId)
}

function getWalletTransactionsMock(userId?: string): Transaction[] {
  if (!userId) return []
  return readMockTransactions(userId)
}

function topUpMock(userId: string, amount: number) {
  applyMockDelta(userId, { id: `tx-${Date.now()}`, type: 'credit', description: 'Doładowanie portfela (symulacja)', amount, date: todayLabel(), status: 'completed' })
}

function withdrawMock(userId: string, amount: number) {
  applyMockDelta(userId, { id: `tx-${Date.now()}`, type: 'debit', description: 'Wypłata środków (symulacja)', amount: -amount, date: todayLabel(), status: 'completed' })
}

function transferLessonPaymentMock(studentId: string, teacherId: string, teacherLabel: string, amount: number, topic: string) {
  applyMockDelta(studentId, { id: `tx-${Date.now()}-s`, type: 'debit', description: `Lekcja: ${teacherLabel} — ${topic}`, amount: -amount, date: todayLabel(), status: 'completed' })
  applyMockDelta(teacherId, { id: `tx-${Date.now()}-t`, type: 'credit', description: `Zapłata za lekcję — ${topic}`, amount, date: todayLabel(), status: 'completed' })
}

function updateMockTransactionStatus(userId: string, txId: string, status: Transaction['status']) {
  if (!isBrowser()) return
  try {
    const all = JSON.parse(window.localStorage.getItem(MOCK_TX_KEY) ?? '{}') as Record<string, Transaction[]>
    const list = all[userId] ?? []
    const idx = list.findIndex((t) => t.id === txId)
    if (idx === -1) return
    list[idx] = { ...list[idx], status }
    all[userId] = list
    window.localStorage.setItem(MOCK_TX_KEY, JSON.stringify(all))
  } catch {
    // ignore
  }
}

/** Places an escrow hold: debits the payer's spendable balance right away and parks the amount in `pending`. Returns the hold's transaction id. */
function holdLessonPaymentMock(payerId: string, amount: number, topic: string): string {
  const txId = `tx-${Date.now()}-hold`
  const stats = readMockStats(payerId)
  writeMockStats(payerId, { ...stats, balance: stats.balance - amount, pending: stats.pending + amount })
  pushMockTransaction(payerId, { id: txId, type: 'debit', description: `Środki zablokowane — ${topic}`, amount: -amount, date: todayLabel(), status: 'pending' })
  return txId
}

/** Finalizes a hold: moves it out of the payer's `pending` into real spend, and credits the teacher. */
function releaseLessonPaymentMock(payerId: string, teacherId: string, teacherLabel: string, amount: number, topic: string, holdTransactionId?: string) {
  const stats = readMockStats(payerId)
  writeMockStats(payerId, { ...stats, pending: Math.max(0, stats.pending - amount), totalSpent: stats.totalSpent + amount })
  if (holdTransactionId) updateMockTransactionStatus(payerId, holdTransactionId, 'completed')
  applyMockDelta(teacherId, { id: `tx-${Date.now()}-t`, type: 'credit', description: `Zapłata za lekcję: ${teacherLabel} — ${topic}`, amount, date: todayLabel(), status: 'completed' })
}

/** Reverses a hold: gives the payer their money back. */
function refundLessonPaymentMock(payerId: string, amount: number, topic: string, holdTransactionId?: string) {
  const stats = readMockStats(payerId)
  writeMockStats(payerId, { ...stats, balance: stats.balance + amount, pending: Math.max(0, stats.pending - amount) })
  if (holdTransactionId) updateMockTransactionStatus(payerId, holdTransactionId, 'failed')
  pushMockTransaction(payerId, { id: `tx-${Date.now()}-refund`, type: 'refund', description: `Zwrot — ${topic}`, amount, date: todayLabel(), status: 'completed' })
}

// ── Firebase ──────────────────────────────────────────────────

async function ensureWalletDoc(userId: string): Promise<WalletStats> {
  if (!db) return ZERO_STATS
  const ref = doc(db, collections.wallets, userId)
  const snap = await getDoc(ref)
  if (snap.exists()) return snap.data() as WalletStats
  const starter: WalletStats = { balance: STARTER_BALANCE, pending: 0, totalSpent: 0, totalTopups: 0 }
  await setDoc(ref, starter)
  return starter
}

async function getWalletStatsFirebase(userId?: string): Promise<WalletStats> {
  // No userId (SSR baseline) → zeros, not a fake demo balance — the real
  // number loads client-side once the signed-in user is known.
  if (!db || !userId) return ZERO_STATS
  return ensureWalletDoc(userId)
}

async function getWalletTransactionsFirebase(userId?: string): Promise<Transaction[]> {
  if (!db || !userId) return []
  // No `orderBy` here on purpose — `where(userId) + orderBy(createdAt)`
  // needs a composite index Firestore won't create automatically (it just
  // throws "query requires an index" until someone manually creates one in
  // the console). Sorting the small per-user result set in JS avoids that
  // entirely.
  const snap = await getDocs(query(collection(db, collections.walletTransactions), where('userId', '==', userId)))
  return snap.docs
    .map((d) => {
      const data = d.data() as { type: Transaction['type']; description: string; amount: number; status: Transaction['status']; createdAt: number }
      return { id: d.id, type: data.type, description: data.description, amount: data.amount, date: formatChatTime(data.createdAt), status: data.status, _createdAt: data.createdAt }
    })
    .sort((a, b) => b._createdAt - a._createdAt)
    .map(({ _createdAt, ...tx }) => tx)
}

async function recordTransactionFirebase(userId: string, tx: { type: Transaction['type']; description: string; amount: number }) {
  if (!db) return
  await ensureWalletDoc(userId)
  await Promise.all([
    addDoc(collection(db, collections.walletTransactions), {
      userId,
      type: tx.type,
      description: tx.description,
      amount: tx.amount,
      status: 'completed' as const,
      createdAt: Date.now(),
    }),
    updateDoc(doc(db, collections.wallets, userId), {
      balance: increment(tx.amount),
      ...(tx.amount < 0 ? { totalSpent: increment(Math.abs(tx.amount)) } : {}),
      ...(tx.type === 'credit' && tx.amount > 0 ? { totalTopups: increment(tx.amount) } : {}),
    }),
  ])
}

async function topUpFirebase(userId: string, amount: number) {
  await recordTransactionFirebase(userId, { type: 'credit', description: 'Doładowanie portfela (symulacja)', amount })
}

async function withdrawFirebase(userId: string, amount: number) {
  await recordTransactionFirebase(userId, { type: 'debit', description: 'Wypłata środków (symulacja)', amount: -amount })
}

/** Moves a lesson's price from the student's wallet to the teacher's — the one real money-movement path in the app, still simulated (no payment processor), but genuinely updates both balances. */
async function transferLessonPaymentFirebase(studentId: string, teacherId: string, amount: number, teacherLabel: string, topic: string) {
  await recordTransactionFirebase(studentId, { type: 'debit', description: `Lekcja: ${teacherLabel} — ${topic}`, amount: -amount })
  await recordTransactionFirebase(teacherId, { type: 'credit', description: `Zapłata za lekcję — ${topic}`, amount })
}

/** Places an escrow hold: debits the payer's spendable balance right away and parks the amount in `pending`. Returns the hold's transaction id. */
async function holdLessonPaymentFirebase(payerId: string, amount: number, topic: string): Promise<string> {
  if (!db) return ''
  await ensureWalletDoc(payerId)
  const txRef = await addDoc(collection(db, collections.walletTransactions), {
    userId: payerId,
    type: 'debit' as const,
    description: `Środki zablokowane — ${topic}`,
    amount: -amount,
    status: 'pending' as const,
    createdAt: Date.now(),
  })
  await updateDoc(doc(db, collections.wallets, payerId), { balance: increment(-amount), pending: increment(amount) })
  return txRef.id
}

/** Finalizes a hold: moves it out of the payer's `pending` into real spend, and credits the teacher. */
async function releaseLessonPaymentFirebase(payerId: string, teacherId: string, teacherLabel: string, amount: number, topic: string, holdTransactionId?: string) {
  if (!db) return
  await ensureWalletDoc(payerId)
  await updateDoc(doc(db, collections.wallets, payerId), { pending: increment(-amount), totalSpent: increment(amount) })
  if (holdTransactionId) {
    await updateDoc(doc(db, collections.walletTransactions, holdTransactionId), { status: 'completed' })
  }
  await recordTransactionFirebase(teacherId, { type: 'credit', description: `Zapłata za lekcję: ${teacherLabel} — ${topic}`, amount })
}

/** Reverses a hold: gives the payer their money back. */
async function refundLessonPaymentFirebase(payerId: string, amount: number, topic: string, holdTransactionId?: string) {
  if (!db) return
  await ensureWalletDoc(payerId)
  await updateDoc(doc(db, collections.wallets, payerId), { balance: increment(amount), pending: increment(-amount) })
  if (holdTransactionId) {
    await updateDoc(doc(db, collections.walletTransactions, holdTransactionId), { status: 'failed' })
  }
  await addDoc(collection(db, collections.walletTransactions), {
    userId: payerId,
    type: 'refund' as const,
    description: `Zwrot — ${topic}`,
    amount,
    status: 'completed' as const,
    createdAt: Date.now(),
  })
}

// ── Public API ────────────────────────────────────────────────

export async function getWalletStats(userId?: string): Promise<WalletStats> {
  return isFirebaseConfigured ? getWalletStatsFirebase(userId) : getWalletStatsMock(userId)
}

export async function getWalletTransactions(userId?: string): Promise<Transaction[]> {
  return isFirebaseConfigured ? getWalletTransactionsFirebase(userId) : getWalletTransactionsMock(userId)
}

export async function topUpWallet(userId: string, amount: number): Promise<void> {
  if (amount <= 0) return
  return isFirebaseConfigured ? topUpFirebase(userId, amount) : topUpMock(userId, amount)
}

/** Returns false (without changing anything) if the balance can't cover the withdrawal. */
export async function withdrawFromWallet(userId: string, amount: number): Promise<boolean> {
  if (amount <= 0) return false
  const stats = await getWalletStats(userId)
  if (stats.balance < amount) return false
  await (isFirebaseConfigured ? withdrawFirebase(userId, amount) : withdrawMock(userId, amount))
  return true
}

/** Best-effort — a failed wallet transfer should never block a booking from being created. */
export async function transferLessonPayment(studentId: string, teacherId: string, amount: number, teacherLabel: string, topic: string): Promise<void> {
  try {
    if (isFirebaseConfigured) {
      await transferLessonPaymentFirebase(studentId, teacherId, amount, teacherLabel, topic)
    } else {
      transferLessonPaymentMock(studentId, teacherId, teacherLabel, amount, topic)
    }
  } catch {
    // ignore — see doc comment
  }
}

// ── Escrow (parent-account model) ────────────────────────────
//
// A lesson booking's price is held from the payer (student or their
// linked parent) the moment it's booked, then only actually moves to
// the teacher once the post-lesson report is confirmed — see
// services/lessons.service.ts for the booking/report/confirm flow
// that calls these three functions.

/**
 * Attempts to place an escrow hold for a lesson booking — debits the
 * payer's spendable `balance` immediately and moves it into `pending`.
 * Returns the hold's transaction id on success, or `null` if the payer
 * doesn't have enough balance to cover it (the caller should refuse
 * the booking in that case, not create a lesson with no funds behind it).
 */
export async function holdLessonPayment(payerId: string, amount: number, topic: string): Promise<string | null> {
  if (amount <= 0) return null
  const stats = await getWalletStats(payerId)
  if (stats.balance < amount) return null
  return isFirebaseConfigured ? holdLessonPaymentFirebase(payerId, amount, topic) : holdLessonPaymentMock(payerId, amount, topic)
}

/**
 * Finalizes a held payment — called once a lesson's report is confirmed
 * (by the payer or via 24h auto-confirmation), or a dispute resolves in
 * the teacher's favor. Moves the held amount from the payer's `pending`
 * into the teacher's spendable balance. Best-effort: a failed release
 * shouldn't crash the confirm flow (mirrors transferLessonPayment above).
 */
export async function releaseLessonPayment(payerId: string, teacherId: string, teacherLabel: string, amount: number, topic: string, holdTransactionId?: string): Promise<void> {
  try {
    if (isFirebaseConfigured) {
      await releaseLessonPaymentFirebase(payerId, teacherId, teacherLabel, amount, topic, holdTransactionId)
    } else {
      releaseLessonPaymentMock(payerId, teacherId, teacherLabel, amount, topic, holdTransactionId)
    }
  } catch {
    // ignore
  }
}

/**
 * Reverses a held payment — used when a booking is rejected/cancelled
 * before completion, or a dispute resolves in the payer's favor. Moves
 * the held amount back to the payer's spendable balance.
 */
export async function refundLessonPayment(payerId: string, amount: number, topic: string, holdTransactionId?: string): Promise<void> {
  try {
    if (isFirebaseConfigured) {
      await refundLessonPaymentFirebase(payerId, amount, topic, holdTransactionId)
    } else {
      refundLessonPaymentMock(payerId, amount, topic, holdTransactionId)
    }
  } catch {
    // ignore
  }
}
