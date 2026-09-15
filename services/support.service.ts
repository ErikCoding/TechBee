import { auth } from '@/lib/firebase'
import type { SupportMessage, SupportMessageStatus } from '@/lib/types'

export type ContactMessageInput = {
  name: string
  email: string
  subject: string
  message: string
  website?: string
}

async function getIdToken(): Promise<string | undefined> {
  return auth?.currentUser?.getIdToken().catch(() => undefined)
}

async function jsonRequest<T>(path: string, method: 'POST' | 'PATCH', body: Record<string, unknown>): Promise<T> {
  const res = await fetch(path, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const data = await res.json().catch(() => ({}) as Record<string, unknown>)
  if (!res.ok) {
    throw new Error(typeof data.error === 'string' ? data.error : 'Coś poszło nie tak. Spróbuj ponownie.')
  }
  return data as T
}

async function adminJson<T>(method: 'POST' | 'PATCH', body: Record<string, unknown> = {}): Promise<T> {
  const idToken = await getIdToken()
  return jsonRequest<T>('/api/admin/support-messages', method, { ...body, idToken })
}

export async function submitContactMessage(input: ContactMessageInput): Promise<void> {
  await jsonRequest('/api/support/messages', 'POST', input)
}

export async function listAdminSupportMessages(): Promise<{ messages: SupportMessage[]; unreadCount: number }> {
  return adminJson('POST')
}

export async function updateAdminSupportMessageStatus(messageId: string, status: SupportMessageStatus): Promise<void> {
  await adminJson('PATCH', { messageId, status })
}
