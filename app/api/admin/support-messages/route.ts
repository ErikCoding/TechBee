import { NextResponse } from 'next/server'
import { adminDb, isAdminConfigured } from '@/lib/firebase-admin'
import { collections } from '@/lib/firebase'
import { getVerifiedUserRole, verifyCaller } from '@/lib/stripe-server-auth'
import type { SupportMessage, SupportMessageStatus } from '@/lib/types'

async function requireAdmin(idToken?: string): Promise<{ uid: string } | NextResponse> {
  if (!isAdminConfigured || !adminDb) {
    return NextResponse.json({ error: 'Zaufane zapisy Firestore nie są skonfigurowane.' }, { status: 503 })
  }
  const uid = await verifyCaller(idToken)
  if (!uid) return NextResponse.json({ error: 'Musisz być zalogowany.' }, { status: 401 })
  const role = await getVerifiedUserRole(uid)
  if (role !== 'admin') return NextResponse.json({ error: 'Tylko administrator ma dostęp do wiadomości supportu.' }, { status: 403 })
  return { uid }
}

function row(id: string, data: Record<string, unknown>): SupportMessage {
  return {
    id,
    name: String(data.name ?? 'Bez imienia'),
    email: String(data.email ?? '—'),
    subject: String(data.subject ?? 'Wiadomość ze strony'),
    message: String(data.message ?? ''),
    status: (data.status === 'read' || data.status === 'archived' ? data.status : 'unread') as SupportMessageStatus,
    createdAt: Number(data.createdAt ?? 0),
    updatedAt: Number(data.updatedAt ?? 0),
    ...(typeof data.readAt === 'number' ? { readAt: data.readAt } : {}),
    ...(typeof data.archivedAt === 'number' ? { archivedAt: data.archivedAt } : {}),
    source: 'contact-page',
  }
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}) as { idToken?: string })
  const admin = await requireAdmin(body.idToken)
  if (admin instanceof NextResponse) return admin

  const snap = await adminDb!
    .collection(collections.supportMessages)
    .orderBy('createdAt', 'desc')
    .get()
  const messages = snap.docs.map((doc) => row(doc.id, doc.data()))
  const unreadCount = messages.filter((message) => message.status === 'unread').length
  return NextResponse.json({ messages, unreadCount })
}

export async function PATCH(request: Request) {
  const body = await request.json().catch(() => ({}) as { idToken?: string; messageId?: string; status?: SupportMessageStatus })
  const admin = await requireAdmin(body.idToken)
  if (admin instanceof NextResponse) return admin

  const messageId = typeof body.messageId === 'string' ? body.messageId : ''
  if (!messageId) return NextResponse.json({ error: 'Brak ID wiadomości.' }, { status: 400 })

  const status = body.status
  if (status !== 'read' && status !== 'unread' && status !== 'archived') {
    return NextResponse.json({ error: 'Nieprawidłowy status wiadomości.' }, { status: 400 })
  }

  const now = Date.now()
  const patch: Record<string, unknown> = { status, updatedAt: now }
  if (status === 'read') patch.readAt = now
  if (status === 'archived') patch.archivedAt = now
  await adminDb!.collection(collections.supportMessages).doc(messageId).set(patch, { merge: true })
  return NextResponse.json({ ok: true })
}
