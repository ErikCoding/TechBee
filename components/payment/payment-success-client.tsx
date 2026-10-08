'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { CheckCircle2, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/lib/auth-context'
import { getCheckoutSessionResult, type CheckoutPaymentBreakdown } from '@/services/stripe.service'
import { getLessonPackage } from '@/services/lesson-packages.service'
import { dashboardPathForRole } from '@/lib/utils'
import type { LessonPackage, LessonPackageFirstBookingStatus } from '@/lib/types'

const POLL_INTERVAL_MS = 1500
const MAX_POLLS = 12 // ~18s — the webhook is usually near-instant

function bookingHrefForPackage(pkg: LessonPackage, signedInUserId?: string): string {
  if (signedInUserId && pkg.studentId !== signedInUserId) {
    return `/teacher/${pkg.teacherId}/book?bookingForId=${pkg.studentId}&bookingForName=${encodeURIComponent(pkg.studentName)}`
  }
  return `/teacher/${pkg.teacherId}/book`
}

function pln(grosze: number): string {
  return `${(grosze / 100).toLocaleString('pl-PL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} zł`
}

function PaymentBreakdown({ payment }: { payment: CheckoutPaymentBreakdown | null }) {
  if (!payment) return null
  return (
    <div className="mx-auto mt-4 max-w-sm rounded-xl border border-success/25 bg-background/70 p-3 text-left text-xs text-muted-foreground">
      <div className="flex items-center justify-between gap-3">
        <span>Cena lekcji/pakietu</span>
        <span className="font-semibold tabular-nums text-foreground">{pln(payment.subtotalGrosze)}</span>
      </div>
      <div className="mt-1 flex items-center justify-between gap-3">
        <span>Opłata serwisowa Runbee</span>
        <span className="font-semibold tabular-nums text-foreground">{pln(payment.studentServiceFeeGrosze)}</span>
      </div>
      <div className="mt-2 flex items-center justify-between gap-3 border-t border-border pt-2 text-sm">
        <span className="font-semibold text-foreground">Zapłacono łącznie</span>
        <span className="font-bold tabular-nums text-foreground">{pln(payment.studentTotalGrosze)}</span>
      </div>
    </div>
  )
}

/**
 * Polls whether the paid Checkout Session has a Lesson doc yet. The
 * webhook normally creates it, and the status endpoint can reconcile it
 * directly from Stripe when local development has no webhook tunnel.
 */
export function PaymentSuccessClient() {
  const { user, status } = useAuth()
  const router = useRouter()
  const searchParams = useSearchParams()
  const sessionId = searchParams.get('session_id')
  const [lessonId, setLessonId] = useState<string | null>(null)
  const [packageId, setPackageId] = useState<string | null>(null)
  const [lessonPackage, setLessonPackage] = useState<LessonPackage | null>(null)
  const [payment, setPayment] = useState<CheckoutPaymentBreakdown | null>(null)
  const [firstLessonBookingStatus, setFirstLessonBookingStatus] = useState<LessonPackageFirstBookingStatus | null>(null)
  const [firstLessonBookingError, setFirstLessonBookingError] = useState<string | null>(null)
  const [timedOut, setTimedOut] = useState(false)
  const attemptsRef = useRef(0)

  useEffect(() => {
    if (!sessionId || status === 'loading') return
    let cancelled = false

    async function poll() {
      const result = await getCheckoutSessionResult(sessionId!)
      if (cancelled) return
      if (result?.type === 'lesson') {
        setLessonId(result.lessonId)
        setPayment(result.payment ?? null)
        return
      }
      if (result?.type === 'lesson_package') {
        setPackageId(result.packageId)
        setPayment(result.payment ?? null)
        setFirstLessonBookingStatus(result.firstLessonBookingStatus ?? null)
        setFirstLessonBookingError(result.firstLessonBookingError ?? null)
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
  }, [sessionId, status])

  useEffect(() => {
    if (!packageId) return
    let cancelled = false
    getLessonPackage(packageId)
      .then((pkg) => {
        if (!cancelled) setLessonPackage(pkg)
      })
      .catch(() => {
        if (!cancelled) setLessonPackage(null)
      })
    return () => { cancelled = true }
  }, [packageId])

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
        <PaymentBreakdown payment={payment} />
        <div className="mt-6 flex justify-center">
          <Button onClick={() => router.push(dashboardPathForRole(user?.role))} className="font-semibold">
            Przejdź do panelu
          </Button>
        </div>
      </div>
    )
  }

  if (packageId) {
    const bookedFirstLesson = firstLessonBookingStatus === 'booked'
    const firstLessonFailed = firstLessonBookingStatus === 'slot_conflict' || firstLessonBookingStatus === 'failed'
    return (
      <div className="animate-fade-in-up rounded-2xl border border-success/30 bg-success-surface p-8 text-center">
        <CheckCircle2 className="mx-auto h-10 w-10 text-success-on-surface" aria-hidden="true" />
        <h1 className="mt-3 text-lg font-semibold text-foreground">
          {bookedFirstLesson ? 'Pakiet aktywny — pierwsza rezerwacja wysłana!' : 'Płatność przyjęta — pakiet aktywny!'}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {bookedFirstLesson
            ? 'Pierwsza lekcja ma status oczekujący i pojawi się w panelu, gdy nauczyciel potwierdzi termin.'
            : firstLessonFailed
              ? firstLessonBookingError || 'Nie udało się zarezerwować wybranego terminu po płatności. Zachowujesz wszystkie lekcje z pakietu i możesz wybrać inny termin.'
              : 'Możesz teraz rezerwować lekcje z pakietu u wybranego nauczyciela.'}
        </p>
        <PaymentBreakdown payment={payment} />
        <div className="mt-6 flex flex-col justify-center gap-2 sm:flex-row">
          {lessonPackage && (
            <Button onClick={() => router.push(bookingHrefForPackage(lessonPackage, user?.id))} className="font-semibold">
              Zarezerwuj lekcję z pakietu
            </Button>
          )}
          <Button onClick={() => router.push(dashboardPathForRole(user?.role))} variant={lessonPackage ? 'outline' : 'default'} className="font-semibold">
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
