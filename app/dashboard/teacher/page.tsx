import Link from 'next/link'
import { DollarSign, BookOpen, Users, Star, TrendingUp, CheckCircle2, ChevronRight } from 'lucide-react'
import { Navbar } from '@/components/layout/navbar'
import { Footer } from '@/components/layout/footer'
import { Button } from '@/components/ui/button'
import { getTeacherDashboard } from '@/services/lessons.service'
import { RequireAuth } from '@/components/auth/require-auth'
import { TeacherIdentity } from '@/components/auth/teacher-identity'
import { TeacherLessonsSection } from '@/components/dashboard/teacher-lessons-section'
import { TeacherApplicationStatus } from '@/components/dashboard/teacher-application-status'

export default async function TeacherDashboardPage() {
  const t = await getTeacherDashboard()
  const maxEarnings = Math.max(...t.earningsChart.map((e) => e.amount))

  return (
    <>
      <Navbar />
      <main id="main-content" className="bg-background">
        <RequireAuth role="teacher">
        <div className="mx-auto max-w-7xl px-4 py-8 md:px-8">
          {/* Header */}
          <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
            <TeacherIdentity fallbackName={t.name} fallbackInitials={t.initials} fallbackAvatarColor={t.avatarColor} />
            <div className="mt-3 flex items-center gap-2 sm:mt-0">
              <div className="flex items-center gap-1 rounded-full bg-[#FEF3C7] px-3 py-1 text-xs font-semibold text-[#78350F] dark:bg-[#3B2800] dark:text-[#FBBF24]">
                <Star className="h-3 w-3 fill-[#B45309] dark:fill-[#FBBF24] stroke-none" aria-hidden="true" />
                {t.rating.toFixed(1)} · {t.reviewCount} opinii
              </div>
              <Link href="/dashboard/teacher/apply">
                <Button variant="outline" size="sm">Edytuj profil</Button>
              </Link>
            </div>
          </div>

          <TeacherApplicationStatus />

          {/* Stat cards */}
          <div className="mt-6 grid grid-cols-2 gap-4 md:grid-cols-4">
            {[
              { icon: DollarSign, label: 'Ten miesiąc', value: `${t.monthlyEarnings.toLocaleString('pl-PL')} zł`, sub: 'Przychód brutto' },
              { icon: BookOpen, label: 'Lekcje', value: t.lessonsThisMonth, sub: 'W tym miesiącu' },
              { icon: Users, label: 'Uczniowie', value: t.studentsThisMonth, sub: 'Aktywni w tym miesiącu' },
              { icon: TrendingUp, label: 'Ukończenie', value: `${t.completionRate}%`, sub: 'Wynik łączny' },
            ].map((card, i) => {
              const Icon = card.icon
              return (
                <div key={card.label} className="animate-fade-in-up rounded-2xl border border-border bg-card p-5" style={{ animationDelay: `${i * 60}ms` }}>
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-muted">
                    <Icon className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                  </div>
                  <p className="mt-3 text-2xl font-bold text-foreground">{card.value}</p>
                  <p className="text-xs font-medium text-foreground">{card.label}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">{card.sub}</p>
                </div>
              )
            })}
          </div>

          <div className="mt-6 grid gap-6 lg:grid-cols-3">
            {/* Left: main panels */}
            <div className="flex flex-col gap-6 lg:col-span-2">
              {/* Earnings chart (CSS bar chart) */}
              <section className="rounded-2xl border border-border bg-card p-6">
                <h2 className="font-semibold text-foreground">Miesięczne zarobki</h2>
                <div className="mt-6 flex items-end gap-3" role="img" aria-label="Wykres słupkowy miesięcznych zarobków">
                  {t.earningsChart.map((entry) => {
                    const heightPct = (entry.amount / maxEarnings) * 100
                    return (
                      <div key={entry.month} className="flex flex-1 flex-col items-center gap-2">
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
              </section>

              <TeacherLessonsSection initialUpcoming={t.upcomingLessons} initialPending={t.pendingRequests} />
            </div>

            {/* Right: sidebar */}
            <div className="flex flex-col gap-4">
              {/* Performance */}
              <div className="rounded-2xl border border-border bg-card p-5">
                <h3 className="text-sm font-semibold text-foreground">Wyniki</h3>
                <div className="mt-4 flex flex-col gap-3">
                  {[
                    { label: 'Wskaźnik odpowiedzi', value: `${t.responseRate}%` },
                    { label: 'Wskaźnik ukończenia', value: `${t.completionRate}%` },
                    { label: 'Śr. ocena', value: `${t.rating.toFixed(1)} / 5.0` },
                    { label: 'Lekcje łącznie', value: t.lessonsThisMonth * 12 },
                  ].map((metric) => (
                    <div key={metric.label} className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">{metric.label}</span>
                      <div className="flex items-center gap-1.5">
                        <CheckCircle2 className="h-3 w-3 text-emerald-500" aria-hidden="true" />
                        <span className="text-xs font-semibold text-foreground">{metric.value}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

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
