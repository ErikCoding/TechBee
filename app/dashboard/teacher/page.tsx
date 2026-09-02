import { Navbar } from '@/components/layout/navbar'
import { Footer } from '@/components/layout/footer'
import { getTeacherDashboard, getTeacherLessons } from '@/services/lessons.service'
import { getNotifications } from '@/services/notifications.service'
import { RequireAuth } from '@/components/auth/require-auth'
import { TeacherDashboardClient } from '@/components/dashboard/teacher-dashboard-client'

/**
 * Thin server shell: fetches the same three baselines as before and hands
 * them to one client orchestrator (TeacherDashboardClient), which owns
 * the layout and re-fetches scoped to the signed-in teacher.
 */
export default async function TeacherDashboardPage() {
  const [dashboardData, lessons, notifications] = await Promise.all([
    getTeacherDashboard(),
    getTeacherLessons(),
    getNotifications(),
  ])

  return (
    <>
      <Navbar />
      <main id="main-content" className="bg-background">
        <RequireAuth role="teacher">
          <div className="mx-auto max-w-7xl px-4 py-6 md:px-8 md:py-8">
            <TeacherDashboardClient
              initialData={dashboardData}
              initialLessons={lessons}
              initialNotifications={notifications}
            />
          </div>
        </RequireAuth>
      </main>
      <Footer />
    </>
  )
}
