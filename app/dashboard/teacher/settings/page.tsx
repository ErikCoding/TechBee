import type { Metadata } from 'next'
import { Navbar } from '@/components/layout/navbar'
import { Footer } from '@/components/layout/footer'
import { RequireAuth } from '@/components/auth/require-auth'
import { BackButton } from '@/components/shared/back-button'
import { TeacherPayoutSettingsCard } from '@/components/settings/teacher-payout-settings-card'
import { noIndexMetadata } from '@/lib/seo'

export const metadata: Metadata = noIndexMetadata('Ustawienia nauczyciela')

export default function TeacherSettingsPage() {
  return (
    <>
      <Navbar />
      <main id="main-content" className="bg-background">
        <RequireAuth role="teacher">
          <div className="mx-auto max-w-3xl px-4 py-8 md:px-8">
            <BackButton fallbackHref="/dashboard/teacher" />
            <div className="mb-5 rounded-2xl border border-border bg-card px-5 py-5 md:px-6">
              <h1 className="text-xl font-bold text-foreground sm:text-2xl">Ustawienia</h1>
              <p className="mt-0.5 text-sm text-muted-foreground">Profil, wypłaty i dane konta nauczyciela.</p>
            </div>
            <TeacherPayoutSettingsCard />
          </div>
        </RequireAuth>
      </main>
      <Footer />
    </>
  )
}
