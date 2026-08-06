import { collection, getDocs } from 'firebase/firestore'
import { adminStatsData, adminUsersData } from '@/data/admin.data'
import { auth, collections, db, isFirebaseConfigured } from '@/lib/firebase'
import { getPendingTeacherApplications } from '@/services/teachers.service'
import type { AdminStats, AdminUserRow } from '@/lib/types'

// ─────────────────────────────────────────────────────────────
// Data-access layer for the admin panel.
//
// User counts/lists are real Firestore aggregates (`users` +
// `teachers` collections). Money figures (monthly revenue, revenue
// chart) stay demo data for now — there's no real payment
// processing yet, only the wallet/BeePoints mock, per the explicit
// scoping the platform is being built against.
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

type StoredUserProfile = {
  role?: 'student' | 'teacher' | 'admin'
  createdAt?: number
}

async function getAdminStatsFirebase(): Promise<AdminStats> {
  if (!db || !auth?.currentUser) return adminStatsData
  const [usersSnap, pendingApplications] = await Promise.all([
    getDocs(collection(db, collections.users)),
    getPendingTeacherApplications(),
  ])

  const users = usersSnap.docs.map((d) => d.data() as StoredUserProfile)
  const totalStudents = users.filter((u) => u.role === 'student').length
  const totalTeachers = users.filter((u) => u.role === 'teacher').length
  const totalUsers = users.length
  const weekAgo = Date.now() - WEEK_MS
  const newSignupsThisWeek = users.filter((u) => (u.createdAt ?? 0) >= weekAgo).length

  return {
    // Keeps the demo money figures (monthlyRevenue, revenueChange,
    // revenueChart) and activeLessonsToday — there's no real payment
    // processing yet, and lesson slots are only ever booked starting
    // tomorrow (see lib/availability.ts), so a real same-day count would
    // always read zero rather than being meaningfully "live".
    ...adminStatsData,
    totalUsers,
    totalTeachers,
    totalStudents,
    newSignupsThisWeek,
    pendingVerifications: pendingApplications.length,
    usersByRole: [
      { role: 'Uczniowie', count: totalStudents, color: '#F4B400' },
      { role: 'Nauczyciele', count: totalTeachers, color: '#3B82F6' },
      { role: 'Administratorzy', count: totalUsers - totalStudents - totalTeachers, color: '#8B5CF6' },
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
