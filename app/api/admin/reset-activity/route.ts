import { NextResponse } from 'next/server'
import { adminDb, isAdminConfigured } from '@/lib/firebase-admin'
import { verifyCaller, getVerifiedUserRole } from '@/lib/stripe-server-auth'
import { collections } from '@/lib/firebase'

// ─────────────────────────────────────────────────────────────
// Server-side counterpart to the admin "wipe activity data" button
// (see components/admin/admin-reset-panel.tsx). This used to run
// entirely client-side via the Firestore client SDK, which worked
// fine for the collections firestore.rules lets an admin write to
// directly — but `wallets`/`walletTransactions` (deny-all since the
// student wallet was removed) and `payouts`/`stripeEvents`
// (deny-all, real Stripe financial history — see firestore.rules)
// are intentionally NOT client-writable by anyone, including an
// admin's own browser, so those deletions would silently fail with
// permission-denied. Routing the whole reset through the trusted
// admin SDK (same posture as every app/api/stripe/* route) fixes
// that without loosening those collections' rules.
// ─────────────────────────────────────────────────────────────

export const runtime = 'nodejs'

interface ResetResult {
  collection: string
  count: number
}

// Firestore batched writes cap out at 500 ops — comfortably under that.
const BATCH_LIMIT = 450

async function deleteAllDocs(collectionName: string): Promise<number> {
  const snap = await adminDb!.collection(collectionName).get()
  const docs = snap.docs
  for (let i = 0; i < docs.length; i += BATCH_LIMIT) {
    const batch = adminDb!.batch()
    for (const d of docs.slice(i, i + BATCH_LIMIT)) batch.delete(d.ref)
    await batch.commit()
  }
  return docs.length
}

/** Conversations' messages live in an `items` subcollection, which Firestore never cascade-deletes on its own — each conversation's messages have to be cleared before (or alongside) the conversation doc itself. */
async function deleteAllConversationsAndMessages(): Promise<number> {
  const convSnap = await adminDb!.collection(collections.conversations).get()
  let total = 0
  for (const convDoc of convSnap.docs) {
    const itemsSnap = await adminDb!.collection(collections.conversations).doc(convDoc.id).collection('items').get()
    const itemDocs = itemsSnap.docs
    for (let i = 0; i < itemDocs.length; i += BATCH_LIMIT) {
      const batch = adminDb!.batch()
      for (const m of itemDocs.slice(i, i + BATCH_LIMIT)) batch.delete(m.ref)
      await batch.commit()
    }
    total += itemDocs.length
  }
  total += await deleteAllDocs(collections.conversations)
  return total
}

export async function POST(request: Request) {
  if (!isAdminConfigured) {
    return NextResponse.json({ error: 'Zaufane zapisy Firestore nie są skonfigurowane (brak FIREBASE_SERVICE_ACCOUNT_KEY).' }, { status: 503 })
  }

  let body: { idToken?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Nieprawidłowe żądanie.' }, { status: 400 })
  }

  const uid = await verifyCaller(body.idToken)
  if (!uid) return NextResponse.json({ error: 'Musisz być zalogowany.' }, { status: 401 })

  const role = await getVerifiedUserRole(uid)
  if (role !== 'admin') return NextResponse.json({ error: 'Tylko administrator może zresetować dane.' }, { status: 403 })

  try {
    const results: ResetResult[] = []
    results.push({ collection: 'Wiadomości i konwersacje', count: await deleteAllConversationsAndMessages() })
    results.push({ collection: 'Lekcje i rezerwacje', count: await deleteAllDocs(collections.lessons) })
    results.push({ collection: 'Portfele', count: await deleteAllDocs(collections.wallets) })
    results.push({ collection: 'Transakcje portfela', count: await deleteAllDocs(collections.walletTransactions) })
    results.push({ collection: 'Salda BeePoints', count: await deleteAllDocs(collections.beepoints) })
    results.push({ collection: 'Zdarzenia BeePoints', count: await deleteAllDocs(collections.beepointsEvents) })
    results.push({ collection: 'Powiadomienia', count: await deleteAllDocs(collections.notifications) })
    results.push({ collection: 'Kody łączące rodzic-uczeń', count: await deleteAllDocs(collections.linkCodes) })
    results.push({ collection: 'Historia wypłat Stripe', count: await deleteAllDocs(collections.payouts) })
    results.push({ collection: 'Log zdarzeń webhooka Stripe', count: await deleteAllDocs(collections.stripeEvents) })
    return NextResponse.json({ results })
  } catch (err) {
    console.error('[admin/reset-activity] Failed:', err)
    return NextResponse.json({ error: 'Nie udało się zresetować danych.' }, { status: 500 })
  }
}
