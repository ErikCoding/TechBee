'use client'

import Link from 'next/link'
import { MessageSquare, MessagesSquare, Mail } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { DashboardMessagesPreview } from '@/components/dashboard/dashboard-messages-preview'
import { NotificationsPanel } from '@/components/dashboard/notifications-panel'
import type { ChatConversation, Notification } from '@/lib/types'

/**
 * The "Wiadomości" tab shared by the student and teacher dashboards:
 * a small summary strip on top, then conversations (wider) next to
 * notifications. Same two data sources as before — just arranged so the
 * tab reads as one screen instead of two stacked panels.
 */
export function DashboardMessagesTab({
  conversations,
  unread,
  emptyDescription,
  notifications,
}: {
  conversations: ChatConversation[] | null
  unread: number
  emptyDescription: string
  notifications: Notification[]
}) {
  const threads = conversations?.length ?? 0
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 rounded-2xl border border-border bg-card/60 p-4 sm:flex-row sm:items-center sm:p-5">
        <div className="grid flex-1 grid-cols-2 gap-3">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Mail className="h-5 w-5" aria-hidden="true" />
            </span>
            <div>
              <p className="text-xl font-bold leading-tight text-foreground">{unread}</p>
              <p className="text-xs text-muted-foreground">Nieprzeczytane</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-foreground/[0.06] text-muted-foreground">
              <MessagesSquare className="h-5 w-5" aria-hidden="true" />
            </span>
            <div>
              <p className="text-xl font-bold leading-tight text-foreground">{threads}</p>
              <p className="text-xs text-muted-foreground">Rozmowy</p>
            </div>
          </div>
        </div>
        <Link href="/chat" className="sm:shrink-0">
          <Button className="w-full font-semibold sm:w-auto">
            <MessageSquare className="h-4 w-4" aria-hidden="true" />
            Otwórz czat
          </Button>
        </Link>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)] lg:items-start">
        <DashboardMessagesPreview conversations={conversations} unread={unread} emptyDescription={emptyDescription} limit={8} />
        <NotificationsPanel initialNotifications={notifications} />
      </div>
    </div>
  )
}
