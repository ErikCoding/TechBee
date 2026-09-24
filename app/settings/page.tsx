import type { Metadata } from 'next'
import { Footer } from '@/components/layout/footer'
import { Navbar } from '@/components/layout/navbar'
import { RequireAuth } from '@/components/auth/require-auth'
import { SettingsClient } from '@/components/settings/settings-client'
import { noIndexMetadata } from '@/lib/seo'

export const metadata: Metadata = noIndexMetadata('Ustawienia')

export default function SettingsPage() {
  return (
    <>
      <Navbar />
      <main id="main-content" className="bg-background">
        <RequireAuth role={['student', 'teacher', 'parent']}>
          <div className="mx-auto max-w-6xl px-4 py-6 md:px-8 md:py-8">
            <SettingsClient />
          </div>
        </RequireAuth>
      </main>
      <Footer />
    </>
  )
}
