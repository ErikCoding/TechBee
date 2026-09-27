import type { AdminAuthUser } from '@/lib/firebase-admin-auth'
import type { AdminUserRow, UserRole } from '@/lib/types'

export type StoredAdminUserProfile = {
  id: string
  name?: string
  email?: string
  role?: UserRole
  initials?: string
  avatarColor?: string
  photoUrl?: string
  createdAt?: number
}

function joinedLabel(createdAt: number | undefined): string {
  return createdAt
    ? new Date(createdAt).toLocaleDateString('pl-PL', { day: 'numeric', month: 'short', year: 'numeric' })
    : '—'
}

export function buildAdminUserRows(
  profiles: StoredAdminUserProfile[],
  authUsers: AdminAuthUser[],
): AdminUserRow[] {
  const authByUid = new Map(authUsers.map((user) => [user.uid, user]))

  return profiles
    .map((profile) => {
      const authUser = authByUid.get(profile.id)
      return {
        id: profile.id,
        name: profile.name ?? 'Bez nazwy',
        initials: profile.initials ?? '??',
        avatarColor: profile.avatarColor ?? '#94A3B8',
        ...(profile.photoUrl ? { photoUrl: profile.photoUrl } : {}),
        email: authUser?.email ?? profile.email ?? '—',
        emailVerified: authUser ? authUser.emailVerified : null,
        role: profile.role ?? 'student',
        // There's no suspension flow yet, so every real account reads as
        // active — this replaces the old fully-fabricated status field.
        status: 'active' as const,
        joined: joinedLabel(profile.createdAt),
        createdAt: profile.createdAt ?? 0,
        // Per-user lesson counts aren't cheaply computable without an
        // aggregate query/Cloud Function yet.
        lessons: 0,
      } satisfies AdminUserRow
    })
    .sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0))
}
