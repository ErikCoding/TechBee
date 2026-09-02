'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { MessageSquare } from 'lucide-react'
import { useAuth } from '@/lib/auth-context'
import { subscribeToConversations } from '@/services/chat.service'
import { cn } from '@/lib/utils'

interface Props {
  className?: string
}

/**
 * Persistent, always-visible messages entry point (not buried inside the
 * account dropdown) with a live unread-count badge — shown in the navbar
 * whenever someone is signed in, on both desktop and mobile.
 */
export function ChatNavBadge({ className }: Props) {
  const { user } = useAuth()
  const [unread, setUnread] = useState(0)

  useEffect(() => {
    if (!user) return
    const unsubscribe = subscribeToConversations(user.id, (list) => {
      setUnread(list.reduce((sum, c) => sum + c.unread, 0))
    })
    return unsubscribe
  }, [user])

  if (!user) return null

  return (
    <Link
      href="/chat"
      aria-label={unread > 0 ? `Wiadomości — ${unread} nieprzeczytanych` : 'Wiadomości'}
      className={cn(
        'relative flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground',
        className,
      )}
    >
      <MessageSquare className="h-4 w-4" aria-hidden="true" />
      {unread > 0 && (
        <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold text-primary-foreground">
          {unread > 9 ? '9+' : unread}
        </span>
      )}
    </Link>
  )
}
