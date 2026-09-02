import { Navbar } from '@/components/layout/navbar'
import { Footer } from '@/components/layout/footer'
import { RequireAuth } from '@/components/auth/require-auth'
import { BackButton } from '@/components/shared/back-button'
import { TeacherWalletClient } from '@/components/wallet/teacher-wallet-client'

/**
 * Teacher-only — there is no student wallet (students pay per-booking
 * directly via Stripe, see components/teacher/teacher-booking-calendar.tsx).
 * Every number on this page comes from Stripe or the teacher's own real
 * lesson/payout docs, never a Firestore-computed balance — see
 * components/wallet/teacher-wallet-client.tsx.
 */
export default function WalletPage() {
  return (
    <>
      <Navbar />
      <main id="main-content" className="bg-background">
        <RequireAuth role="teacher">
          <div className="mx-auto max-w-3xl px-4 py-8 md:px-8">
            <BackButton />
            <div className="mb-5 rounded-2xl border border-border bg-card px-5 py-5 md:px-6">
              <h1 className="text-xl font-bold text-foreground sm:text-2xl">Portfel</h1>
              <p className="mt-0.5 text-sm text-muted-foreground">Saldo i historia wypłat ze Stripe</p>
            </div>
            <TeacherWalletClient />
          </div>
        </RequireAuth>
      </main>
      <Footer />
    </>
  )
}
