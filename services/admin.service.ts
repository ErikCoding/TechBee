import { collection, getDocs } from 'firebase/firestore'
import { auth, collections, db, isFirebaseConfigured } from '@/lib/firebase'
import { computeAdminPlatformRevenue, type AdminRevenueLessonRow } from '@/lib/admin-revenue-metrics'
import { getPendingTeacherApplications } from '@/services/teachers.service'
import type { AdminStats, AdminUserRow, FoundingTeacherAdminDashboard, FoundingTeacherProgramConfig, PlatformWalletEntry, PlatformWalletSummary } from '@/lib/types'

// ─────────────────────────────────────────────────────────────
// Data-access layer for the admin panel.
//
// User counts/lists are real Firestore aggregates (`users` +
// `teachers` collections). Revenue figures are computed from real
// completed `lessons` docs (`price` + `completedAt`) — the same
// event that actually moves simulated money from student to teacher
// wallets (see completeLesson in lessons.service.ts) — instead of
// demo data, now that this is a genuine payment event.
//
// These are called once, unauthenticated, from the /admin server
// components during SSR (no Firebase Auth session exists on the
// server) — querying Firestore there would just throw against the
// `isSignedIn()`-gated rules. In that context the panel now renders
// honest empty values and then re-fetches real data once the signed-in
// admin is known in the browser.
// ─────────────────────────────────────────────────────────────

const WEEK_MS = 7 * 24 * 60 * 60 * 1000
const MONTH_LABELS_PL = ['Sty', 'Lut', 'Mar', 'Kwi', 'Maj', 'Cze', 'Lip', 'Sie', 'Wrz', 'Paź', 'Lis', 'Gru']

function emptyAdminStats(): AdminStats {
  const now = new Date()
  return {
    totalUsers: 0,
    totalTeachers: 0,
    totalStudents: 0,
    activeLessonsToday: 0,
    monthlyRevenue: 0,
    monthlyNetRevenue: null,
    monthlyNetRevenueComplete: false,
    revenueChange: 0,
    newSignupsThisWeek: 0,
    pendingVerifications: 0,
    revenueChart: Array.from({ length: 6 }, (_, i) => {
      const monthDate = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1)
      return { month: MONTH_LABELS_PL[monthDate.getMonth()], amount: 0, platformFee: 0, teacherAmount: 0 }
    }),
    usersByRole: [
      { role: 'Uczniowie', count: 0, color: '#F4B400' },
      { role: 'Nauczyciele', count: 0, color: '#3B82F6' },
      { role: 'Rodzice', count: 0, color: '#10B981' },
      { role: 'Administratorzy', count: 0, color: '#8B5CF6' },
    ],
  }
}

type StoredUserProfile = {
  role?: 'student' | 'teacher' | 'admin' | 'parent'
  createdAt?: number
}

async function getAdminStatsFirebase(): Promise<AdminStats> {
  if (!db || !auth?.currentUser) return emptyAdminStats()
  const [usersSnap, pendingApplications, completedLessonsSnap] = await Promise.all([
    getDocs(collection(db, collections.users)),
    getPendingTeacherApplications(),
    getDocs(collection(db, collections.lessons)),
  ])

  const users = usersSnap.docs.map((d) => d.data() as StoredUserProfile)
  const totalStudents = users.filter((u) => u.role === 'student').length
  const totalTeachers = users.filter((u) => u.role === 'teacher').length
  const totalParents = users.filter((u) => u.role === 'parent').length
  const totalUsers = users.length
  const weekAgo = Date.now() - WEEK_MS
  const newSignupsThisWeek = users.filter((u) => (u.createdAt ?? 0) >= weekAgo).length

  const revenue = computeAdminPlatformRevenue(completedLessonsSnap.docs.map((d) => d.data() as AdminRevenueLessonRow))

  return {
    ...revenue,
    totalUsers,
    totalTeachers,
    totalStudents,
    newSignupsThisWeek,
    pendingVerifications: pendingApplications.length,
    usersByRole: [
      { role: 'Uczniowie', count: totalStudents, color: '#F4B400' },
      { role: 'Nauczyciele', count: totalTeachers, color: '#3B82F6' },
      { role: 'Rodzice', count: totalParents, color: '#10B981' },
      { role: 'Administratorzy', count: totalUsers - totalStudents - totalTeachers - totalParents, color: '#8B5CF6' },
    ],
  }
}

async function getAdminUsersFirebase(): Promise<AdminUserRow[]> {
  if (!db || !auth?.currentUser) return []
  const snap = await getDocs(collection(db, collections.users))
  return snap.docs
    .map((d) => {
      const data = d.data() as { name?: string; email?: string; role?: AdminUserRow['role']; initials?: string; avatarColor?: string; photoUrl?: string; createdAt?: number }
      return {
        id: d.id,
        name: data.name ?? 'Bez nazwy',
        initials: data.initials ?? '??',
        avatarColor: data.avatarColor ?? '#94A3B8',
        ...(data.photoUrl ? { photoUrl: data.photoUrl } : {}),
        email: data.email ?? '—',
        role: data.role ?? 'student',
        // There's no suspension flow yet, so every real account reads as
        // active — this replaces the old fully-fabricated status field.
        status: 'active' as const,
        joined: data.createdAt
          ? new Date(data.createdAt).toLocaleDateString('pl-PL', { day: 'numeric', month: 'short', year: 'numeric' })
          : '—',
        createdAt: data.createdAt ?? 0,
        // Per-user lesson counts aren't cheaply computable client-side
        // without an aggregate query/Cloud Function yet.
        lessons: 0,
      } satisfies AdminUserRow
    })
    .sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0))
}

export async function getAdminStats(): Promise<AdminStats> {
  return isFirebaseConfigured ? getAdminStatsFirebase() : emptyAdminStats()
}

export async function getAdminUsers(): Promise<AdminUserRow[]> {
  return isFirebaseConfigured ? getAdminUsersFirebase() : []
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
