'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LayoutDashboard, Users, ShieldCheck, Settings, ArrowLeft, GraduationCap } from 'lucide-react'
import { BeeLogo } from '@/components/shared/bee-logo'
import { cn } from '@/lib/utils'

const navItems = [
  { label: 'Przegląd', href: '/admin', icon: LayoutDashboard },
  { label: 'Giełda i nauczyciele', href: '/admin/teachers', icon: GraduationCap },
  { label: 'Weryfikacje', href: '/admin/verifications', icon: ShieldCheck },
  { label: 'Użytkownicy', href: '/admin/users', icon: Users },
  { label: 'Ustawienia', href: '/admin/settings', icon: Settings },
]

export function AdminSidebar() {
  const pathname = usePathname()

  return (
    <aside className="hidden w-60 shrink-0 flex-col border-r border-border bg-card md:flex">
      <div className="shrink-0 border-b border-border px-5 py-4">
        <BeeLogo size="sm" />
        <p className="mt-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Panel administratora</p>
      </div>
      <nav className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto p-3" aria-label="Nawigacja panelu administratora">
        {navItems.map((item) => {
          const Icon = item.icon
          const isActive = item.href === '/admin' ? pathname === '/admin' : pathname.startsWith(item.href)
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors hover:bg-muted hover:text-foreground',
                isActive ? 'bg-muted text-foreground' : 'text-muted-foreground',
              )}
            >
              <Icon className="h-4 w-4" aria-hidden="true" />
              {item.label}
            </Link>
          )
        })}
      </nav>
      <div className="shrink-0 border-t border-border p-3">
        <Link
          href="/"
          className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Wróć do TechBee
        </Link>
      </div>
    </aside>
  )
}
