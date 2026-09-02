'use client'

import { useEffect, useMemo, useState } from 'react'
import { Bell, CreditCard, Star, Award, CalendarDays, Trash2, X } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
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
  const [unreadOnly, setUnreadOnly] = useState(false)
  const [error, setError] = useState<string | null>(null)

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
  const visibleNotifications = useMemo(
    () => (unreadOnly ? notifications.filter((n) => !n.read) : notifications),
    [notifications, unreadOnly],
  )

  function handleClick(n: Notification) {
    if (n.read) return
    setError(null)
    setNotifications((prev) => prev.map((x) => (x.id === n.id ? { ...x, read: true } : x)))
    markNotificationRead(n.id, user?.id)
  }

  function handleDelete(e: React.MouseEvent, n: Notification) {
    e.preventDefault()
    e.stopPropagation()
    setError(null)
    setNotifications((prev) => prev.filter((x) => x.id !== n.id))
    deleteNotification(n.id, user?.id)
  }

  function deleteRead() {
    const read = notifications.filter((n) => n.read)
    if (read.length === 0) return
    setError(null)
    setNotifications((prev) => prev.filter((n) => !n.read))
    read.forEach((n) => deleteNotification(n.id, user?.id))
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-card">
      <div className="flex flex-wrap items-center gap-2 border-b border-border bg-muted/40 px-4 py-3.5 sm:px-5">
        <Bell className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
        <h3 className="min-w-0 flex-1 text-sm font-semibold text-foreground">Powiadomienia</h3>
        {unread.length > 0 && (
          <Badge className="text-[10px]">{unread.length} nowe</Badge>
        )}
        <div className="flex w-full items-center gap-1.5 sm:w-auto">
          <Button
            type="button"
            variant={unreadOnly ? 'default' : 'outline'}
            size="sm"
            onClick={() => setUnreadOnly((v) => !v)}
            className="h-8 flex-1 text-xs sm:flex-none"
            disabled={notifications.length === 0}
          >
            Nieprzeczytane
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={deleteRead}
            className="h-8 flex-1 text-xs sm:flex-none"
            disabled={!notifications.some((n) => n.read)}
          >
            <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
            Przeczytane
          </Button>
        </div>
      </div>
      {error && (
        <div className="border-b border-border bg-destructive/10 px-4 py-2 text-xs text-destructive sm:px-5">
          {error}
        </div>
      )}
      <div className="max-h-[340px] overflow-y-auto p-2">
        {visibleNotifications.map((n) => {
          const Icon = notificationIconMap[n.type]
          return (
            <div key={n.id} className="group relative flex w-full items-start gap-2.5 rounded-lg px-2 py-2.5 transition-colors hover:bg-muted/50">
              <button type="button" onClick={() => handleClick(n)} className="flex min-w-0 flex-1 items-start gap-2.5 text-left">
                <div className={cn('mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg', n.read ? 'bg-muted' : 'bg-accent')}>
                  <Icon className={cn('h-3.5 w-3.5', n.read ? 'text-muted-foreground' : 'text-bee-yellow-dark')} aria-hidden="true" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className={cn('min-w-0 flex-1 text-xs', n.read ? 'text-muted-foreground' : 'font-semibold text-foreground')}>{n.title}</p>
                    {!n.read && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-primary" aria-hidden="true" />}
                  </div>
                  <p className="mt-0.5 line-clamp-2 text-[11px] leading-relaxed text-muted-foreground">{n.description}</p>
                  <p className="mt-1 text-[10px] text-muted-foreground">{n.date}</p>
                </div>
              </button>
              <button
                type="button"
                onClick={(e) => handleDelete(e, n)}
                aria-label="Usuń powiadomienie"
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive focus-visible:outline-none sm:text-muted-foreground/0 sm:group-hover:text-muted-foreground/70 sm:focus-visible:text-muted-foreground/70"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
          )
        })}
        {notifications.length === 0 && (
          <p className="py-8 text-center text-xs text-muted-foreground">Brak powiadomień.</p>
        )}
        {notifications.length > 0 && visibleNotifications.length === 0 && (
          <p className="py-8 text-center text-xs text-muted-foreground">Brak nieprzeczytanych powiadomień.</p>
        )}
      </div>
    </div>
  )
}
