import { adminStatsData, adminUsersData } from '@/data/admin.data'
import type { AdminStats, AdminUserRow } from '@/lib/types'

// ─────────────────────────────────────────────────────────────
// Data-access layer for the admin panel. In production this should
// be backed by Cloud Functions / aggregation queries rather than
// raw client-side Firestore reads, since it spans all users.
// ─────────────────────────────────────────────────────────────

export async function getAdminStats(): Promise<AdminStats> {
  // TODO(firebase): call a Cloud Function that aggregates platform-wide stats
  return adminStatsData
}

export async function getAdminUsers(): Promise<AdminUserRow[]> {
  // TODO(firebase): const snap = await getDocs(query(collection(db, 'users'), orderBy('joined', 'desc')))
  return adminUsersData
}
