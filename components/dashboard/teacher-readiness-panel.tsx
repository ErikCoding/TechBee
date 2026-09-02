'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { ClipboardList, Clock, XCircle, CheckCircle2, Rocket } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Panel } from '@/components/dashboard/dashboard-primitives'
import { TeacherStripeConnectCard } from '@/components/dashboard/teacher-stripe-connect-card'
import { useAuth } from '@/lib/auth-context'
import { getTeacherApplication } from '@/services/teachers.service'
import type { Teacher } from '@/lib/types'

interface Props {
  /** Told the teacher's approved marketplace profile so the page header can link to it. */
  onApplicationLoaded?: (application: Teacher | null) => void
}

/**
 * "Zanim zaczniesz uczyć" — one grouped setup area replacing the two
 * separate full-width banners that used to stack above everything else
 * on the teacher dashboard (profile verification status, then Stripe
 * payout onboarding).
 *
 * The important behaviour: once the profile is approved *and* payouts
 * are verified, this renders nothing at all. Previously an established
 * teacher permanently carried two "everything is fine" banners at the
 * top of their dashboard, pushing the day's actual work below the fold
 * — a status message that can never change is not worth a full-width
 * block on every visit. The approved profile's public link moves to the
 * page header instead, where it stays reachable.
 *
 * Both underlying data sources are unchanged: getTeacherApplication for
 * profile state, and TeacherStripeConnectCard (with all of its live
 * status refresh and post-onboarding polling intact) for payouts.
 */
export function TeacherReadinessPanel({ onApplicationLoaded }: Props) {
  const { user } = useAuth()
  const [application, setApplication] = useState<Teacher | null | undefined>(undefined)
  const [payoutsReady, setPayoutsReady] = useState<boolean | null>(null)

  useEffect(() => {
    if (!user) return
    let cancelled = false
    getTeacherApplication(user.id).then((app) => {
      if (cancelled) return
      const resolved = app ?? null
      setApplication(resolved)
      onApplicationLoaded?.(resolved)
    })
    return () => {
      cancelled = true
    }
    // onApplicationLoaded is a stable useCallback in the orchestrator
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user])

  const handlePayoutStatus = useCallback((complete: boolean) => setPayoutsReady(complete), [])

  // Still resolving — render nothing rather than a placeholder that will
  // usually vanish a moment later.
  if (application === undefined) return null

  const profileApproved = application !== null && application.status !== 'pending' && application.status !== 'rejected'
  const everythingReady = profileApproved && payoutsReady === true

  // Keep the Stripe card mounted even when hidden: it owns the live
  // status check whose result decides whether this panel should show.
  if (everythingReady) {
    return (
      <div className="hidden">
        <TeacherStripeConnectCard variant="row" onStatusChange={handlePayoutStatus} />
      </div>
    )
  }

  const profileRow = (() => {
    if (application === null) {
      return {
        icon: ClipboardList,
        title: 'Uzupełnij profil nauczyciela',
        detail: 'Wyślij profil do weryfikacji, aby uczniowie mogli Cię znaleźć w giełdzie.',
        action: (
          <Link href="/dashboard/teacher/apply">
            <Button size="sm" className="font-semibold">Uzupełnij profil</Button>
          </Link>
        ),
      }
    }
    if (application.status === 'pending') {
      return {
        icon: Clock,
        title: 'Profil czeka na weryfikację',
        detail: 'Administrator sprawdza Twoje zgłoszenie. Pojawisz się w giełdzie zaraz po akceptacji.',
        action: (
          <Link href="/dashboard/teacher/apply">
            <Button size="sm" variant="outline">Edytuj zgłoszenie</Button>
          </Link>
        ),
      }
    }
    if (application.status === 'rejected') {
      return {
        icon: XCircle,
        title: 'Zgłoszenie zostało odrzucone',
        detail: 'Popraw dane profilu i wyślij je ponownie do weryfikacji.',
        action: (
          <Link href="/dashboard/teacher/apply">
            <Button size="sm" className="font-semibold">Popraw i wyślij</Button>
          </Link>
        ),
      }
    }
    return {
      icon: CheckCircle2,
      title: 'Profil zweryfikowany',
      detail: 'Jesteś widoczny w giełdzie nauczycieli.',
      action: (
        <Link href={`/teacher/${application.id}`}>
          <Button size="sm" variant="ghost" className="text-xs">Zobacz profil</Button>
        </Link>
      ),
    }
  })()

  const ProfileIcon = profileRow.icon
  const profileDone = profileApproved

  return (
    <Panel icon={Rocket} title="Zanim zaczniesz uczyć" tone="attention">
      <div className="flex flex-col divide-y divide-border">
        <div className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center">
          <ProfileIcon
            className={`h-5 w-5 shrink-0 sm:mt-0.5 sm:self-start ${profileDone ? 'text-success' : 'text-warning'}`}
            aria-hidden="true"
          />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-foreground">{profileRow.title}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">{profileRow.detail}</p>
          </div>
          <div className="shrink-0 sm:ml-auto">{profileRow.action}</div>
        </div>

        <TeacherStripeConnectCard variant="row" onStatusChange={handlePayoutStatus} />
      </div>
    </Panel>
  )
}
