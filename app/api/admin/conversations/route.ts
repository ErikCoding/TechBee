import { NextResponse } from 'next/server'
import { adminDb, isAdminConfigured } from '@/lib/firebase-admin'
import { collections } from '@/lib/firebase'
import { verifyCaller, getVerifiedUserRole } from '@/lib/stripe-server-auth'
import type { ChatParticipant } from '@/lib/types'

// ─────────────────────────────────────────────────────────────
// Lists every conversation for the admin "clear a specific chat" panel
// (components/admin/admin-chat-cleanup-panel.tsx). Has to go through
// the trusted admin SDK rather than the client Firestore SDK: per
// firestore.rules, only a conversation's own two participants can
// *read* it — the admin-only rule on /conversations/{id} only covers
// `delete` (used by the broader reset-activity button), not `read`, so
// an admin's own browser genuinely cannot list conversations any other
// way.
// ─────────────────────────────────────────────────────────────

export const runtime = 'nodejs'

export interface AdminConversationRow {
  id: string
  participantNames: string[]
  lastMessage: string
  lastMessageAt: number
}

export async function POST(request: Request) {
  if (!isAdminConfigured) {
    return NextResponse.json({ error: 'Zaufane zapisy Firestore nie są skonfigurowane.' }, { status: 503 })
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
  if (role !== 'admin') return NextResponse.json({ error: 'Tylko administrator ma dostęp do listy konwersacji.' }, { status: 403 })

  try {
    const snap = await adminDb!.collection(collections.conversations).get()
    const conversations: AdminConversationRow[] = snap.docs
      .map((d) => {
        const data = d.data() as {
          participantIds?: string[]
          participants?: Record<string, ChatParticipant>
          lastMessage?: string
          lastMessageAt?: number
        }
        const participantNames = (data.participantIds ?? []).map((id) => data.participants?.[id]?.name ?? 'Nieznany użytkownik')
        return {
          id: d.id,
          participantNames,
          lastMessage: data.lastMessage ?? '',
          lastMessageAt: data.lastMessageAt ?? 0,
        }
      })
      .sort((a, b) => b.lastMessageAt - a.lastMessageAt)

    return NextResponse.json({ conversations })
  } catch (err) {
    console.error('[admin/conversations] Failed to list:', err)
    return NextResponse.json({ error: 'Nie udało się pobrać listy konwersacji.' }, { status: 500 })
  }
}
