import { Navbar } from '@/components/layout/navbar'
import { Footer } from '@/components/layout/footer'
import { getNotifications } from '@/services/notifications.service'
import { RequireAuth } from '@/components/auth/require-auth'
import { ParentDashboardClient } from '@/components/dashboard/parent-dashboard-client'

/**
 * Thin server shell. Everything else on this page is per-parent data
 * that Firestore rules only allow an authenticated parent to read, so it
 * is fetched client-side by ParentDashboardClient — the notifications
 * baseline is the one thing that can be server-rendered.
 */
export default async function ParentDashboardPage() {
  const notifications = await getNotifications()

  return (
    <>
      <Navbar />
      <main id="main-content" className="bg-background">
        <RequireAuth role="parent">
          <div className="mx-auto max-w-7xl px-4 py-6 md:px-8 md:py-8">
            <ParentDashboardClient initialNotifications={notifications} />
          </div>
        </RequireAuth>
      </main>
      <Footer />
    </>
  )
}
