'use client'

import { useEffect, useState } from 'react'
import { Bell, CreditCard, Star, Award, CalendarDays, X } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { useAuth } from '@/lib/auth-context'
import { getNotifications, markNotificationRead, deleteNotification } from '@/services/notifications.service'
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

  function handleDelete(e: React.MouseEvent, n: Notification) {
    e.stopPropagation()
    // Optimistic: remove immediately, restore if the delete genuinely
    // fails — same posture as every other instant-feeling action in this
    // panel/dashboard (see ParentReportSettingsCard's toggle).
    setNotifications((prev) => prev.filter((x) => x.id !== n.id))
    deleteNotification(n.id).catch(() => {
      setNotifications((prev) => (prev.some((x) => x.id === n.id) ? prev : [n, ...prev]))
    })
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-card">
      <div className="flex items-center gap-2 border-b border-border px-5 py-3.5">
        <Bell className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
        <h3 className="text-sm font-semibold text-foreground">Powiadomienia</h3>
        {unread.length > 0 && (
          <Badge className="ml-auto text-[10px]">{unread.length} nowe</Badge>
        )}
      </div>
      <div className="flex flex-col gap-0.5 p-2">
        {notifications.slice(0, 4).map((n) => {
          const Icon = notificationIconMap[n.type]
          return (
            <div key={n.id} className="group relative flex w-full items-start gap-2.5 rounded-lg px-1.5 py-2 transition-colors hover:bg-muted/50">
              <button type="button" onClick={() => handleClick(n)} className="flex min-w-0 flex-1 items-start gap-2.5 text-left">
                <div className={cn('mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md', n.read ? 'bg-muted' : 'bg-accent')}>
                  <Icon className={cn('h-3 w-3', n.read ? 'text-muted-foreground' : 'text-bee-yellow-dark')} aria-hidden="true" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className={cn('truncate text-xs', n.read ? 'text-muted-foreground' : 'font-medium text-foreground')}>{n.title}</p>
                  <p className="text-[11px] text-muted-foreground">{n.date}</p>
                </div>
                {!n.read && <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" aria-hidden="true" />}
              </button>
              <button
                type="button"
                onClick={(e) => handleDelete(e, n)}
                aria-label="Usuń powiadomienie"
                className="shrink-0 rounded-md p-1 text-muted-foreground/0 transition-colors hover:bg-destructive/10 hover:text-destructive group-hover:text-muted-foreground/70 focus-visible:text-muted-foreground/70 focus-visible:outline-none"
              >
                <X className="h-3 w-3" aria-hidden="true" />
              </button>
            </div>
          )
        })}
        {notifications.length === 0 && (
          <p className="py-6 text-center text-xs text-muted-foreground">Brak powiadomień.</p>
        )}
      </div>
    </div>
  )
}
