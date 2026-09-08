import { LayoutDashboard, Users, ShieldCheck, Settings, GraduationCap, Scale } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

export type AdminNavBadgeKey = 'verifications' | 'disputes'

export type AdminNavItem = {
  label: string
  href: string
  icon: LucideIcon
  badgeKey?: AdminNavBadgeKey
}

export const adminNavItems: AdminNavItem[] = [
  { label: 'Przegląd', href: '/admin', icon: LayoutDashboard },
  { label: 'Giełda i nauczyciele', href: '/admin/teachers', icon: GraduationCap },
  { label: 'Weryfikacje', href: '/admin/verifications', icon: ShieldCheck, badgeKey: 'verifications' },
  { label: 'Spory', href: '/admin/disputes', icon: Scale, badgeKey: 'disputes' },
  { label: 'Użytkownicy', href: '/admin/users', icon: Users },
  { label: 'Ustawienia', href: '/admin/settings', icon: Settings },
]
