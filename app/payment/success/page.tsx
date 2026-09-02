import { Suspense } from 'react'
import { Navbar } from '@/components/layout/navbar'
import { Footer } from '@/components/layout/footer'
import { RequireAuth } from '@/components/auth/require-auth'
import { PaymentSuccessClient } from '@/components/payment/payment-success-client'

export default function PaymentSuccessPage() {
  return (
    <>
      <Navbar />
      <main id="main-content" className="bg-background">
        <RequireAuth>
          <div className="mx-auto max-w-lg px-4 py-16 md:px-8">
            <Suspense fallback={<div className="h-64 animate-pulse rounded-2xl border border-border bg-card" />}>
              <PaymentSuccessClient />
            </Suspense>
          </div>
        </RequireAuth>
      </main>
      <Footer />
    </>
  )
}
