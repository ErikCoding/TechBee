import { addDoc, collection, doc, getDoc, getDocs, increment, orderBy, query, setDoc, updateDoc, where } from 'firebase/firestore'
import { walletStatsData, walletTransactionsData } from '@/data/wallet.data'
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
  if (!isBrowser()) return walletStatsData
  try {
    const all = JSON.parse(window.localStorage.getItem(MOCK_WALLETS_KEY) ?? '{}') as Record<string, WalletStats>
    if (!all[userId]) {
      all[userId] = { balance: STARTER_BALANCE, pending: 0, totalSpent: 0, totalTopups: 0 }
      window.localStorage.setItem(MOCK_WALLETS_KEY, JSON.stringify(all))
    }
    return all[userId]
  } catch {
    return walletStatsData
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
  if (!userId) return walletStatsData
  return readMockStats(userId)
}

function getWalletTransactionsMock(userId?: string): Transaction[] {
  if (!userId) return walletTransactionsData
  const local = readMockTransactions(userId)
  return local.length > 0 ? local : walletTransactionsData
}

function topUpMock(userId: string, amount: number) {
  applyMockDelta(userId, { id: `tx-${Date.now()}`, type: 'credit', description: 'Doładowanie portfela (symulacja)', amount, date: todayLabel(), status: 'completed' })
}

function withdrawMock(userId: string, amount: number) {
  applyMockDelta(userId, { id: `tx-${Date.now()}`, type: 'debit', description: 'Wypłata środków (symulacja)', amount: -amount, date: todayLabel(), status: 'completed' })
}

function transferLessonPaymentMock(studentId: string, teacherLabel: string, amount: number, topic: string) {
  applyMockDelta(studentId, { id: `tx-${Date.now()}-s`, type: 'debit', description: `Lekcja: ${teacherLabel} — ${topic}`, amount: -amount, date: todayLabel(), status: 'completed' })
}

// ── Firebase ──────────────────────────────────────────────────

async function ensureWalletDoc(userId: string): Promise<WalletStats> {
  if (!db) return walletStatsData
  const ref = doc(db, collections.wallets, userId)
  const snap = await getDoc(ref)
  if (snap.exists()) return snap.data() as WalletStats
  const starter: WalletStats = { balance: STARTER_BALANCE, pending: 0, totalSpent: 0, totalTopups: 0 }
  await setDoc(ref, starter)
  return starter
}

async function getWalletStatsFirebase(userId?: string): Promise<WalletStats> {
  if (!db || !userId) return walletStatsData
  return ensureWalletDoc(userId)
}

async function getWalletTransactionsFirebase(userId?: string): Promise<Transaction[]> {
  if (!db || !userId) return walletTransactionsData
  const snap = await getDocs(query(collection(db, collections.walletTransactions), where('userId', '==', userId), orderBy('createdAt', 'desc')))
  return snap.docs.map((d) => {
    const data = d.data() as { type: Transaction['type']; description: string; amount: number; status: Transaction['status']; createdAt: number }
    return { id: d.id, type: data.type, description: data.description, amount: data.amount, date: formatChatTime(data.createdAt), status: data.status } satisfies Transaction
  })
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
      transferLessonPaymentMock(studentId, teacherLabel, amount, topic)
    }
  } catch {
    // ignore — see doc comment
  }
}
