import Link from 'next/link'
import { Wallet, Star, ChevronRight } from 'lucide-react'
import { Navbar } from '@/components/layout/navbar'
import { Footer } from '@/components/layout/footer'
import { Button } from '@/components/ui/button'
import { getStudentLessons, getStudentStats } from '@/services/lessons.service'
import { getNotifications } from '@/services/notifications.service'
import { RequireAuth } from '@/components/auth/require-auth'
import { GreetingName } from '@/components/auth/greeting-name'
import { StudentLessonsSection } from '@/components/dashboard/student-lessons-section'
import { StudentStatsCards } from '@/components/dashboard/student-stats-client'
import { NotificationsPanel } from '@/components/dashboard/notifications-panel'

export default async function StudentDashboardPage() {
  const [studentLessons, studentStats, notifications] = await Promise.all([
    getStudentLessons(),
    getStudentStats(),
    getNotifications(),
  ])

  return (
    <>
      <Navbar />
      <main id="main-content" className="bg-background">
        <RequireAuth role="student">
        <div className="mx-auto max-w-7xl px-4 py-8 md:px-8">
          {/* Page header */}
          <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Panel ucznia</p>
              <h1 className="text-2xl font-bold text-foreground">Witaj ponownie, <GreetingName /></h1>
            </div>
            <Link href="/marketplace">
              <Button className="mt-3 bg-[#F4B400] text-[#0A0A0A] hover:bg-[#FBBF24] font-semibold sm:mt-0 transition-transform hover:-translate-y-0.5">
                Zarezerwuj nową lekcję
              </Button>
            </Link>
          </div>

          {/* Stat cards — real counts from this student's lessons */}
          <StudentStatsCards initialStats={studentStats} />

          <div className="mt-6 grid gap-6 lg:grid-cols-3">
            {/* ── Left: lessons ── */}
            <div className="flex flex-col gap-6 lg:col-span-2">
              <StudentLessonsSection initialLessons={studentLessons} />
            </div>

            {/* ── Right: sidebar ── */}
            <div className="flex flex-col gap-4">
              {/* Wallet & BeePoints */}
              <div className="grid grid-cols-2 gap-3">
                <Link href="/wallet" className="flex flex-col gap-1.5 rounded-2xl border border-border bg-card p-4 transition-all hover:-translate-y-0.5 hover:border-[#F4B400]/40 hover:shadow-sm">
                  <Wallet className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
                  <p className="text-lg font-bold text-foreground">{studentStats.techCoins} zł</p>
                  <p className="text-xs text-muted-foreground">Saldo portfela</p>
                </Link>
                <Link href="/beepoints" className="flex flex-col gap-1.5 rounded-2xl border border-border bg-card p-4 transition-all hover:-translate-y-0.5 hover:border-[#F4B400]/40 hover:shadow-sm">
                  <Star className="h-5 w-5 fill-[#F4B400] stroke-none" aria-hidden="true" />
                  <p className="text-lg font-bold text-foreground">{studentStats.beePoints.toLocaleString('pl-PL')}</p>
                  <p className="text-xs text-muted-foreground">BeePoints</p>
                </Link>
              </div>

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
                    { label: 'Nagrody BeePoints', href: '/beepoints' },
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
