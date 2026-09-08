'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { BeeLogo } from '@/components/shared/bee-logo'
import { adminNavItems } from '@/components/admin/admin-nav-items'
import { useAdminPendingCounts } from '@/components/admin/use-admin-pending-counts'
import { cn } from '@/lib/utils'

/** Desktop-only fixed nav column — on mobile this is replaced by AdminMobileNav (a slide-over drawer), since there's no room for a permanent 240px column on a phone screen. */
export function AdminSidebar() {
  const pathname = usePathname()
  const counts = useAdminPendingCounts()

  return (
    <aside className="hidden w-60 shrink-0 flex-col border-r border-border bg-card md:flex">
      <div className="shrink-0 border-b border-border px-5 py-4">
        <BeeLogo size="sm" />
        <p className="mt-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Panel administratora</p>
      </div>
      <nav className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto p-3" aria-label="Nawigacja panelu administratora">
        {adminNavItems.map((item) => {
          const Icon = item.icon
          const isActive = item.href === '/admin' ? pathname === '/admin' : pathname.startsWith(item.href)
          const count = item.badgeKey && counts ? counts[item.badgeKey] : 0
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center gap-2.5 rounded-lg border-l-2 border-transparent px-3 py-2 text-sm font-medium transition-colors hover:bg-muted hover:text-foreground',
                isActive ? 'border-l-primary bg-accent text-accent-foreground' : 'text-muted-foreground',
                count > 0 && !isActive && 'bg-warning-surface/45 text-foreground',
              )}
            >
              <Icon className="h-4 w-4" aria-hidden="true" />
              <span className="min-w-0 flex-1 truncate">{item.label}</span>
              {count > 0 && (
                <span className="flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-primary px-1.5 text-[10px] font-bold text-primary-foreground">
                  {count}
                </span>
              )}
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
          Wróć do Runbee
        </Link>
      </div>
    </aside>
  )
}
