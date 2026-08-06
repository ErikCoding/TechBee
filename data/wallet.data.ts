import type { Transaction, WalletStats } from '@/lib/types'

// Mock data — will be swapped for Firestore `wallets/{uid}/transactions`.
export const walletTransactionsData: Transaction[] = [
  { id: 'tx1', type: 'debit', description: 'Lekcja: Marek Kowalski — programowanie PLC', amount: -180, date: '25 lip 2026', status: 'completed' },
  { id: 'tx2', type: 'credit', description: 'Doładowanie portfela przez BLIK', amount: 500, date: '24 lip 2026', status: 'completed' },
  { id: 'tx3', type: 'debit', description: 'Lekcja: Krzysztof Zieliński — projektowanie CAD', amount: -150, date: '22 lip 2026', status: 'completed' },
  { id: 'tx4', type: 'debit', description: 'Lekcja: Julia Kamińska — robotyka przemysłowa', amount: -300, date: '18 lip 2026', status: 'completed' },
  { id: 'tx5', type: 'credit', description: 'Nagroda BeePoints — wymieniono 500 pkt', amount: 50, date: '15 lip 2026', status: 'completed' },
  { id: 'tx6', type: 'credit', description: 'Doładowanie portfela kartą płatniczą', amount: 1000, date: '10 lip 2026', status: 'completed' },
  { id: 'tx7', type: 'refund', description: 'Zwrot: anulowana lekcja — Anna Wiśniewska', amount: 160, date: '10 lip 2026', status: 'completed' },
  { id: 'tx8', type: 'debit', description: 'Lekcja: Anna Wiśniewska — obróbka CNC', amount: -160, date: '5 lip 2026', status: 'failed' },
]

export const walletStatsData: WalletStats = {
  balance: 1200,
  pending: 0,
  totalSpent: 3840,
  totalTopups: 5000,
}
