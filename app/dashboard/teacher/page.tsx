import Link from 'next/link'
import { ChevronRight } from 'lucide-react'
import { Navbar } from '@/components/layout/navbar'
import { Footer } from '@/components/layout/footer'
import { Button } from '@/components/ui/button'
import { getTeacherDashboard } from '@/services/lessons.service'
import { getNotifications } from '@/services/notifications.service'
import { RequireAuth } from '@/components/auth/require-auth'
import { TeacherIdentity } from '@/components/auth/teacher-identity'
import { TeacherLessonsSection } from '@/components/dashboard/teacher-lessons-section'
import { TeacherApplicationStatus } from '@/components/dashboard/teacher-application-status'
import { TeacherRatingBadge } from '@/components/dashboard/teacher-rating-badge'
import { TeacherStatCards } from '@/components/dashboard/teacher-stat-cards'
import { TeacherPerformancePanel } from '@/components/dashboard/teacher-performance-panel'
import { NotificationsPanel } from '@/components/dashboard/notifications-panel'

export default async function TeacherDashboardPage() {
  const [t, notifications] = await Promise.all([getTeacherDashboard(), getNotifications()])
  const maxEarnings = Math.max(...t.earningsChart.map((e) => e.amount))

  return (
    <>
      <Navbar />
      <main id="main-content" className="bg-background">
        <RequireAuth role="teacher">
        <div className="mx-auto max-w-7xl px-4 py-8 md:px-8">
          {/* Header */}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <TeacherIdentity fallbackName={t.name} fallbackInitials={t.initials} fallbackAvatarColor={t.avatarColor} />
            <div className="flex flex-wrap items-center gap-2">
              <TeacherRatingBadge initialRating={t.rating} initialReviewCount={t.reviewCount} />
              <Link href="/dashboard/teacher/apply">
                <Button variant="outline" size="sm">Edytuj profil</Button>
              </Link>
            </div>
          </div>

          <TeacherApplicationStatus />

          {/* Stat cards */}
          <TeacherStatCards initialData={t} />

          <div className="mt-6 grid gap-6 lg:grid-cols-3">
            {/* Left: main panels */}
            <div className="flex flex-col gap-6 lg:col-span-2">
              {/* Earnings chart (CSS bar chart) */}
              <section className="rounded-2xl border border-border bg-card p-6">
                <h2 className="font-semibold text-foreground">Miesięczne zarobki</h2>
                {/* overflow-x-auto + a min width per bar: on narrow phones 6
                    squeezed flex-1 columns clipped their labels — now it
                    scrolls horizontally instead of crushing the numbers. */}
                <div className="mt-6 overflow-x-auto">
                  <div className="flex items-end gap-3" role="img" aria-label="Wykres słupkowy miesięcznych zarobków">
                    {t.earningsChart.map((entry) => {
                      const heightPct = (entry.amount / maxEarnings) * 100
                      return (
                        <div key={entry.month} className="flex w-11 shrink-0 flex-1 flex-col items-center gap-2">
                          <span className="text-[10px] font-semibold text-muted-foreground">
                            {(entry.amount / 1000).toFixed(1)}k zł
                          </span>
                          <div className="relative w-full rounded-t-lg bg-muted" style={{ height: '100px' }}>
                            <div
                              className="absolute bottom-0 w-full origin-bottom rounded-t-lg transition-all duration-700 ease-out"
                              style={{
                                height: `${heightPct}%`,
                                background: entry.month === 'Lip' ? '#F4B400' : '#E4E4E7',
                              }}
                            />
                          </div>
                          <span className="text-[10px] text-muted-foreground">{entry.month}</span>
                        </div>
                      )
                    })}
                  </div>
                </div>
              </section>

              <TeacherLessonsSection initialUpcoming={t.upcomingLessons} initialPending={t.pendingRequests} />
            </div>

            {/* Right: sidebar */}
            <div className="flex flex-col gap-4">
              {/* Performance */}
              <TeacherPerformancePanel initialData={t} />

              {/* Notifications */}
              <NotificationsPanel initialNotifications={notifications} />

              {/* Total earnings card */}
              <div className="rounded-2xl border border-border bg-card p-5">
                <p className="text-xs font-medium text-muted-foreground">Zarobki łączne</p>
                <p className="mt-1 text-2xl font-bold text-foreground">
                  {t.totalEarnings.toLocaleString('pl-PL')} zł
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {t.lessonsThisMonth * 12}+ ukończonych lekcji
                </p>
              </div>

              {/* Quick links */}
              <div className="rounded-2xl border border-border bg-card p-5">
                <h3 className="text-sm font-semibold text-foreground">Szybkie linki</h3>
                <div className="mt-3 flex flex-col">
                  {[
                    { label: 'Wiadomości', href: '/chat' },
                    { label: 'Portfel', href: '/wallet' },
                    { label: 'BeePoints', href: '/beepoints' },
                    { label: 'Uzupełnij / edytuj profil', href: '/dashboard/teacher/apply' },
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
