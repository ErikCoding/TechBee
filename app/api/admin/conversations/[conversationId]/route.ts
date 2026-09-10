import { NextResponse } from 'next/server'
import { adminDb, isAdminConfigured } from '@/lib/firebase-admin'
import { collections } from '@/lib/firebase'
import { verifyCaller, getVerifiedUserRole } from '@/lib/stripe-server-auth'

// ─────────────────────────────────────────────────────────────
// Deletes one specific conversation and its `items` (messages)
// subcollection — the "clear this chat" action in
// components/admin/admin-chat-cleanup-panel.tsx. Firestore never
// cascade-deletes a subcollection when its parent doc is deleted, so
// the messages have to be cleared explicitly first (same pattern as
// the bulk version in app/api/admin/reset-activity/route.ts, just
// scoped to a single conversation instead of all of them).
// ─────────────────────────────────────────────────────────────

export const runtime = 'nodejs'

const BATCH_LIMIT = 450

export async function DELETE(request: Request, { params }: { params: Promise<{ conversationId: string }> }) {
  if (!isAdminConfigured) {
    return NextResponse.json({ error: 'Zaufane zapisy Firestore nie są skonfigurowane.' }, { status: 503 })
  }

  const { conversationId } = await params
  let body: { idToken?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Nieprawidłowe żądanie.' }, { status: 400 })
  }

  const uid = await verifyCaller(body.idToken)
  if (!uid) return NextResponse.json({ error: 'Musisz być zalogowany.' }, { status: 401 })
  const role = await getVerifiedUserRole(uid)
  if (role !== 'admin') return NextResponse.json({ error: 'Tylko administrator może usunąć konwersację.' }, { status: 403 })

  try {
    const convRef = adminDb!.collection(collections.conversations).doc(conversationId)
    const convSnap = await convRef.get()
    if (!convSnap.exists) {
      return NextResponse.json({ error: 'Nie znaleziono tej konwersacji.' }, { status: 404 })
    }

    const itemsSnap = await convRef.collection('items').get()
    const itemDocs = itemsSnap.docs
    for (let i = 0; i < itemDocs.length; i += BATCH_LIMIT) {
      const batch = adminDb!.batch()
      for (const m of itemDocs.slice(i, i + BATCH_LIMIT)) batch.delete(m.ref)
      await batch.commit()
    }
    await convRef.delete()

    return NextResponse.json({ deletedMessages: itemDocs.length })
  } catch (err) {
    console.error('[admin/conversations/[id]] Failed to delete:', err)
    return NextResponse.json({ error: 'Nie udało się usunąć konwersacji.' }, { status: 500 })
  }
}
