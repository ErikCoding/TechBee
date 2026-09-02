'use client'

import { Search, MessageSquareOff, X } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState } from '@/components/ui/empty-state'
import { cn, formatChatTime, roleLabelPl } from '@/lib/utils'
import type { ChatConversation } from '@/lib/types'

interface Props {
  conversations: ChatConversation[] | null
  filtered: ChatConversation[]
  activeId: string | null
  query: string
  onQueryChange: (value: string) => void
  onSelect: (id: string) => void
}

/**
 * The conversation column.
 *
 * Previously every row rendered the same three lines at the same weight
 * — name, role, preview — with a search field that looked like a form
 * input dropped into a panel, and the selected thread marked only by a
 * flat background tint that was easy to lose against the hover state.
 * Rows now lead with the counterparty, keep a fixed timestamp column so
 * the list scans vertically, mark unread with weight rather than another
 * badge, and mark the active thread with a left rail that hover can't
 * imitate.
 */
export function ChatConversationList({
  conversations,
  filtered,
  activeId,
  query,
  onQueryChange,
  onSelect,
}: Props) {
  return (
    <>
      <div className="shrink-0 border-b border-border p-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
          <Input
            value={query}
            onChange={(e) => onQueryChange(e.target.value)}
            placeholder="Szukaj rozmowy…"
            className="h-9 pl-9 pr-8"
            aria-label="Szukaj rozmów"
          />
          {query && (
            <button
              type="button"
              onClick={() => onQueryChange('')}
              aria-label="Wyczyść wyszukiwanie"
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground transition-colors hover:text-foreground"
            >
              <X className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          )}
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {conversations === null ? (
          <div className="flex flex-col gap-4 p-4">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="flex items-center gap-3">
                <Skeleton className="h-10 w-10 rounded-full" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-3 w-1/2" />
                  <Skeleton className="h-2.5 w-3/4" />
                </div>
              </div>
            ))}
          </div>
        ) : filtered.length === 0 && conversations.length > 0 ? (
          <EmptyState
            icon={Search}
            title="Brak wyników"
            description={`Żadna rozmowa nie pasuje do „${query}".`}
            className="py-12"
          />
        ) : conversations.length === 0 ? (
          <EmptyState
            icon={MessageSquareOff}
            title="Brak rozmów"
            description="Napisz do nauczyciela z jego profilu, aby rozpocząć rozmowę."
            className="py-12"
          />
        ) : (
          <ul>
            {filtered.map((c) => {
              const active = activeId === c.id
              const unread = c.unread > 0
              return (
                <li key={c.id}>
                  <button
                    type="button"
                    onClick={() => onSelect(c.id)}
                    aria-current={active ? 'true' : undefined}
                    className={cn(
                      'flex w-full items-start gap-3 border-l-2 px-4 py-3 text-left transition-colors',
                      active
                        ? 'border-l-primary bg-accent/50'
                        : 'border-l-transparent hover:bg-muted/50',
                    )}
                  >
                    <Avatar className="h-10 w-10 shrink-0">
                      {c.participant.photoUrl && <AvatarImage src={c.participant.photoUrl} alt="" />}
                      <AvatarFallback color={c.participant.avatarColor} className="text-xs">
                        {c.participant.initials}
                      </AvatarFallback>
                    </Avatar>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline gap-2">
                        <p className={cn('min-w-0 flex-1 truncate text-sm text-foreground', unread ? 'font-bold' : 'font-medium')}>
                          {c.participant.name}
                        </p>
                        <span className={cn('shrink-0 text-[10px]', unread ? 'font-semibold text-primary' : 'text-muted-foreground')}>
                          {formatChatTime(c.lastMessageAt)}
                        </span>
                      </div>

                      <p className="truncate text-[11px] text-muted-foreground">
                        {c.participant.specialty ?? roleLabelPl(c.participant.role)}
                      </p>

                      <div className="mt-1 flex items-center gap-2">
                        <p className={cn('min-w-0 flex-1 truncate text-xs', unread ? 'text-foreground' : 'text-muted-foreground')}>
                          {c.lastMessage || 'Rozpocznij rozmowę…'}
                        </p>
                        {unread && (
                          <span className="flex h-4.5 min-w-4.5 shrink-0 items-center justify-center rounded-full bg-primary px-1.5 text-[10px] font-bold text-primary-foreground">
                            {c.unread > 9 ? '9+' : c.unread}
                          </span>
                        )}
                      </div>
                    </div>
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </>
  )
}
