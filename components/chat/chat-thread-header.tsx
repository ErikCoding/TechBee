'use client'

import Link from 'next/link'
import { ArrowLeft, CalendarDays, Video, ExternalLink } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { roleLabelPl } from '@/lib/utils'
import type { ChatParticipant, Lesson } from '@/lib/types'

interface Props {
  participant: ChatParticipant
  /** The soonest confirmed lesson shared with this person, if any. */
  nextLesson: Lesson | null
  /** The other party's name, as it should appear in the lesson room link. */
  onBack: () => void
}

/**
 * Compact thread header carrying the one piece of context that makes a
 * teaching chat different from generic messaging: the lesson these two
 * actually have together.
 *
 * Before, the header held only an avatar and a name, so "when are we
 * meeting again?" — the most common thing in these threads — had to be
 * answered by leaving chat for a dashboard. The lesson strip appears
 * only when a confirmed lesson exists, so the header stays a single
 * quiet row the rest of the time rather than growing permanent chrome.
 */
export function ChatThreadHeader({ participant, nextLesson, onBack }: Props) {
  return (
    <div className="shrink-0 border-b border-border bg-card">
      <div className="flex items-center gap-3 px-3 py-2.5 sm:px-4">
        <button
          type="button"
          onClick={onBack}
          className="-ml-1 rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground md:hidden"
          aria-label="Wróć do listy rozmów"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        </button>

        <Avatar className="h-9 w-9 shrink-0">
          <AvatarFallback color={participant.avatarColor} className="text-xs">
            {participant.initials}
          </AvatarFallback>
        </Avatar>

        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-foreground">{participant.name}</p>
          <p className="truncate text-[11px] text-muted-foreground">
            {participant.specialty ?? roleLabelPl(participant.role)}
          </p>
        </div>

        {participant.role === 'teacher' && (
          <Link href={`/teacher/${participant.id}`} className="shrink-0">
            <Button variant="ghost" size="sm" className="text-xs">
              <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
              <span className="hidden sm:inline">Profil</span>
            </Button>
          </Link>
        )}
      </div>

      {nextLesson && (
        <div className="flex items-center gap-2 border-t border-border bg-accent/50 px-3 py-2 sm:px-4">
          <CalendarDays className="h-3.5 w-3.5 shrink-0 text-bee-yellow-dark" aria-hidden="true" />
          <p className="min-w-0 flex-1 truncate text-[11px] text-accent-foreground">
            <span className="font-semibold">Najbliższa lekcja:</span> {nextLesson.date}, {nextLesson.time} ·{' '}
            {nextLesson.topic}
          </p>
          <Link
            href={`/lesson/${nextLesson.id}/room?with=${encodeURIComponent(participant.name)}&topic=${encodeURIComponent(nextLesson.topic)}`}
            className="shrink-0"
          >
            <Button size="sm" variant="outline" className="h-7 bg-card text-[11px]">
              <Video className="h-3 w-3" aria-hidden="true" />
              Dołącz
            </Button>
          </Link>
        </div>
      )}
    </div>
  )
}
