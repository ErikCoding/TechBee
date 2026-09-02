'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import { ArrowLeft, Menu, X } from 'lucide-react'
import { BeeLogo } from '@/components/shared/bee-logo'
import { adminNavItems } from '@/components/admin/admin-nav-items'
import { cn } from '@/lib/utils'

/**
 * Mobile-only replacement for the fixed sidebar (which is `hidden` below
 * `md:`). Without this, phone users had zero way to switch admin sections or
 * get back to the site — the sidebar simply vanished with nothing standing
 * in for it. This renders a hamburger button in the mobile header and a
 * slide-over drawer with the same nav items.
 */
export function AdminMobileNav() {
  const pathname = usePathname()
  const [open, setOpen] = useState(false)

  // Close the drawer automatically whenever the route changes (link tap).
  useEffect(() => {
    setOpen(false)
  }, [pathname])

  // Escape closes the drawer, matching the Dialog primitive used elsewhere.
  useEffect(() => {
    if (!open) return
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [open])

  return (
    <div className="md:hidden">
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted"
        aria-label="Otwórz menu panelu administratora"
      >
        <Menu className="h-5 w-5" />
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex">
          <div className="absolute inset-0 bg-black/50" onClick={() => setOpen(false)} aria-hidden="true" />
          <div className="relative flex h-full w-72 max-w-[85vw] flex-col bg-card shadow-xl animate-fade-in-up">
            <div className="flex shrink-0 items-center justify-between border-b border-border px-4 py-4">
              <BeeLogo size="sm" />
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted"
                aria-label="Zamknij menu"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <nav className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto p-3" aria-label="Nawigacja panelu administratora (mobile)">
              {adminNavItems.map((item) => {
                const Icon = item.icon
                const isActive = item.href === '/admin' ? pathname === '/admin' : pathname.startsWith(item.href)
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      'flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors hover:bg-muted hover:text-foreground',
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
                className="flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                <ArrowLeft className="h-4 w-4" aria-hidden="true" />
                Wróć do Runbee
              </Link>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
