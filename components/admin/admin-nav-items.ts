import { LayoutDashboard, Users, ShieldCheck, Settings, GraduationCap } from 'lucide-react'

export const adminNavItems = [
  { label: 'Przegląd', href: '/admin', icon: LayoutDashboard },
  { label: 'Giełda i nauczyciele', href: '/admin/teachers', icon: GraduationCap },
  { label: 'Weryfikacje', href: '/admin/verifications', icon: ShieldCheck },
  { label: 'Użytkownicy', href: '/admin/users', icon: Users },
  { label: 'Ustawienia', href: '/admin/settings', icon: Settings },
]
