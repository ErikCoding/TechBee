'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { CheckCircle2, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/lib/auth-context'
import { getCheckoutSessionLessonId } from '@/services/stripe.service'
import { dashboardPathForRole } from '@/lib/utils'

const POLL_INTERVAL_MS = 1500
const MAX_POLLS = 12 // ~18s — the webhook is usually near-instant

/**
 * Polls whether the paid Checkout Session has a Lesson doc yet. The
 * webhook normally creates it, and the status endpoint can reconcile it
 * directly from Stripe when local development has no webhook tunnel.
 */
export function PaymentSuccessClient() {
  const { user } = useAuth()
  const router = useRouter()
  const searchParams = useSearchParams()
  const sessionId = searchParams.get('session_id')
  const [lessonId, setLessonId] = useState<string | null>(null)
  const [timedOut, setTimedOut] = useState(false)
  const attemptsRef = useRef(0)

  useEffect(() => {
    if (!sessionId) return
    let cancelled = false

    async function poll() {
      const id = await getCheckoutSessionLessonId(sessionId!)
      if (cancelled) return
      if (id) {
        setLessonId(id)
        return
      }
      attemptsRef.current += 1
      if (attemptsRef.current >= MAX_POLLS) {
        setTimedOut(true)
        return
      }
      setTimeout(poll, POLL_INTERVAL_MS)
    }

    poll()
    return () => { cancelled = true }
  }, [sessionId])

  if (!sessionId) {
    return (
      <div className="rounded-2xl border border-border bg-card p-8 text-center">
        <p className="text-sm text-muted-foreground">Brak informacji o płatności.</p>
        <Link href="/marketplace"><Button className="mt-4" variant="outline">Wróć do giełdy</Button></Link>
      </div>
    )
  }

  if (lessonId) {
    return (
      <div className="animate-fade-in-up rounded-2xl border border-success/30 bg-success-surface p-8 text-center">
        <CheckCircle2 className="mx-auto h-10 w-10 text-success-on-surface" aria-hidden="true" />
        <h1 className="mt-3 text-lg font-semibold text-foreground">Płatność przyjęta — rezerwacja utworzona!</h1>
        <p className="mt-1 text-sm text-muted-foreground">Lekcja pojawi się w panelu, gdy nauczyciel potwierdzi termin.</p>
        <div className="mt-6 flex justify-center">
          <Button onClick={() => router.push(dashboardPathForRole(user?.role))} className="font-semibold">
            Przejdź do panelu
          </Button>
        </div>
      </div>
    )
  }

  if (timedOut) {
    return (
      <div className="rounded-2xl border border-warning/30 bg-warning-surface p-8 text-center">
        <Loader2 className="mx-auto h-8 w-8 text-warning" aria-hidden="true" />
        <h1 className="mt-3 text-lg font-semibold text-foreground">Płatność się przetwarza</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          To trwa dłużej niż zwykle — Twoja rezerwacja pojawi się w panelu automatycznie, gdy tylko Stripe potwierdzi płatność. Nie musisz nic robić.
        </p>
        <div className="mt-6 flex justify-center">
          <Button onClick={() => router.push(dashboardPathForRole(user?.role))} variant="outline">Przejdź do panelu</Button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col items-center gap-3 rounded-2xl border border-border bg-card p-8 text-center">
      <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" aria-hidden="true" />
      <p className="text-sm text-muted-foreground">Finalizujemy Twoją rezerwację…</p>
    </div>
  )
}
