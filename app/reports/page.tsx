import { Suspense } from 'react'
import { Navbar } from '@/components/layout/navbar'
import { Footer } from '@/components/layout/footer'
import { RequireAuth } from '@/components/auth/require-auth'
import { BackButton } from '@/components/shared/back-button'
import { ReportsClient } from '@/components/dashboard/reports-client'

export default function ReportsPage() {
  return (
    <>
      <Navbar />
      <main id="main-content" className="bg-background">
        <RequireAuth role={['student', 'teacher', 'parent']}>
          <div className="mx-auto max-w-5xl px-4 py-6 md:px-8">
            <BackButton />
            <div className="rounded-2xl border border-border bg-card px-5 py-5 md:px-6">
              <h1 className="text-xl font-bold text-foreground sm:text-2xl">Raporty z lekcji</h1>
              <p className="mt-0.5 text-sm text-muted-foreground">Potwierdzaj, zgłaszaj spory i przeglądaj historię raportów w jednym miejscu.</p>
            </div>
            <div className="mt-5">
              <Suspense fallback={<div className="h-[240px] animate-pulse rounded-2xl border border-border bg-card" />}>
                <ReportsClient />
              </Suspense>
            </div>
          </div>
        </RequireAuth>
      </main>
      <Footer />
    </>
  )
}
