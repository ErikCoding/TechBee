import { collection, getDocs, query, where } from 'firebase/firestore'
import { adminStatsData, adminUsersData } from '@/data/admin.data'
import { auth, collections, db, isFirebaseConfigured } from '@/lib/firebase'
import { getPendingTeacherApplications } from '@/services/teachers.service'
import type { AdminStats, AdminUserRow } from '@/lib/types'

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
// `isSignedIn()`-gated rules. `auth?.currentUser` is null in that
// context, so we fall back to the demo baseline instead; the real
// admin-only client components (AdminOverviewClient, AdminUsersPageClient)
// re-fetch once the signed-in admin is known in the browser.
// ─────────────────────────────────────────────────────────────

const WEEK_MS = 7 * 24 * 60 * 60 * 1000
const MONTH_LABELS_PL = ['Sty', 'Lut', 'Mar', 'Kwi', 'Maj', 'Cze', 'Lip', 'Sie', 'Wrz', 'Paź', 'Lis', 'Gru']

type StoredUserProfile = {
  role?: 'student' | 'teacher' | 'admin' | 'parent'
  createdAt?: number
}

type CompletedLessonRow = {
  price?: number
  completedAt?: number
}

function isSameMonth(ts: number, ref: Date): boolean {
  const d = new Date(ts)
  return d.getFullYear() === ref.getFullYear() && d.getMonth() === ref.getMonth()
}

/** Real platform revenue figures from completed-lesson payments — admin can read every lesson doc per firestore.rules. */
function computePlatformRevenue(lessons: CompletedLessonRow[]) {
  const now = new Date()
  const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1)

  const monthlyRevenue = lessons
    .filter((l) => l.completedAt && isSameMonth(l.completedAt, now))
    .reduce((sum, l) => sum + (l.price ?? 0), 0)

  const lastMonthRevenue = lessons
    .filter((l) => l.completedAt && isSameMonth(l.completedAt, lastMonth))
    .reduce((sum, l) => sum + (l.price ?? 0), 0)

  const revenueChange = lastMonthRevenue > 0
    ? Math.round(((monthlyRevenue - lastMonthRevenue) / lastMonthRevenue) * 1000) / 10
    : (monthlyRevenue > 0 ? 100 : 0)

  const revenueChart = Array.from({ length: 6 }, (_, i) => {
    const monthDate = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1)
    const amount = lessons
      .filter((l) => l.completedAt && isSameMonth(l.completedAt, monthDate))
      .reduce((sum, l) => sum + (l.price ?? 0), 0)
    return { month: MONTH_LABELS_PL[monthDate.getMonth()], amount }
  })

  const todayStart = new Date()
  todayStart.setHours(0, 0, 0, 0)
  const activeLessonsToday = lessons.filter((l) => l.completedAt && l.completedAt >= todayStart.getTime()).length

  return { monthlyRevenue, revenueChange, revenueChart, activeLessonsToday }
}

async function getAdminStatsFirebase(): Promise<AdminStats> {
  if (!db || !auth?.currentUser) return adminStatsData
  const [usersSnap, pendingApplications, completedLessonsSnap] = await Promise.all([
    getDocs(collection(db, collections.users)),
    getPendingTeacherApplications(),
    getDocs(query(collection(db, collections.lessons), where('status', '==', 'completed'))),
  ])

  const users = usersSnap.docs.map((d) => d.data() as StoredUserProfile)
  const totalStudents = users.filter((u) => u.role === 'student').length
  const totalTeachers = users.filter((u) => u.role === 'teacher').length
  const totalParents = users.filter((u) => u.role === 'parent').length
  const totalUsers = users.length
  const weekAgo = Date.now() - WEEK_MS
  const newSignupsThisWeek = users.filter((u) => (u.createdAt ?? 0) >= weekAgo).length

  const revenue = computePlatformRevenue(completedLessonsSnap.docs.map((d) => d.data() as CompletedLessonRow))

  return {
    ...adminStatsData,
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
  if (!db || !auth?.currentUser) return adminUsersData
  const snap = await getDocs(collection(db, collections.users))
  return snap.docs
    .map((d) => {
      const data = d.data() as { name?: string; email?: string; role?: AdminUserRow['role']; initials?: string; avatarColor?: string; createdAt?: number }
      return {
        id: d.id,
        name: data.name ?? 'Bez nazwy',
        initials: data.initials ?? '??',
        avatarColor: data.avatarColor ?? '#94A3B8',
        email: data.email ?? '—',
        role: data.role ?? 'student',
        // There's no suspension flow yet, so every real account reads as
        // active — this replaces the old fully-fabricated status field.
        status: 'active' as const,
        joined: data.createdAt
          ? new Date(data.createdAt).toLocaleDateString('pl-PL', { day: 'numeric', month: 'short', year: 'numeric' })
          : '—',
        // Per-user lesson counts aren't cheaply computable client-side
        // without an aggregate query/Cloud Function yet.
        lessons: 0,
      } satisfies AdminUserRow
    })
    .sort((a, b) => (a.joined === '—' ? 1 : b.joined === '—' ? -1 : 0))
}

export async function getAdminStats(): Promise<AdminStats> {
  return isFirebaseConfigured ? getAdminStatsFirebase() : adminStatsData
}

export async function getAdminUsers(): Promise<AdminUserRow[]> {
  return isFirebaseConfigured ? getAdminUsersFirebase() : adminUsersData
}
