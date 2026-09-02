'use client'

import { FileText, FileArchive, Image as ImageIcon, Download, MessageSquare } from 'lucide-react'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Skeleton } from '@/components/ui/skeleton'
import { ReportCardMessage } from '@/components/chat/report-card-message'
import { cn } from '@/lib/utils'
import type { ChatMessage, ChatParticipant, UserRole } from '@/lib/types'

const attachmentIconMap: Record<NonNullable<ChatMessage['attachment']>['kind'], React.ElementType> = {
  pdf: FileText,
  image: ImageIcon,
  zip: FileArchive,
  doc: FileText,
}

interface Props {
  messages: ChatMessage[] | null
  me: ChatParticipant
  participant: ChatParticipant
  viewerRole?: UserRole
}

/** Day bucket for the separators — compares calendar days, not elapsed time. */
function dayKey(ts: number): string {
  const d = new Date(ts)
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`
}

function dayLabel(ts: number): string {
  const d = new Date(ts)
  const today = new Date()
  const yesterday = new Date()
  yesterday.setDate(today.getDate() - 1)

  if (dayKey(ts) === dayKey(today.getTime())) return 'Dzisiaj'
  if (dayKey(ts) === dayKey(yesterday.getTime())) return 'Wczoraj'
  return d.toLocaleDateString('pl-PL', { day: 'numeric', month: 'long', year: d.getFullYear() === today.getFullYear() ? undefined : 'numeric' })
}

function clockTime(ts: number): string {
  return new Date(ts).toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' })
}

/**
 * The message history.
 *
 * Three things were missing and are added here, all presentational:
 * date separators (a thread spanning weeks previously read as one
 * undifferentiated column), sender grouping (each consecutive message
 * from the same person repeated the full bubble treatment and its own
 * timestamp), and an avatar anchoring the other side's runs so a long
 * thread stays readable without relying on colour alone.
 *
 * Report cards keep their existing interactive component — inside a
 * message thread the card *is* the right representation, and its
 * confirm/dispute actions are unchanged.
 */
export function ChatMessageList({ messages, me, participant, viewerRole }: Props) {
  if (messages === null) {
    return (
      <div className="flex flex-col gap-4 px-4 py-4">
        {[0, 1, 2].map((i) => (
          <div key={i} className={cn('flex', i % 2 === 0 ? 'justify-start' : 'justify-end')}>
            <Skeleton className={cn('h-12 rounded-2xl', i % 2 === 0 ? 'w-2/3' : 'w-1/2')} />
          </div>
        ))}
      </div>
    )
  }

  if (messages.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 px-6 py-10 text-center">
        <Avatar className="h-14 w-14">
          <AvatarFallback color={participant.avatarColor}>{participant.initials}</AvatarFallback>
        </Avatar>
        <div>
          <p className="text-sm font-semibold text-foreground">{participant.name}</p>
          <p className="mt-1 max-w-xs text-xs leading-relaxed text-muted-foreground">
            To początek Waszej rozmowy. Napisz, o czym chcesz porozmawiać przed lekcją.
          </p>
        </div>
        <MessageSquare className="h-4 w-4 text-muted-foreground/40" aria-hidden="true" />
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-1 px-4 py-4">
      {messages.map((m, i) => {
        const prev = messages[i - 1]
        const mine = m.senderId === me.id
        const showDaySeparator = !prev || dayKey(prev.createdAt) !== dayKey(m.createdAt)
        // Group a run of messages from the same sender on the same day,
        // unless a report card breaks the run.
        const continuesRun =
          !showDaySeparator &&
          prev !== undefined &&
          prev.senderId === m.senderId &&
          !prev.reportCard &&
          !m.reportCard
        const next = messages[i + 1]
        const endsRun =
          !next ||
          next.senderId !== m.senderId ||
          dayKey(next.createdAt) !== dayKey(m.createdAt) ||
          Boolean(next.reportCard) ||
          Boolean(m.reportCard)

        const AttachmentIcon = m.attachment ? attachmentIconMap[m.attachment.kind] : null

        return (
          <div key={m.id}>
            {showDaySeparator && (
              <div className="flex items-center gap-3 py-3" role="separator">
                <span className="h-px flex-1 bg-border" />
                <span className="shrink-0 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                  {dayLabel(m.createdAt)}
                </span>
                <span className="h-px flex-1 bg-border" />
              </div>
            )}

            {m.reportCard ? (
              <div className={cn('flex py-1.5', mine ? 'justify-end' : 'justify-start')}>
                <ReportCardMessage card={m.reportCard} viewerId={me.id} viewerRole={viewerRole} />
              </div>
            ) : (
              <div
                className={cn(
                  'flex items-end gap-2',
                  mine ? 'justify-end' : 'justify-start',
                  continuesRun ? 'mt-0.5' : 'mt-2',
                )}
              >
                {/* Avatar anchors the other side's run, shown once at its end. */}
                {!mine && (
                  <div className="w-7 shrink-0">
                    {endsRun && (
                      <Avatar className="h-7 w-7">
                        <AvatarFallback color={participant.avatarColor} className="text-[10px]">
                          {participant.initials}
                        </AvatarFallback>
                      </Avatar>
                    )}
                  </div>
                )}

                <div
                  className={cn(
                    'max-w-[80%] px-3.5 py-2 text-sm sm:max-w-[70%]',
                    mine
                      ? 'bg-primary text-primary-foreground'
                      : 'border border-border bg-card text-foreground',
                    // Squared-off inner corner on a run, rounded at its ends —
                    // keeps grouped messages reading as one block.
                    mine
                      ? cn('rounded-2xl rounded-br-md', continuesRun && 'rounded-tr-md')
                      : cn('rounded-2xl rounded-bl-md', continuesRun && 'rounded-tl-md'),
                  )}
                >
                  {m.text && <p className="whitespace-pre-wrap break-words leading-relaxed">{m.text}</p>}

                  {m.attachment && AttachmentIcon && (
                    <div
                      className={cn(
                        'mt-2 flex items-center gap-2 rounded-xl border px-3 py-2',
                        mine ? 'border-primary-foreground/20 bg-primary-foreground/10' : 'border-border bg-muted/50',
                      )}
                    >
                      <AttachmentIcon className="h-4 w-4 shrink-0" aria-hidden="true" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-xs font-medium">{m.attachment.name}</p>
                        <p className="text-[10px] opacity-70">{m.attachment.size}</p>
                      </div>
                      <Download className="h-3.5 w-3.5 shrink-0 opacity-70" aria-hidden="true" />
                    </div>
                  )}

                  {/* One timestamp per run instead of one per message. */}
                  {endsRun && (
                    <p className={cn('mt-1 text-[10px]', mine ? 'text-primary-foreground/60' : 'text-muted-foreground')}>
                      {clockTime(m.createdAt)}
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
