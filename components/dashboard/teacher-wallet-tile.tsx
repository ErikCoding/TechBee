'use client'

import { useEffect, useState } from 'react'
import { Clock, Wallet } from 'lucide-react'
import { Panel, PanelFooterLink } from '@/components/dashboard/dashboard-primitives'
import { getTeacherWallet } from '@/services/stripe.service'
import { fromGrosze } from '@/lib/stripe-config'
import type { TeacherWalletSummary } from '@/lib/types'

function pln(grosze: number): string {
  return `${fromGrosze(grosze).toLocaleString('pl-PL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} zł`
}

/**
 * Read-only wallet balance tile. Uses the same Stripe-backed wallet call
 * as /wallet (nothing is written).
 */
export function TeacherWalletTile() {
  const [summary, setSummary] = useState<TeacherWalletSummary | null>(null)
  const [state, setState] = useState<'loading' | 'ready' | 'unavailable'>('loading')

  useEffect(() => {
    let cancelled = false
    getTeacherWallet()
      .then((wallet) => {
        if (cancelled) return
        setSummary(wallet.summary)
        setState('ready')
      })
      .catch(() => {
        if (!cancelled) setState('unavailable')
      })
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <Panel icon={Wallet} title="Portfel">
      <div className="px-5 py-5">
        <p className="text-xs text-muted-foreground">Dostępne środki</p>
        {state === 'loading' ? (
          <div className="mt-2 h-9 w-40 animate-pulse rounded-lg bg-foreground/[0.06]" />
        ) : (
          <p className="mt-1 break-words text-3xl font-bold tracking-tight text-foreground">
            {summary ? pln(summary.availableGrosze) : '—'}
          </p>
        )}
        {state === 'unavailable' && (
          <p className="mt-2 text-xs text-muted-foreground">
            Saldo będzie widoczne po połączeniu konta Stripe w sekcji „Zanim zaczniesz uczyć”.
          </p>
        )}
        {summary && state === 'ready' && (
          <p className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-foreground/[0.06] px-2.5 py-1 text-[11px] text-muted-foreground">
            <Clock className="h-3 w-3" aria-hidden="true" />
            Oczekujące: <span className="font-semibold text-foreground">{pln(summary.pendingGrosze)}</span>
          </p>
        )}
      </div>
      <PanelFooterLink href="/wallet" icon={Wallet}>
        Portfel i wypłaty
      </PanelFooterLink>
    </Panel>
  )
}
