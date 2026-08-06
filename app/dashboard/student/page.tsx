import Link from 'next/link'
import {
  BookOpen, Clock, Users, Award, Flame, Wallet, Star,
  ChevronRight, Bell, CreditCard, CalendarDays
} from 'lucide-react'
import { Navbar } from '@/components/layout/navbar'
import { Footer } from '@/components/layout/footer'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { getStudentLessons, getStudentStats } from '@/services/lessons.service'
import { getNotifications } from '@/services/notifications.service'
import { RequireAuth } from '@/components/auth/require-auth'
import { GreetingName } from '@/components/auth/greeting-name'
import { StudentLessonsSection } from '@/components/dashboard/student-lessons-section'
import { cn } from '@/lib/utils'
import type { NotificationType } from '@/lib/types'

const notificationIconMap: Record<NotificationType, React.ElementType> = {
  lesson: CalendarDays,
  payment: CreditCard,
  review: Star,
  system: Bell,
  beepoints: Award,
}

export default async function StudentDashboardPage() {
  const [studentLessons, studentStats, notifications] = await Promise.all([
    getStudentLessons(),
    getStudentStats(),
    getNotifications(),
  ])

  const statCards = [
    { icon: BookOpen, label: 'Lekcje łącznie', value: studentStats.totalLessons, sub: '+3 w tym miesiącu' },
    { icon: Clock, label: 'Godziny nauki', value: studentStats.hoursLearned, sub: '+4.5 godz. w tym tygodniu' },
    { icon: Users, label: 'Nauczyciele', value: studentStats.teachersWorkedWith, sub: 'Współpraca' },
    { icon: Award, label: 'Certyfikaty', value: studentStats.certificatesEarned, sub: 'Zdobyte' },
  ]

  const unreadNotifications = notifications.filter((n) => !n.read)

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

          {/* Stat cards */}
          <div className="mt-6 grid grid-cols-2 gap-4 md:grid-cols-4">
            {statCards.map((card, i) => {
              const Icon = card.icon
              return (
                <div key={card.label} className="animate-fade-in-up rounded-2xl border border-border bg-card p-5 transition-shadow hover:shadow-sm" style={{ animationDelay: `${i * 60}ms` }}>
                  <div className="flex items-center justify-between">
                    <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#FEF3C7] dark:bg-[#3B2800]">
                      <Icon className="h-4 w-4 text-[#B45309] dark:text-[#FBBF24]" aria-hidden="true" />
                    </div>
                  </div>
                  <p className="mt-3 text-2xl font-bold text-foreground">{card.value}</p>
                  <p className="text-xs font-medium text-foreground">{card.label}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">{card.sub}</p>
                </div>
              )
            })}
          </div>

          <div className="mt-6 grid gap-6 lg:grid-cols-3">
            {/* ── Left: lessons ── */}
            <div className="flex flex-col gap-6 lg:col-span-2">
              <StudentLessonsSection initialLessons={studentLessons} />
            </div>

            {/* ── Right: sidebar ── */}
            <div className="flex flex-col gap-4">
              {/* Streak */}
              <div className="rounded-2xl border border-border bg-card p-5">
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#FEF3C7] dark:bg-[#3B2800]">
                    <Flame className="h-4 w-4 text-[#B45309] dark:text-[#FBBF24]" aria-hidden="true" />
                  </div>
                  <div>
                    <p className="text-lg font-bold text-foreground">
                      {studentStats.currentStreak} dni
                    </p>
                    <p className="text-xs text-muted-foreground">Aktualna seria nauki</p>
                  </div>
                </div>
              </div>

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
              <div className="rounded-2xl border border-border bg-card p-5">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-foreground">Powiadomienia</h3>
                  {unreadNotifications.length > 0 && (
                    <Badge className="bg-[#F4B400] text-[#0A0A0A] text-[10px]">{unreadNotifications.length} nowe</Badge>
                  )}
                </div>
                <div className="mt-3 flex flex-col gap-1">
                  {notifications.slice(0, 4).map((n) => {
                    const Icon = notificationIconMap[n.type]
                    return (
                      <div key={n.id} className="flex items-start gap-2.5 rounded-lg px-1.5 py-2 transition-colors hover:bg-muted/50">
                        <div className={cn('mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md', n.read ? 'bg-muted' : 'bg-[#FEF3C7] dark:bg-[#3B2800]')}>
                          <Icon className={cn('h-3 w-3', n.read ? 'text-muted-foreground' : 'text-[#B45309] dark:text-[#FBBF24]')} aria-hidden="true" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className={cn('truncate text-xs', n.read ? 'text-muted-foreground' : 'font-medium text-foreground')}>{n.title}</p>
                          <p className="text-[11px] text-muted-foreground">{n.date}</p>
                        </div>
                        {!n.read && <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-[#F4B400]" aria-hidden="true" />}
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* Progress by category */}
              <div className="rounded-2xl border border-border bg-card p-5">
                <h3 className="text-sm font-semibold text-foreground">Postępy w nauce</h3>
                <div className="mt-4 flex flex-col gap-4">
                  {studentStats.progressByCategory.map((item) => (
                    <div key={item.category}>
                      <div className="mb-1.5 flex items-center justify-between">
                        <span className="text-xs text-muted-foreground">{item.category}</span>
                        <span className="text-xs font-semibold text-foreground">{item.progress}%</span>
                      </div>
                      <Progress
                        value={item.progress}
                        className="h-1.5"
                        style={{ '--progress-color': item.color } as React.CSSProperties}
                      />
                    </div>
                  ))}
                </div>
              </div>

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
