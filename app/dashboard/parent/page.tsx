import Link from 'next/link'
import { ChevronRight } from 'lucide-react'
import { Navbar } from '@/components/layout/navbar'
import { Footer } from '@/components/layout/footer'
import { getNotifications } from '@/services/notifications.service'
import { getWalletStats } from '@/services/wallet.service'
import { RequireAuth } from '@/components/auth/require-auth'
import { GreetingName } from '@/components/auth/greeting-name'
import { NotificationsPanel } from '@/components/dashboard/notifications-panel'
import { WalletBalanceLink } from '@/components/dashboard/wallet-balance-link'
import { ParentLinkedStudents } from '@/components/dashboard/parent-linked-students'

export default async function ParentDashboardPage() {
  const [notifications, walletStats] = await Promise.all([getNotifications(), getWalletStats()])

  return (
    <>
      <Navbar />
      <main id="main-content" className="bg-background">
        <RequireAuth role="parent">
          <div className="mx-auto max-w-7xl px-4 py-8 md:px-8">
            {/* Page header */}
            <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Panel rodzica</p>
                <h1 className="text-2xl font-bold text-foreground">Witaj ponownie, <GreetingName /></h1>
              </div>
            </div>

            <div className="mt-6 grid gap-6 lg:grid-cols-3">
              {/* ── Left: linked students ── */}
              <div className="flex flex-col gap-6 lg:col-span-2">
                <ParentLinkedStudents />
              </div>

              {/* ── Right: sidebar ── */}
              <div className="flex flex-col gap-4">
                <WalletBalanceLink initialBalance={walletStats.balance} />

                {/* Notifications */}
                <NotificationsPanel initialNotifications={notifications} />

                {/* Quick links */}
                <div className="rounded-2xl border border-border bg-card p-5">
                  <h3 className="text-sm font-semibold text-foreground">Szybkie linki</h3>
                  <div className="mt-3 flex flex-col">
                    {[
                      { label: 'Przeglądaj giełdę nauczycieli', href: '/marketplace' },
                      { label: 'Wiadomości', href: '/chat' },
                      { label: 'Mój portfel', href: '/wallet' },
                    ].map((link) => (
                      <Link
                        key={link.href}
                        href={link.href}
                        className="flex items-center justify-between rounded-lg px-2 py-2.5 text-sm text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                      >
                        {link.label}
                        <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
                      </Link>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </RequireAuth>
      </main>
      <Footer />
    </>
  )
}
