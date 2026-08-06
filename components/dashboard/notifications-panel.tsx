'use client'

import { useEffect, useState } from 'react'
import { Bell, CreditCard, Star, Award, CalendarDays } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { useAuth } from '@/lib/auth-context'
import { getNotifications, markNotificationRead } from '@/services/notifications.service'
import { cn } from '@/lib/utils'
import type { Notification, NotificationType } from '@/lib/types'

const notificationIconMap: Record<NotificationType, React.ElementType> = {
  lesson: CalendarDays,
  payment: CreditCard,
  review: Star,
  system: Bell,
  beepoints: Award,
}

interface Props {
  initialNotifications: Notification[]
}

/**
 * Shared "Powiadomienia" panel for both dashboards. Starts from the
 * server-fetched demo baseline and re-fetches scoped to the real
 * signed-in user once known client-side — real notifications land
 * here from booking a lesson (teacher gets notified) and from an
 * admin approving/rejecting a teacher application (applicant gets
 * notified). Clicking an unread one marks it read.
 */
export function NotificationsPanel({ initialNotifications }: Props) {
  const { user } = useAuth()
  const [notifications, setNotifications] = useState(initialNotifications)

  useEffect(() => {
    if (!user) return
    let cancelled = false
    getNotifications(user.id).then((fresh) => {
      if (!cancelled) setNotifications(fresh)
    })
    return () => {
      cancelled = true
    }
  }, [user])

  const unread = notifications.filter((n) => !n.read)

  function handleClick(n: Notification) {
    if (n.read) return
    setNotifications((prev) => prev.map((x) => (x.id === n.id ? { ...x, read: true } : x)))
    markNotificationRead(n.id)
  }

  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground">Powiadomienia</h3>
        {unread.length > 0 && (
          <Badge className="bg-[#F4B400] text-[#0A0A0A] text-[10px]">{unread.length} nowe</Badge>
        )}
      </div>
      <div className="mt-3 flex flex-col gap-1">
        {notifications.slice(0, 4).map((n) => {
          const Icon = notificationIconMap[n.type]
          return (
            <button
              key={n.id}
              type="button"
              onClick={() => handleClick(n)}
              className="flex w-full items-start gap-2.5 rounded-lg px-1.5 py-2 text-left transition-colors hover:bg-muted/50"
            >
              <div className={cn('mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md', n.read ? 'bg-muted' : 'bg-[#FEF3C7] dark:bg-[#3B2800]')}>
                <Icon className={cn('h-3 w-3', n.read ? 'text-muted-foreground' : 'text-[#B45309] dark:text-[#FBBF24]')} aria-hidden="true" />
              </div>
              <div className="min-w-0 flex-1">
                <p className={cn('truncate text-xs', n.read ? 'text-muted-foreground' : 'font-medium text-foreground')}>{n.title}</p>
                <p className="text-[11px] text-muted-foreground">{n.date}</p>
              </div>
              {!n.read && <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-[#F4B400]" aria-hidden="true" />}
            </button>
          )
        })}
        {notifications.length === 0 && (
          <p className="py-4 text-center text-xs text-muted-foreground">Brak powiadomień.</p>
        )}
      </div>
    </div>
  )
}
