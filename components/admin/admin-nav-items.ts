import { Inbox, LayoutDashboard, Users, ShieldCheck, Settings, GraduationCap, Scale, Trophy, Video, UserX } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

export type AdminNavBadgeKey = 'verifications' | 'disputes' | 'support' | 'accountDeletion'

export type AdminNavItem = {
  label: string
  href: string
  icon: LucideIcon
  badgeKey?: AdminNavBadgeKey
}

export const adminNavItems: AdminNavItem[] = [
  { label: 'Przegląd', href: '/admin', icon: LayoutDashboard },
  { label: 'Giełda i nauczyciele', href: '/admin/teachers', icon: GraduationCap },
  { label: 'Pierwsza 50', href: '/admin/founding-teachers', icon: Trophy },
  { label: 'Weryfikacje', href: '/admin/verifications', icon: ShieldCheck, badgeKey: 'verifications' },
  { label: 'Spory', href: '/admin/disputes', icon: Scale, badgeKey: 'disputes' },
  { label: 'Support', href: '/admin/support', icon: Inbox, badgeKey: 'support' },
  { label: 'Użytkownicy', href: '/admin/users', icon: Users },
  { label: 'Usuwanie kont', href: '/admin/account-deletion-requests', icon: UserX, badgeKey: 'accountDeletion' },
  { label: 'Test LiveKit', href: '/admin/livekit-test', icon: Video },
  { label: 'Ustawienia', href: '/admin/settings', icon: Settings },
]
