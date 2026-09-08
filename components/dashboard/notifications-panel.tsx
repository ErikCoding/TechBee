'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { Award, Bell, BellOff, CalendarDays, ChevronRight, CreditCard, Star, Trash2, X } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Dialog, DialogBody, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { useAuth } from '@/lib/auth-context'
import { getNotifications, markNotificationRead, deleteNotification } from '@/services/notifications.service'
import { cn, dashboardPathForRole } from '@/lib/utils'
import type { Notification, NotificationType, UserRole } from '@/lib/types'

const notificationIconMap: Record<NotificationType, React.ElementType> = {
  lesson: CalendarDays,
  payment: CreditCard,
  review: Star,
  system: Bell,
  beepoints: Award,
}

function notificationTarget(notification: Notification, role?: UserRole): string | null {
  if (notification.actionHref) return notification.actionHref
  if (notification.type === 'lesson') return role === 'teacher' ? '/dashboard/teacher' : role === 'parent' ? '/dashboard/parent' : '/dashboard/student'
  if (notification.type === 'payment') return role === 'teacher' ? '/wallet' : dashboardPathForRole(role)
  if (notification.type === 'review') return '/reports'
  if (notification.type === 'beepoints') return '/beepoints'
  return dashboardPathForRole(role)
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
  const [selectedNotification, setSelectedNotification] = useState<Notification | null>(null)
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

  function openNotification(n: Notification) {
    setError(null)
    setSelectedNotification({ ...n, read: true })
    if (!n.read) {
      setNotifications((prev) => prev.map((x) => (x.id === n.id ? { ...x, read: true } : x)))
      markNotificationRead(n.id, user?.id)
    }
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
    <>
      <div className="overflow-hidden rounded-2xl border border-border bg-card">
        <div className="grid gap-3 border-b border-border bg-muted/40 px-4 py-3.5 sm:px-5">
          <div className="flex min-w-0 items-center gap-2">
            <Bell className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
            <h3 className="min-w-0 flex-1 truncate text-sm font-semibold text-foreground">Powiadomienia</h3>
            {unread.length > 0 && <Badge className="shrink-0 text-[10px]">{unread.length} nowe</Badge>}
          </div>
          {notifications.length > 0 && (
            <div className="grid grid-cols-2 gap-1.5">
              <Button
                type="button"
                variant={unreadOnly ? 'default' : 'outline'}
                size="sm"
                onClick={() => setUnreadOnly((v) => !v)}
                className="h-8 min-w-0 text-xs"
              >
                Nieprzeczytane
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={deleteRead}
                className="h-8 min-w-0 text-xs"
                disabled={!notifications.some((n) => n.read)}
              >
                <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                Przeczytane
              </Button>
            </div>
          )}
        </div>
        {error && (
          <div className="border-b border-border bg-destructive/10 px-4 py-2 text-xs text-destructive sm:px-5">
            {error}
          </div>
        )}
        <div className="max-h-[340px] min-h-[156px] overflow-y-auto p-2">
          {visibleNotifications.map((n) => {
            const Icon = notificationIconMap[n.type]
            return (
              <div key={n.id} className="group relative flex w-full items-start gap-2 rounded-xl px-2 py-2 transition-colors hover:bg-muted/50">
                <button type="button" onClick={() => openNotification(n)} className="flex min-w-0 flex-1 items-start gap-2.5 rounded-lg text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                  <div className={cn('mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg', n.read ? 'bg-muted' : 'bg-accent')}>
                    <Icon className={cn('h-3.5 w-3.5', n.read ? 'text-muted-foreground' : 'text-bee-yellow-dark')} aria-hidden="true" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex min-w-0 items-center gap-2">
                      <p className={cn('min-w-0 flex-1 truncate text-xs', n.read ? 'text-muted-foreground' : 'font-semibold text-foreground')}>{n.title}</p>
                      {!n.read && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-primary" aria-hidden="true" />}
                    </div>
                    <p className="mt-0.5 line-clamp-2 text-[11px] leading-relaxed text-muted-foreground">{n.description}</p>
                    <div className="mt-1 flex items-center gap-1 text-[10px] text-muted-foreground">
                      <span>{n.date}</span>
                      <ChevronRight className="ml-auto h-3 w-3 opacity-60" aria-hidden="true" />
                    </div>
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
            <div className="flex min-h-[140px] flex-col items-center justify-center gap-2 px-4 text-center">
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-muted text-muted-foreground">
                <BellOff className="h-4 w-4" aria-hidden="true" />
              </span>
              <p className="text-xs font-medium text-foreground">Brak powiadomień</p>
              <p className="max-w-[15rem] text-[11px] leading-relaxed text-muted-foreground">
                Gdy pojawi się rezerwacja, płatność lub raport, zobaczysz to tutaj.
              </p>
            </div>
          )}
          {notifications.length > 0 && visibleNotifications.length === 0 && (
            <div className="flex min-h-[140px] flex-col items-center justify-center gap-2 px-4 text-center">
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-muted text-muted-foreground">
                <BellOff className="h-4 w-4" aria-hidden="true" />
              </span>
              <p className="text-xs font-medium text-foreground">Brak nieprzeczytanych</p>
              <p className="max-w-[15rem] text-[11px] leading-relaxed text-muted-foreground">
                Wszystkie powiadomienia zostały już otwarte.
              </p>
            </div>
          )}
        </div>
      </div>

      {selectedNotification && (
        <NotificationDetailsDialog
          notification={selectedNotification}
          targetHref={notificationTarget(selectedNotification, user?.role)}
          onClose={() => setSelectedNotification(null)}
        />
      )}
    </>
  )
}

function NotificationDetailsDialog({
  notification,
  targetHref,
  onClose,
}: {
  notification: Notification
  targetHref: string | null
  onClose: () => void
}) {
  const Icon = notificationIconMap[notification.type]

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose() }}>
      <DialogContent>
        <DialogHeader>
          <div className="flex items-start gap-3 pr-8">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-accent text-bee-yellow-dark">
              <Icon className="h-4 w-4" aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <DialogTitle className="leading-snug">{notification.title}</DialogTitle>
              <DialogDescription>{notification.date}</DialogDescription>
            </div>
          </div>
        </DialogHeader>
        <DialogBody>
          <p className="whitespace-pre-line text-sm leading-relaxed text-muted-foreground">
            {notification.description}
          </p>
        </DialogBody>
        <DialogFooter className="justify-between">
          <Button type="button" variant="outline" onClick={onClose}>
            Zamknij
          </Button>
          {targetHref && (
            <Link href={targetHref} onClick={onClose}>
              <Button type="button" className="font-semibold">
                Przejdź
                <ChevronRight className="h-4 w-4" aria-hidden="true" />
              </Button>
            </Link>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
