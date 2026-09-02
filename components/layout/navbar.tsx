'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { Menu, X, Wallet, Star, MessageSquare, LayoutDashboard, LogOut, ChevronDown, ClipboardCheck } from 'lucide-react'
import { BeeLogo } from '@/components/shared/bee-logo'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useAuth } from '@/lib/auth-context'
import { ChatNavBadge } from '@/components/chat/chat-nav-badge'
import { cn, dashboardPathForRole, roleLabelPl } from '@/lib/utils'

const navLinks = [
  { label: 'Giełda nauczycieli', href: '/marketplace' },
  { label: 'Jak to działa', href: '/#how-it-works' },
  { label: 'Dla nauczycieli', href: '/teach' },
  { label: 'O nas', href: '/about' },
]

// Section ids the scrollspy below watches — must match the anchors in navLinks.
const spySectionIds = ['how-it-works']

export function Navbar() {
  const pathname = usePathname()
  const router = useRouter()
  const { user, status, logout } = useAuth()
  const [mobileOpen, setMobileOpen] = useState(false)
  const [activeSection, setActiveSection] = useState<string | null>(null)

  const dashboardHref = dashboardPathForRole(user?.role)

  // Real-time scrollspy: highlights the nav link for whichever section is
  // currently centered in the viewport, only relevant on the one-pager.
  useEffect(() => {
    if (pathname !== '/') {
      setActiveSection(null)
      return
    }
    const elements = spySectionIds
      .map((id) => document.getElementById(id))
      .filter((el): el is HTMLElement => el !== null)
    if (elements.length === 0) return

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) setActiveSection(entry.target.id)
        }
      },
      { rootMargin: '-40% 0px -50% 0px', threshold: 0 },
    )
    elements.forEach((el) => observer.observe(el))
    return () => observer.disconnect()
  }, [pathname])

  function isLinkActive(href: string) {
    if (href.startsWith('/#')) {
      return pathname === '/' && activeSection === href.slice(2)
    }
    return pathname === href
  }

  async function handleLogout() {
    await logout()
    setMobileOpen(false)
    router.push('/')
  }

  return (
    <header className="sticky top-0 z-50 border-b border-border/60 bg-background/80 backdrop-blur-md">
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4 md:px-8">
        {/* Logo */}
        <BeeLogo size="md" />

        {/* Desktop nav switches on at lg, not md: at exactly 768px the four
            Polish labels plus the two auth buttons no longer fit on one
            line and wrapped inside the fixed 56px bar. Tablets get the
            mobile menu instead, which is the correct affordance there. */}
        <nav className="hidden items-center gap-1 lg:flex" aria-label="Główna nawigacja">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={cn(
                'relative px-3.5 py-2 text-sm font-medium transition-colors hover:text-foreground',
                isLinkActive(link.href) ? 'text-foreground' : 'text-muted-foreground',
              )}
            >
              {link.label}
              {isLinkActive(link.href) && (
                <span className="absolute inset-x-3.5 -bottom-[1px] h-0.5 rounded-full bg-primary" aria-hidden="true" />
              )}
            </Link>
          ))}
        </nav>

        {/* Desktop actions */}
        <div className="hidden items-center gap-2 lg:flex">
          {status === 'loading' ? (
            <div className="h-8 w-24 animate-pulse rounded-lg bg-muted" aria-hidden="true" />
          ) : status === 'authenticated' && user ? (
            <>
            <ChatNavBadge />
            <DropdownMenu>
              <DropdownMenuTrigger className="flex items-center gap-2 rounded-full py-1 pl-1 pr-2.5 transition-colors hover:bg-muted">
                <Avatar className="h-7 w-7">
                  <AvatarFallback color={user.avatarColor} className="text-[11px]">
                    {user.initials}
                  </AvatarFallback>
                </Avatar>
                <span className="max-w-[110px] truncate text-sm font-medium text-foreground">{user.firstName}</span>
                <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuLabel>{roleLabelPl(user.role)}</DropdownMenuLabel>
                <DropdownMenuItem onClick={() => router.push(dashboardHref)}>
                  <LayoutDashboard className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                  Panel
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => router.push('/chat')}>
                  <MessageSquare className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                  Wiadomości
                </DropdownMenuItem>
                {user.role !== 'admin' && (
                  <DropdownMenuItem onClick={() => router.push('/reports')}>
                    <ClipboardCheck className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                    Raporty
                  </DropdownMenuItem>
                )}
                {user.role === 'teacher' && (
                  <DropdownMenuItem onClick={() => router.push('/wallet')}>
                    <Wallet className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                    Portfel
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem onClick={() => router.push('/beepoints')}>
                  <Star className="h-4 w-4 fill-primary stroke-primary" aria-hidden="true" />
                  BeePoints
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleLogout} className="text-destructive data-highlighted:bg-destructive/10">
                  <LogOut className="h-4 w-4" aria-hidden="true" />
                  Wyloguj się
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            </>
          ) : (
            <>
              <Link href="/login">
                <Button variant="ghost" size="sm">Zaloguj się</Button>
              </Link>
              <Link href="/register">
                <Button size="sm" className="font-semibold">
                  Załóż konto
                </Button>
              </Link>
            </>
          )}
        </div>

        {/* Mobile actions: messages badge always visible + hamburger */}
        <div className="flex items-center gap-1 lg:hidden">
          <ChatNavBadge />
          <button
            className="flex items-center justify-center rounded-lg p-2 text-muted-foreground hover:bg-muted"
            aria-label={mobileOpen ? 'Zamknij menu' : 'Otwórz menu'}
            onClick={() => setMobileOpen(!mobileOpen)}
          >
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      {mobileOpen && (
        <div className="animate-fade-in-up border-t border-border bg-background px-4 pb-4 lg:hidden">
          <nav className="flex flex-col gap-1 pt-3">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setMobileOpen(false)}
                className={cn(
                  'rounded-lg px-3 py-2.5 text-sm font-medium transition-colors hover:bg-muted',
                  isLinkActive(link.href) ? 'bg-muted text-foreground' : 'text-muted-foreground',
                )}
              >
                {link.label}
              </Link>
            ))}

            {status === 'authenticated' && user ? (
              <>
                <div className="mt-2 flex items-center gap-2 rounded-lg bg-muted px-3 py-2.5">
                  <Avatar className="h-7 w-7">
                    <AvatarFallback color={user.avatarColor} className="text-[11px]">
                      {user.initials}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-foreground">{user.name}</p>
                    <p className="text-xs text-muted-foreground">{roleLabelPl(user.role)}</p>
                  </div>
                </div>
                <Link href={dashboardHref} onClick={() => setMobileOpen(false)} className="flex items-center gap-2 rounded-lg px-3 py-2.5 text-sm font-medium text-muted-foreground hover:bg-muted">
                  <LayoutDashboard className="h-4 w-4" /> Panel
                </Link>
                <Link href="/chat" onClick={() => setMobileOpen(false)} className="flex items-center gap-2 rounded-lg px-3 py-2.5 text-sm font-medium text-muted-foreground hover:bg-muted">
                  <MessageSquare className="h-4 w-4" /> Wiadomości
                </Link>
                {user.role !== 'admin' && (
                  <Link href="/reports" onClick={() => setMobileOpen(false)} className="flex items-center gap-2 rounded-lg px-3 py-2.5 text-sm font-medium text-muted-foreground hover:bg-muted">
                    <ClipboardCheck className="h-4 w-4" /> Raporty
                  </Link>
                )}
                {user.role === 'teacher' && (
                  <Link href="/wallet" onClick={() => setMobileOpen(false)} className="flex items-center gap-2 rounded-lg px-3 py-2.5 text-sm font-medium text-muted-foreground hover:bg-muted">
                    <Wallet className="h-4 w-4" /> Portfel
                  </Link>
                )}
                <Link href="/beepoints" onClick={() => setMobileOpen(false)} className="flex items-center gap-2 rounded-lg px-3 py-2.5 text-sm font-medium text-muted-foreground hover:bg-muted">
                  <Star className="h-4 w-4 fill-primary stroke-primary" /> BeePoints
                </Link>
                <button
                  type="button"
                  onClick={handleLogout}
                  className="mt-2 flex items-center gap-2 rounded-lg px-3 py-2.5 text-left text-sm font-medium text-destructive hover:bg-destructive/10"
                >
                  <LogOut className="h-4 w-4" /> Wyloguj się
                </button>
              </>
            ) : (
              <div className="mt-2 flex flex-col gap-2">
                <Link href="/login" onClick={() => setMobileOpen(false)}>
                  <Button variant="outline" className="w-full">Zaloguj się</Button>
                </Link>
                <Link href="/register" onClick={() => setMobileOpen(false)}>
                  <Button className="w-full font-semibold">Załóż konto</Button>
                </Link>
              </div>
            )}

            <Link href="/marketplace" onClick={() => setMobileOpen(false)} className="mt-2">
              <Button className="w-full font-semibold">Znajdź nauczyciela</Button>
            </Link>
          </nav>
        </div>
      )}
    </header>
  )
}
