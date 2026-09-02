'use client'

import Link from 'next/link'
import { MessageSquare, MessageSquareOff } from 'lucide-react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState } from '@/components/ui/empty-state'
import { Panel, PanelFooterLink } from '@/components/dashboard/dashboard-primitives'
import { cn, formatChatTime } from '@/lib/utils'
import type { ChatConversation } from '@/lib/types'

interface Props {
  /** `null` while the live subscription hasn't delivered its first snapshot yet. */
  conversations: ChatConversation[] | null
  unread: number
  /** Wording differs per role — a teacher's threads are with students, a student's with teachers. */
  emptyDescription: string
}

/**
 * Conversation preview shared by every dashboard. Messages used to be
 * reachable only through a 36px navbar icon and a "Szybkie linki" row,
 * so nobody could tell from their dashboard whether the other side had
 * replied. Unread threads sort to the top; a row deep-links straight
 * into that thread rather than the chat index.
 */
export function DashboardMessagesPreview({ conversations, unread, emptyDescription }: Props) {
  const sorted = conversations
    ? [...conversations]
        .sort((a, b) => (b.unread > 0 ? 1 : 0) - (a.unread > 0 ? 1 : 0) || b.lastMessageAt - a.lastMessageAt)
        .slice(0, 4)
    : null

  return (
    <Panel icon={MessageSquare} title="Wiadomości" count={unread} bodyClassName="bg-card">
      {sorted === null ? (
        <div className="flex flex-col gap-3 p-4">
          {[0, 1, 2].map((i) => (
            <div key={i} className="flex items-center gap-3">
              <Skeleton className="h-9 w-9 rounded-full" />
              <div className="flex-1 space-y-1.5">
                <Skeleton className="h-3 w-1/3" />
                <Skeleton className="h-2.5 w-2/3" />
              </div>
            </div>
          ))}
        </div>
      ) : sorted.length === 0 ? (
        <EmptyState icon={MessageSquareOff} title="Brak rozmów" description={emptyDescription} className="py-8" />
      ) : (
        <>
          <ul className="flex flex-col divide-y divide-border">
            {sorted.map((c) => (
              <li key={c.id}>
                <Link
                  href={`/chat?with=${c.id}`}
                  className="flex items-center gap-3 px-5 py-3 transition-colors hover:bg-muted/40"
                >
                  <Avatar className="h-9 w-9 shrink-0">
                    {c.participant.photoUrl && <AvatarImage src={c.participant.photoUrl} alt="" />}
                    <AvatarFallback color={c.participant.avatarColor} className="text-[11px]">
                      {c.participant.initials}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between gap-2">
                      <p className={cn('truncate text-xs text-foreground', c.unread > 0 ? 'font-bold' : 'font-medium')}>
                        {c.participant.name}
                      </p>
                      <span className="shrink-0 text-[10px] text-muted-foreground">{formatChatTime(c.lastMessageAt)}</span>
                    </div>
                    <p className={cn('truncate text-[11px]', c.unread > 0 ? 'text-foreground/80' : 'text-muted-foreground')}>
                      {c.lastMessage || 'Rozpocznij rozmowę…'}
                    </p>
                  </div>
                  {c.unread > 0 && (
                    <span className="h-2 w-2 shrink-0 rounded-full bg-primary" aria-label={`${c.unread} nieprzeczytanych`} />
                  )}
                </Link>
              </li>
            ))}
          </ul>
          <PanelFooterLink href="/chat">Wszystkie rozmowy</PanelFooterLink>
        </>
      )}
    </Panel>
  )
}
