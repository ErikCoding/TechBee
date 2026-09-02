import { Navbar } from '@/components/layout/navbar'
import { Footer } from '@/components/layout/footer'
import { getStudentLessons, getStudentStats } from '@/services/lessons.service'
import { getNotifications } from '@/services/notifications.service'
import { RequireAuth } from '@/components/auth/require-auth'
import { StudentDashboardClient } from '@/components/dashboard/student-dashboard-client'

/**
 * Thin server shell: fetches the same three baselines as before and hands
 * them to one client orchestrator (StudentDashboardClient), which owns
 * the layout and re-fetches scoped to the signed-in student. The page
 * itself no longer composes panels, so the dashboard's structure lives
 * in one place instead of being split between this file and
 * StudentLessonsSection.
 */
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
          <div className="mx-auto max-w-7xl px-4 py-6 md:px-8 md:py-8">
            <StudentDashboardClient
              initialLessons={studentLessons}
              initialStats={studentStats}
              initialNotifications={notifications}
            />
          </div>
        </RequireAuth>
      </main>
      <Footer />
    </>
  )
}
