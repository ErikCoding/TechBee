import { collection, getDocs, writeBatch } from 'firebase/firestore'
import { collections, db, isFirebaseConfigured } from '@/lib/firebase'

// ─────────────────────────────────────────────────────────────
// Admin-only "wipe activity data" button (see components/admin/
// admin-reset-panel.tsx) — clears everything that accumulates from
// people actually using the platform (messages, bookings, wallets,
// notifications, parent-link codes, BeePoints) so the app can be
// reset to a clean slate right before launch, without touching real
// accounts (`users`) or content that isn't per-user activity
// (teacher profiles/applications, the categories/testimonials/FAQ
// catalog).
// ─────────────────────────────────────────────────────────────

export interface ResetResult {
  collection: string
  count: number
}

// Firestore batched writes cap out at 500 ops — comfortably under that.
const BATCH_LIMIT = 450

async function deleteAllDocs(collectionName: string): Promise<number> {
  if (!db) return 0
  const snap = await getDocs(collection(db, collectionName))
  const docs = snap.docs
  for (let i = 0; i < docs.length; i += BATCH_LIMIT) {
    const batch = writeBatch(db)
    for (const d of docs.slice(i, i + BATCH_LIMIT)) batch.delete(d.ref)
    await batch.commit()
  }
  return docs.length
}

/** Conversations' messages live in an `items` subcollection, which Firestore never cascade-deletes on its own — each conversation's messages have to be cleared before (or alongside) the conversation doc itself. */
async function deleteAllConversationsAndMessages(): Promise<number> {
  if (!db) return 0
  const convSnap = await getDocs(collection(db, collections.conversations))
  let total = 0
  for (const convDoc of convSnap.docs) {
    const itemsSnap = await getDocs(collection(db, collections.conversations, convDoc.id, 'items'))
    const itemDocs = itemsSnap.docs
    for (let i = 0; i < itemDocs.length; i += BATCH_LIMIT) {
      const batch = writeBatch(db)
      for (const m of itemDocs.slice(i, i + BATCH_LIMIT)) batch.delete(m.ref)
      await batch.commit()
    }
    total += itemDocs.length
  }
  total += await deleteAllDocs(collections.conversations)
  return total
}

/**
 * Wipes per-user *activity* data: conversations + their messages,
 * lessons/bookings, wallets + wallet transactions, BeePoints balances +
 * events, notifications, and parent-student link codes. Deliberately
 * leaves `users` (accounts), `teachers` (profiles/applications), and
 * the public catalog (`categories`/`testimonials`/`faq`) untouched.
 */
export async function resetActivityData(): Promise<ResetResult[]> {
  if (!isFirebaseConfigured || !db) {
    throw new Error('Firebase nie jest skonfigurowane.')
  }

  const results: ResetResult[] = []

  results.push({ collection: 'Wiadomości i konwersacje', count: await deleteAllConversationsAndMessages() })
  results.push({ collection: 'Lekcje i rezerwacje', count: await deleteAllDocs(collections.lessons) })
  results.push({ collection: 'Portfele', count: await deleteAllDocs(collections.wallets) })
  results.push({ collection: 'Transakcje portfela', count: await deleteAllDocs(collections.walletTransactions) })
  results.push({ collection: 'Salda BeePoints', count: await deleteAllDocs(collections.beepoints) })
  results.push({ collection: 'Zdarzenia BeePoints', count: await deleteAllDocs(collections.beepointsEvents) })
  results.push({ collection: 'Powiadomienia', count: await deleteAllDocs(collections.notifications) })
  results.push({ collection: 'Kody łączące rodzic-uczeń', count: await deleteAllDocs(collections.linkCodes) })

  return results
}
