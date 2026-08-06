'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Wallet } from 'lucide-react'
import { useAuth } from '@/lib/auth-context'
import { getWalletStats } from '@/services/wallet.service'

interface Props {
  initialBalance: number
}

/** Real wallet balance (see services/wallet.service.ts) — was previously a static demo number unrelated to the actual wallet page. */
export function WalletBalanceLink({ initialBalance }: Props) {
  const { user } = useAuth()
  const [balance, setBalance] = useState(initialBalance)

  useEffect(() => {
    if (!user) return
    let cancelled = false
    getWalletStats(user.id).then((fresh) => {
      if (!cancelled) setBalance(fresh.balance)
    })
    return () => {
      cancelled = true
    }
  }, [user])

  return (
    <Link href="/wallet" className="flex flex-col gap-1.5 rounded-2xl border border-border bg-card p-4 transition-all hover:-translate-y-0.5 hover:border-[#F4B400]/40 hover:shadow-sm">
      <Wallet className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
      <p className="text-lg font-bold text-foreground">{balance.toLocaleString('pl-PL')} zł</p>
      <p className="text-xs text-muted-foreground">Saldo portfela</p>
    </Link>
  )
}
