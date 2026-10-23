'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { MessagesSquare } from 'lucide-react'
import { ChatConversationList } from '@/components/chat/chat-conversation-list'
import { ChatThreadHeader } from '@/components/chat/chat-thread-header'
import { ChatMessageList } from '@/components/chat/chat-message-list'
import { ChatComposer } from '@/components/chat/chat-composer'
import { useAuth } from '@/lib/auth-context'
import {
  editMessage, markConversationRead, sendMessage, subscribeToConversations, subscribeToMessages, toParticipant,
} from '@/services/chat.service'
import { getParentLessons, getStudentLessons, getTeacherLessons } from '@/services/lessons.service'
import { cn } from '@/lib/utils'
import { prepareChatAttachment } from '@/services/chat-attachments.service'
import type { ChatConversation, ChatMessage, ChatParticipant, Lesson } from '@/lib/types'

/**
 * Messaging surface.
 *
 * The previous version was a single bordered box holding two columns,
 * with mobile handled by hiding one of them — which left a phone with a
 * short, letterboxed panel floating inside a scrolling page, a composer
 * that moved with the document, and a page heading above it all
 * competing with the thread. It read as a widget embedded in a page
 * rather than a messaging app.
 *
 * Now the two panes are a genuine master/detail: on desktop a fixed
 * conversation rail beside a thread; on mobile two full-height screens
 * with back navigation, where only the message list scrolls and the
 * composer stays pinned. The lesson context strip in the header and the
 * date/grouping treatment in the list are the parts that make it read
 * as Runbee rather than as a generic chat clone.
 *
 * Every data path is unchanged: the same subscribeToConversations /
 * subscribeToMessages live subscriptions, the same markConversationRead
 * on open, the same sendMessage for text and attachments, and report
 * cards still rendered by their existing interactive component.
 */
export function ChatClient() {
  const { user } = useAuth()
  const router = useRouter()
  const searchParams = useSearchParams()
  const preselect = searchParams.get('with')

  const [conversations, setConversations] = useState<ChatConversation[] | null>(null)
  const [messages, setMessages] = useState<ChatMessage[] | null>(null)
  const [activeId, setActiveId] = useState<string | null>(preselect)
  const [draft, setDraft] = useState('')
  const [query, setQuery] = useState('')
  const [mobileShowThread, setMobileShowThread] = useState(Boolean(preselect))
  const [myLessons, setMyLessons] = useState<Lesson[]>([])
  const [uploadingAttachment, setUploadingAttachment] = useState(false)
  const [composerError, setComposerError] = useState<string | null>(null)

  const scrollRef = useRef<HTMLDivElement>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  const nearBottomRef = useRef(true)
  const lastActiveIdRef = useRef<string | null>(null)
  const prevMessageCountRef = useRef(0)

  const me: ChatParticipant | null = user ? toParticipant(user) : null

  // Fits the shell to what is *actually* visible. The CSS fallback heights
  // (dvh/vh minus magic numbers) drift from the real page chrome, and on
  // phones dvh ignores the on-screen keyboard — which is what clipped the
  // composer. visualViewport tracks the keyboard and browser toolbars.
  const shellRef = useRef<HTMLDivElement>(null)
  const [shellHeight, setShellHeight] = useState<number | null>(null)
  useEffect(() => {
    const el = shellRef.current
    if (!el) return
    const vv = window.visualViewport
    function measure() {
      if (!el) return
      const top = el.getBoundingClientRect().top
      const visibleTop = vv?.offsetTop ?? 0
      const visibleHeight = vv?.height ?? window.innerHeight
      const isDesktop = window.matchMedia('(min-width: 768px)').matches
      const bottomGap = isDesktop ? 24 : 0 // md:py-6 bottom padding on the page wrapper
      const next = Math.floor(visibleTop + visibleHeight - top - bottomGap)
      setShellHeight(Math.max(next, 320))
    }
    measure()
    window.addEventListener('resize', measure)
    window.addEventListener('orientationchange', measure)
    vv?.addEventListener('resize', measure)
    vv?.addEventListener('scroll', measure)
    return () => {
      window.removeEventListener('resize', measure)
      window.removeEventListener('orientationchange', measure)
      vv?.removeEventListener('resize', measure)
      vv?.removeEventListener('scroll', measure)
    }
    // The shell only mounts once the user is known.
  }, [Boolean(me)])

  // Keep the latest message in view when the shell resizes (keyboard open/close).
  useEffect(() => {
    if (shellHeight && nearBottomRef.current) scrollThreadToBottom(false)
  }, [shellHeight])

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
      setMessages(null)
      return
    }
    setMessages(null)
    const unsubscribe = subscribeToMessages(activeId, setMessages)
    return unsubscribe
  }, [activeId])

  // The viewer's own lessons, used only to show "your next lesson with
  // this person" in the thread header. Read-only, and scoped by the same
  // role-specific service call each dashboard already uses.
  useEffect(() => {
    if (!user) return
    let cancelled = false
    const fetcher =
      user.role === 'teacher'
        ? getTeacherLessons(user.id, user.name)
        : user.role === 'parent'
          ? getParentLessons(user.id)
          : getStudentLessons(user.id)
    fetcher.then((list) => { if (!cancelled) setMyLessons(list) })
    return () => { cancelled = true }
  }, [user])

  // Marks the open thread as read — both when first opened and whenever a
  // new message lands while it's still open.
  useEffect(() => {
    if (!activeId || !me) return
    markConversationRead(activeId, me.id)
  }, [activeId, messages?.length, me?.id])

  // Auto-scroll: instantly when switching threads, smoothly when a new
  // message arrives while already near the bottom (or it's your own).
  useEffect(() => {
    if (!messages || messages.length === 0) return
    const threadChanged = lastActiveIdRef.current !== activeId
    const grew = messages.length > prevMessageCountRef.current
    lastActiveIdRef.current = activeId
    prevMessageCountRef.current = messages.length

    const lastMessage = messages[messages.length - 1]
    const isMine = lastMessage.senderId === me?.id

    if (threadChanged) {
      scrollThreadToBottom(false)
      nearBottomRef.current = true
    } else if (grew && (nearBottomRef.current || isMine)) {
      scrollThreadToBottom(true)
    }
  }, [messages, activeId, me?.id])

  // Scrolls only the thread's own scroller. `scrollIntoView` also scrolls every
  // ancestor — including the overflow-hidden shell, which shoved the whole
  // conversation rail partly off to the left.
  function scrollThreadToBottom(smooth: boolean) {
    const el = scrollRef.current
    if (!el) return
    el.scrollTo({ top: el.scrollHeight, behavior: smooth ? 'smooth' : 'auto' })
  }

  function handleThreadScroll() {
    const el = scrollRef.current
    if (!el) return
    nearBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 120
  }

  const active = conversations?.find((c) => c.id === activeId) ?? null

  const filteredConversations = useMemo(() => {
    if (!conversations) return []
    if (!query.trim()) return conversations
    const q = query.toLowerCase()
    return conversations.filter(
      (c) =>
        c.participant.name.toLowerCase().includes(q) ||
        (c.participant.specialty ?? '').toLowerCase().includes(q),
    )
  }, [conversations, query])

  /** The soonest confirmed lesson shared with whoever is on the other side of this thread. */
  const nextLessonWithParticipant = useMemo(() => {
    if (!active) return null
    const otherId = active.participant.id
    return (
      myLessons.find(
        (l) => l.status === 'upcoming' && (l.teacherId === otherId || l.studentId === otherId),
      ) ?? null
    )
  }, [active, myLessons])

  function selectConversation(id: string) {
    setActiveId(id)
    setMobileShowThread(true)
    router.replace(`/chat?with=${id}`, { scroll: false })
  }

  async function handleSend(attachment?: ChatMessage['attachment']) {
    if (!active || !me || (!draft.trim() && !attachment)) return
    setComposerError(null)
    const text = draft.trim()
    setDraft('')
    await sendMessage(active.id, me, text, attachment)
  }

  async function handleEdit(messageId: string, text: string) {
    if (!active || !me) return
    await editMessage(active.id, messageId, me, text)
  }

  async function handleAttach(file: File) {
    if (!active || !me) return
    setUploadingAttachment(true)
    setComposerError(null)
    try {
      const attachment = await prepareChatAttachment(active.id, me.id, file)
      await handleSend(attachment)
    } catch (err) {
      setComposerError(err instanceof Error ? err.message : 'Nie udało się wysłać załącznika.')
    } finally {
      setUploadingAttachment(false)
    }
  }

  if (!me) return null

  return (
    /*
      Height is owned here rather than by the page: the shell fills the
      viewport below the navbar on mobile so the thread behaves like a
      screen, and settles into a fixed workspace height from `md` up.
      `min-h-0` on every nested flex child is required — without it a long
      thread grows the container instead of scrolling inside it, which is
      what used to push the composer off-screen.
    */
    <div ref={shellRef} style={shellHeight ? { height: shellHeight } : undefined} className="grid h-[calc(100dvh-3.5rem)] min-h-0 grid-cols-1 overflow-hidden rounded-none border-border bg-card md:h-[calc(100vh-13rem)] md:min-h-[540px] md:grid-cols-[300px_minmax(0,1fr)] md:rounded-2xl md:border lg:grid-cols-[340px_minmax(0,1fr)]">
      {/* ── Conversation rail ── */}
      <div
        className={cn(
          'flex min-h-0 min-w-0 flex-col overflow-x-hidden border-border md:border-r',
          mobileShowThread && 'hidden md:flex',
        )}
      >
        <ChatConversationList
          conversations={conversations}
          filtered={filteredConversations}
          activeId={activeId}
          query={query}
          onQueryChange={setQuery}
          onSelect={selectConversation}
        />
      </div>

      {/* ── Thread ── */}
      <div className={cn('flex min-h-0 min-w-0 flex-col bg-muted/20', !mobileShowThread && 'hidden md:flex')}>
        {active ? (
          <>
            <ChatThreadHeader
              participant={active.participant}
              nextLesson={nextLessonWithParticipant}
              onBack={() => setMobileShowThread(false)}
            />

            <div ref={scrollRef} onScroll={handleThreadScroll} className="min-h-0 flex-1 overflow-y-auto">
              <ChatMessageList
                messages={messages}
                me={me}
                participant={active.participant}
                viewerRole={user?.role}
                onEdit={handleEdit}
              />
              <div ref={bottomRef} />
            </div>

            <ChatComposer
              value={draft}
              onChange={setDraft}
              onSend={() => handleSend()}
              onAttach={handleAttach}
              uploading={uploadingAttachment}
              error={composerError}
            />
          </>
        ) : (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 p-8 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-muted">
              <MessagesSquare className="h-6 w-6 text-muted-foreground/60" aria-hidden="true" />
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground">Wybierz rozmowę</p>
              <p className="mt-1 max-w-xs text-xs text-muted-foreground">
                Kliknij rozmowę po lewej, aby zobaczyć wiadomości.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
