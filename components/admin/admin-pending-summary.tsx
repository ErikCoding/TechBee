'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ShieldCheck, ArrowRight } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { getPendingTeacherApplications } from '@/services/teachers.service'

/**
 * Small live counter for the overview page. Fetches client-side —
 * this (like the verification queue itself) is an admin-only read
 * that Firestore rules reject during unauthenticated SSR, so it
 * can't be pre-fetched in the server component body.
 */
export function AdminPendingSummary() {
  const [count, setCount] = useState<number | null>(null)

  useEffect(() => {
    getPendingTeacherApplications().then((list) => setCount(list.length))
  }, [])

  return (
    <Link
      href="/admin/verifications"
      className="flex items-center justify-between rounded-2xl border border-border bg-card p-6 transition-colors hover:bg-muted/40"
    >
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-accent">
          <ShieldCheck className="h-4 w-4 text-bee-yellow-dark" aria-hidden="true" />
        </div>
        <div>
          <p className="flex items-center gap-2 text-sm font-semibold text-foreground">
            Zgłoszenia do weryfikacji
            {count !== null && count > 0 && <Badge className="text-[10px]">{count}</Badge>}
          </p>
          <p className="text-xs text-muted-foreground">Nowi nauczyciele czekający na sprawdzenie kwalifikacji</p>
        </div>
      </div>
      <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
    </Link>
  )
}
