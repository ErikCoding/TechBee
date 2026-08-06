'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Search, Send, Paperclip, FileText, FileArchive, Image as ImageIcon, File as FileIcon, ArrowLeft, Download, MessageSquareOff } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/lib/auth-context'
import { getOrCreateConversation, markConversationRead, sendMessage, subscribeToConversations, subscribeToMessages, toParticipant } from '@/services/chat.service'
import { cn } from '@/lib/utils'
import type { ChatConversation, ChatMessage, ChatParticipant } from '@/lib/types'

const attachmentIconMap: Record<NonNullable<ChatMessage['attachment']>['kind'], React.ElementType> = {
  pdf: FileText,
  image: ImageIcon,
  zip: FileArchive,
  doc: FileText,
}

export function ChatClient() {
  const { user } = useAuth()
  const router = useRouter()
  const searchParams = useSearchParams()
  const preselect = searchParams.get('with')

  const [conversations, setConversations] = useState<ChatConversation[]>([])
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [activeId, setActiveId] = useState<string | null>(preselect)
  const [draft, setDraft] = useState('')
  const [query, setQuery] = useState('')
  const [mobileShowThread, setMobileShowThread] = useState(Boolean(preselect))
  const fileInputRef = useRef<HTMLInputElement>(null)

  const me: ChatParticipant | null = user ? toParticipant(user) : null

  // Live conversation list for the signed-in user.
  useEffect(() => {
    if (!me) return
    const unsubscribe = subscribeToConversations(me.id, setConversations)
    return unsubscribe
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [me?.id])

  // Live messages for whichever thread is open.
  useEffect(() => {
    if (!activeId) {
      setMessages([])
      return
    }
    const unsubscribe = subscribeToMessages(activeId, setMessages)
    if (me) markConversationRead(activeId, me.id)
    return unsubscribe
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeId])

  const active = conversations.find((c) => c.id === activeId) ?? null

  const filteredConversations = useMemo(() => {
    if (!query.trim()) return conversations
    const q = query.toLowerCase()
    return conversations.filter((c) => c.participant.name.toLowerCase().includes(q) || (c.participant.specialty ?? '').toLowerCase().includes(q))
  }, [conversations, query])

  function selectConversation(id: string) {
    setActiveId(id)
    setMobileShowThread(true)
    router.replace(`/chat?with=${id}`, { scroll: false })
  }

  async function handleSend(attachment?: ChatMessage['attachment']) {
    if (!active || !me || (!draft.trim() && !attachment)) return
    const text = draft.trim()
    setDraft('')
    await sendMessage(active.id, me, text, attachment)
  }

  function handleAttach(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const ext = file.name.split('.').pop()?.toLowerCase() ?? ''
    const kind: NonNullable<ChatMessage['attachment']>['kind'] =
      ['png', 'jpg', 'jpeg', 'gif', 'webp'].includes(ext) ? 'image' :
      ext === 'pdf' ? 'pdf' :
      ext === 'zip' ? 'zip' : 'doc'
    handleSend({ name: file.name, size: `${(file.size / 1024).toFixed(0)} KB`, kind })
    e.target.value = ''
  }

  if (!me) return null

  return (
    <div className="grid h-[calc(100vh-220px)] min-h-[520px] grid-cols-1 overflow-hidden rounded-2xl border border-border bg-card md:grid-cols-[320px_1fr]">
      {/* ── Conversation list ── */}
      <div className={cn('flex flex-col border-border md:border-r', mobileShowThread && 'hidden md:flex')}>
        <div className="border-b border-border p-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Szukaj rozmów..."
              className="pl-9"
              aria-label="Szukaj rozmów"
            />
          </div>
        </div>
        <div className="flex-1 overflow-y-auto">
          {filteredConversations.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => selectConversation(c.id)}
              className={cn(
                'flex w-full items-start gap-3 border-b border-border/60 px-4 py-3 text-left transition-colors hover:bg-muted/50',
                active?.id === c.id && 'bg-muted',
              )}
            >
              <div
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white"
                style={{ backgroundColor: c.participant.avatarColor }}
                aria-hidden="true"
              >
                {c.participant.initials}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <p className="truncate text-sm font-semibold text-foreground">{c.participant.name}</p>
                  <span className="shrink-0 text-[11px] text-muted-foreground">{c.lastMessageTime}</span>
                </div>
                <p className="truncate text-xs text-muted-foreground">{c.participant.specialty ?? (c.participant.role === 'teacher' ? 'Nauczyciel' : 'Uczeń')}</p>
                <p className="mt-0.5 truncate text-xs text-muted-foreground">{c.lastMessage || 'Rozpocznij rozmowę…'}</p>
              </div>
              {c.unread > 0 && (
                <span className="mt-1 flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-[#F4B400] px-1 text-[10px] font-bold text-[#0A0A0A]">
                  {c.unread}
                </span>
              )}
            </button>
          ))}
          {filteredConversations.length === 0 && conversations.length > 0 && (
            <p className="p-6 text-center text-sm text-muted-foreground">Brak rozmów pasujących do wyszukiwania.</p>
          )}
          {conversations.length === 0 && (
            <div className="flex flex-col items-center gap-2 p-8 text-center">
              <MessageSquareOff className="h-8 w-8 text-muted-foreground/40" aria-hidden="true" />
              <p className="text-sm text-muted-foreground">Brak rozmów. Napisz do nauczyciela z jego profilu, aby zacząć.</p>
            </div>
          )}
        </div>
      </div>

      {/* ── Thread ── */}
      <div className={cn('flex flex-col', !mobileShowThread && 'hidden md:flex')}>
        {active ? (
          <>
            <div className="flex items-center gap-3 border-b border-border px-4 py-3">
              <button
                type="button"
                onClick={() => setMobileShowThread(false)}
                className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted md:hidden"
                aria-label="Wróć do listy rozmów"
              >
                <ArrowLeft className="h-4 w-4" />
              </button>
              <div
                className="flex h-9 w-9 items-center justify-center rounded-full text-xs font-bold text-white"
                style={{ backgroundColor: active.participant.avatarColor }}
                aria-hidden="true"
              >
                {active.participant.initials}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-foreground">{active.participant.name}</p>
                <p className="text-xs text-muted-foreground">
                  {active.participant.specialty ?? (active.participant.role === 'teacher' ? 'Nauczyciel' : 'Uczeń')}
                </p>
              </div>
            </div>

            <div className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
              {messages.length === 0 && (
                <p className="pt-8 text-center text-sm text-muted-foreground">Napisz pierwszą wiadomość, aby rozpocząć rozmowę.</p>
              )}
              {messages.map((m) => {
                const mine = m.senderId === me.id
                const AttachmentIcon = m.attachment ? attachmentIconMap[m.attachment.kind] : null
                return (
                  <div key={m.id} className={cn('flex animate-fade-in-up', mine ? 'justify-end' : 'justify-start')}>
                    <div className={cn('max-w-[78%] rounded-2xl px-4 py-2.5 text-sm', mine ? 'bg-[#F4B400] text-[#0A0A0A]' : 'bg-muted text-foreground')}>
                      {m.text && <p className="leading-relaxed">{m.text}</p>}
                      {m.attachment && AttachmentIcon && (
                        <div className={cn('mt-2 flex items-center gap-2 rounded-xl border px-3 py-2', mine ? 'border-[#0A0A0A]/15 bg-[#0A0A0A]/5' : 'border-border bg-card')}>
                          <AttachmentIcon className="h-4 w-4 shrink-0" aria-hidden="true" />
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-xs font-medium">{m.attachment.name}</p>
                            <p className="text-[11px] opacity-70">{m.attachment.size}</p>
                          </div>
                          <Download className="h-3.5 w-3.5 shrink-0 opacity-70" aria-hidden="true" />
                        </div>
                      )}
                      <p className={cn('mt-1 text-[10px]', mine ? 'text-[#0A0A0A]/60' : 'text-muted-foreground')}>{m.time}</p>
                    </div>
                  </div>
                )
              })}
            </div>

            <form
              onSubmit={(e) => { e.preventDefault(); handleSend() }}
              className="flex items-center gap-2 border-t border-border p-3"
            >
              <input ref={fileInputRef} type="file" className="hidden" onChange={handleAttach} />
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="shrink-0"
                onClick={() => fileInputRef.current?.click()}
                aria-label="Dodaj załącznik"
              >
                <Paperclip className="h-4 w-4" />
              </Button>
              <Input
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder="Napisz wiadomość..."
                className="flex-1"
                aria-label="Treść wiadomości"
              />
              <Button type="submit" className="shrink-0 bg-[#F4B400] text-[#0A0A0A] hover:bg-[#FBBF24]" aria-label="Wyślij wiadomość">
                <Send className="h-4 w-4" />
              </Button>
            </form>
          </>
        ) : (
          <div className="flex flex-1 flex-col items-center justify-center gap-2 p-8 text-center">
            <FileIcon className="h-8 w-8 text-muted-foreground/40" aria-hidden="true" />
            <p className="text-sm text-muted-foreground">Wybierz rozmowę, aby zobaczyć wiadomości.</p>
          </div>
        )}
      </div>
    </div>
  )
}
