import type { Metadata } from 'next'
import { AdminSidebar } from '@/components/admin/admin-sidebar'
import { RequireAuth } from '@/components/auth/require-auth'
import { AdminIdentity } from '@/components/admin/admin-identity'

export const metadata: Metadata = {
  title: 'Panel administratora',
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <RequireAuth role="admin">
      {/* Fixed-height app shell: the outer row is pinned to exactly the
          viewport height and never scrolls itself — the sidebar is pure
          navigation, permanently in place, not a scrollable region at all.
          Only the <main> column scrolls, independently, based on its own
          content length.

          `min-h-0` on every nested flex child below is required — without
          it, a flex item's default `min-height: auto` lets it grow to fit
          its content instead of being constrained by the parent, which
          silently defeats `overflow-y-auto` and made the whole page (incl.
          the sidebar) scroll instead of just this column. */}
      <div className="flex h-screen overflow-hidden bg-background">
        <AdminSidebar />
        <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
          <header className="flex shrink-0 items-center justify-between border-b border-border bg-card px-4 py-3 md:px-6">
            <div>
              <p className="text-sm font-semibold text-foreground">Panel administratora TechBee</p>
              <p className="text-xs text-muted-foreground">Dane demonstracyjne — bez połączenia z produkcją</p>
            </div>
            <AdminIdentity />
          </header>
          <main id="main-content" className="min-h-0 flex-1 overflow-y-auto px-4 py-6 md:px-6">
            {children}
          </main>
        </div>
      </div>
    </RequireAuth>
  )
}
