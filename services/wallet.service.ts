import { walletStatsData, walletTransactionsData } from '@/data/wallet.data'
import type { Transaction, WalletStats } from '@/lib/types'

// ─────────────────────────────────────────────────────────────
// Data-access layer for the BeeCoins wallet. Firebase version will
// read `wallets/{uid}` for stats and `wallets/{uid}/transactions`
// for history, likely paginated with `startAfter`.
// ─────────────────────────────────────────────────────────────

export async function getWalletStats(_userId?: string): Promise<WalletStats> {
  // TODO(firebase): const snap = await getDoc(doc(db, 'wallets', userId))
  return walletStatsData
}

export async function getWalletTransactions(_userId?: string): Promise<Transaction[]> {
  // TODO(firebase): const snap = await getDocs(collection(db, 'wallets', userId, 'transactions'))
  return walletTransactionsData
}
