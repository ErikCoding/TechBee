import { NextResponse } from 'next/server'
import { adminDb, isAdminConfigured } from '@/lib/firebase-admin'
import { collections } from '@/lib/firebase'
import { verifyCaller } from '@/lib/stripe-server-auth'
import { canEditChatMessage, sanitizeEditedChatText } from '@/lib/chat-message-edit-core'

type Body = {
  idToken?: unknown
  conversationId?: unknown
  messageId?: unknown
  text?: unknown
}

// Edits the text of one of the caller's own chat messages, within the
// edit window. Server-side on purpose: Firestore rules keep clients from
// writing message documents, and the 5-minute window must be judged on
// the server's clock, not the browser's.
export async function POST(request: Request) {
  if (!isAdminConfigured || !adminDb) {
    return NextResponse.json({ error: 'Czat nie jest skonfigurowany po stronie serwera.' }, { status: 503 })
  }

  const body = await request.json().catch(() => null) as Body | null
  const uid = await verifyCaller(typeof body?.idToken === 'string' ? body.idToken : undefined)
  if (!uid) return NextResponse.json({ error: 'Musisz być zalogowany.' }, { status: 401 })

  const conversationId = typeof body?.conversationId === 'string' ? body.conversationId.trim() : ''
  const messageId = typeof body?.messageId === 'string' ? body.messageId.trim() : ''
  if (!conversationId || conversationId.length > 260 || !messageId || messageId.length > 260) {
    return NextResponse.json({ error: 'Nieprawidłowe żądanie.' }, { status: 400 })
  }
  const text = sanitizeEditedChatText(body?.text)
  if (!text) return NextResponse.json({ error: 'Wiadomość nie może być pusta.' }, { status: 400 })

  const conversationRef = adminDb.collection(collections.conversations).doc(conversationId)
  const messageRef = conversationRef.collection('items').doc(messageId)

  const outcome = await adminDb.runTransaction(async (transaction) => {
    const [conversationSnap, messageSnap] = await Promise.all([transaction.get(conversationRef), transaction.get(messageRef)])
    if (!conversationSnap.exists || !messageSnap.exists) return 'not_found' as const

    const conversation = conversationSnap.data() ?? {}
    const participantIds = Array.isArray(conversation.participantIds) ? conversation.participantIds.filter((id) => typeof id === 'string') as string[] : []
    if (!participantIds.includes(uid)) return 'forbidden' as const

    const message = messageSnap.data() ?? {}
    if (message.senderId !== uid) return 'forbidden' as const
    if (!canEditChatMessage(message, uid)) return 'not_editable' as const

    const now = Date.now()
    transaction.update(messageRef, { text, editedAt: now })
    // Keep the conversation list preview in sync when this is the newest message.
    if (conversation.lastMessageAt === message.createdAt) {
      transaction.update(conversationRef, { lastMessage: text })
    }
    return { editedAt: now }
  })

  if (outcome === 'not_found') return NextResponse.json({ error: 'Nie znaleziono wiadomości.' }, { status: 404 })
  if (outcome === 'forbidden') return NextResponse.json({ error: 'Brak dostępu do tej wiadomości.' }, { status: 403 })
  if (outcome === 'not_editable') {
    return NextResponse.json({ error: 'Tej wiadomości nie można już edytować (limit 5 minut).' }, { status: 409 })
  }
  return NextResponse.json({ ok: true, editedAt: outcome.editedAt })
}
