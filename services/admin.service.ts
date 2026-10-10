import { auth, isFirebaseConfigured } from '@/lib/firebase'
import { emptyAdminStats } from '@/lib/admin-stats-core'
import type {
  AdminAccountDeletionRequestRow,
  AdminStats,
  AdminUserRow,
  FoundingTeacherAdminDashboard,
  FoundingTeacherProgramConfig,
  PlatformWalletEntry,
  PlatformWalletSummary,
} from '@/lib/types'

// ─────────────────────────────────────────────────────────────
// Data-access layer for the admin panel.
//
// Browser code calls admin-only API routes with the current Firebase ID
// token. SSR still gets an explicit empty placeholder, then the signed-in
// admin refreshes real aggregates through trusted backend endpoints.
// ─────────────────────────────────────────────────────────────

async function getAdminUsersFirebase(): Promise<AdminUserRow[]> {
  if (typeof window === 'undefined' || !auth?.currentUser) return []
  const data = await adminJson<{ users: AdminUserRow[] }>('/api/admin/users', 'POST')
  return data.users
}

export async function getAdminStats(): Promise<AdminStats> {
  if (!isFirebaseConfigured || typeof window === 'undefined' || !auth?.currentUser) return emptyAdminStats()
  const data = await adminJson<{ stats: AdminStats }>('/api/admin/stats', 'POST')
  return data.stats
}

export async function getAdminUsers(): Promise<AdminUserRow[]> {
  return isFirebaseConfigured ? getAdminUsersFirebase() : []
}

export async function setAdminUserDisabled(userId: string, disabled: boolean): Promise<{ user: AdminUserRow }> {
  return adminJson(`/api/admin/users/${encodeURIComponent(userId)}/account-status`, 'PATCH', { disabled })
}

export async function listAdminAccountDeletionRequests(): Promise<{ requests: AdminAccountDeletionRequestRow[] }> {
  return adminJson('/api/admin/account-deletion-requests', 'POST')
}

export async function updateAdminAccountDeletionRequest(
  requestId: string,
  action: 'review' | 'mark_needs_resolution' | 'deactivate_access' | 'reject',
  reason?: string,
): Promise<{ ok: true; status: AdminAccountDeletionRequestRow['status']; hasDependencies: boolean; dependencySummary: AdminAccountDeletionRequestRow['dependencySummary'] }> {
  return adminJson(`/api/admin/account-deletion-requests/${encodeURIComponent(requestId)}`, 'PATCH', { action, reason })
}

export async function finalizeAdminAccountDeletion(
  requestId: string,
  input: { confirmation: string; confirmUserId: string; stripeConnectAcknowledged?: boolean },
): Promise<{ ok: true; status: 'completed'; alreadyCompleted?: boolean }> {
  return adminJson(`/api/admin/account-deletion-requests/${encodeURIComponent(requestId)}/finalize`, 'POST', input)
}

async function getIdToken(): Promise<string | undefined> {
  return auth?.currentUser?.getIdToken().catch(() => undefined)
}

async function adminJson<T>(path: string, method: 'POST' | 'PATCH' | 'DELETE', body: Record<string, unknown> = {}): Promise<T> {
  const idToken = await getIdToken()
  const res = await fetch(path, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...body, idToken }),
  })
  const data = await res.json().catch(() => ({}) as Record<string, unknown>)
  if (!res.ok) {
    throw new Error(typeof data.error === 'string' ? data.error : 'Coś poszło nie tak. Spróbuj ponownie.')
  }
  return data as T
}

export async function getPlatformWallet(): Promise<{ summary: PlatformWalletSummary; entries: PlatformWalletEntry[] }> {
  return adminJson('/api/admin/platform-wallet', 'POST')
}

export async function updatePlatformCommission(commissionPercent: number): Promise<{ summary: PlatformWalletSummary; entries: PlatformWalletEntry[] }> {
  return adminJson('/api/admin/platform-wallet', 'PATCH', { commissionPercent })
}

export async function getFoundingTeacherDashboard(): Promise<FoundingTeacherAdminDashboard> {
  return adminJson('/api/admin/founding-teachers', 'POST')
}

export async function updateFoundingTeacherProgramConfig(config: Partial<FoundingTeacherProgramConfig>): Promise<FoundingTeacherAdminDashboard> {
  return adminJson('/api/admin/founding-teachers', 'PATCH', { config })
}

export async function initializeFoundingTeacherProgram(confirm: boolean): Promise<FoundingTeacherAdminDashboard> {
  return adminJson('/api/admin/founding-teachers/initialize', 'POST', { confirm })
}

export async function updateFoundingTeacherPromotion(
  teacherId: string,
  patch: { rate?: number; endsAt?: number; marketplaceHighlight?: boolean },
): Promise<FoundingTeacherAdminDashboard> {
  return adminJson(`/api/admin/founding-teachers/${teacherId}`, 'PATCH', patch)
}

export interface AdminConversationRow {
  id: string
  participantNames: string[]
  lastMessage: string
  lastMessageAt: number
}

/** Clears only sandbox (Stripe test-mode) bookings — see app/api/admin/reset-sandbox-stripe/route.ts. Leaves every real/live lesson and all chat history untouched. */
export async function resetSandboxStripeData(): Promise<{ deletedLessons: number; deletedSlotLocks: number }> {
  return adminJson('/api/admin/reset-sandbox-stripe', 'POST')
}

/** Every conversation on the platform, newest first — admin-only, goes through the trusted server since firestore.rules only lets a conversation's own participants read it directly. */
export async function listAdminConversations(): Promise<AdminConversationRow[]> {
  const data = await adminJson<{ conversations: AdminConversationRow[] }>('/api/admin/conversations', 'POST')
  return data.conversations
}

/** Permanently deletes one conversation and every message in it. */
export async function deleteAdminConversation(conversationId: string): Promise<{ deletedMessages: number }> {
  return adminJson(`/api/admin/conversations/${conversationId}`, 'DELETE')
}
