import { Navbar } from '@/components/layout/navbar'
import { Footer } from '@/components/layout/footer'
import { getWalletStats, getWalletTransactions } from '@/services/wallet.service'
import { RequireAuth } from '@/components/auth/require-auth'
import { BackButton } from '@/components/shared/back-button'
import { WalletClient } from '@/components/wallet/wallet-client'

export default async function WalletPage() {
  const [walletStats, walletTransactions] = await Promise.all([
    getWalletStats(),
    getWalletTransactions(),
  ])

  return (
    <>
      <Navbar />
      <main id="main-content" className="bg-background">
        <RequireAuth>
        <div className="mx-auto max-w-3xl px-4 py-8 md:px-8">
          <BackButton />
          <h1 className="text-2xl font-bold text-foreground">Portfel</h1>
          <p className="mt-0.5 text-muted-foreground">Zarządzaj BeeCoins i historią transakcji</p>
          <WalletClient initialStats={walletStats} initialTransactions={walletTransactions} />
        </div>
        </RequireAuth>
      </main>
      <Footer />
    </>
  )
}
