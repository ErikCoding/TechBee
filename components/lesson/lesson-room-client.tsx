'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Mic, MicOff, Video, VideoOff, PhoneOff, MessageSquare, Send, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useAuth } from '@/lib/auth-context'
import { completeLesson } from '@/services/lessons.service'
import { cn, dashboardPathForRole } from '@/lib/utils'

interface Props {
  lessonId: string
  topic?: string
  participantName?: string
}

type CallState = 'connecting' | 'connected' | 'ended'

interface RoomMessage {
  id: string
  author: 'me' | 'them'
  text: string
}

/**
 * A provisional, mock "join lesson" room — no real audio/video is
 * transmitted. It demonstrates the intended UX (waiting room →
 * connected call → in-call chat → end call) so the flow can be
 * validated before wiring up a real WebRTC/media provider.
 */
export function LessonRoomClient({ lessonId, topic, participantName }: Props) {
  const { user } = useAuth()
  const router = useRouter()
  const [callState, setCallState] = useState<CallState>('connecting')
  const [micOn, setMicOn] = useState(true)
  const [camOn, setCamOn] = useState(true)
  const [chatOpen, setChatOpen] = useState(false)
  const [draft, setDraft] = useState('')
  const [messages, setMessages] = useState<RoomMessage[]>([
    { id: 'sys-1', author: 'them', text: `Cześć! Za chwilę zaczynamy — ${topic ? `dziś: ${topic}` : 'przygotuj materiały do dzisiejszej lekcji'}.` },
  ])
  const [elapsed, setElapsed] = useState(0)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const other = participantName ?? 'Druga strona'

  useEffect(() => {
    const t = setTimeout(() => setCallState('connected'), 1600)
    return () => clearTimeout(t)
  }, [])

  useEffect(() => {
    if (callState !== 'connected') return
    timerRef.current = setInterval(() => setElapsed((s) => s + 1), 1000)
    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [callState])

  function formatElapsed(s: number) {
    const m = Math.floor(s / 60).toString().padStart(2, '0')
    const sec = (s % 60).toString().padStart(2, '0')
    return `${m}:${sec}`
  }

  function handleEndCall() {
    setCallState('ended')
    if (timerRef.current) clearInterval(timerRef.current)
    // Ending the call is what actually completes the lesson — this is the
    // one moment the simulated payment moves from student to teacher (see
    // services/lessons.service.ts completeLesson). Best-effort: a failed
    // write here shouldn't trap the person in the call room.
    completeLesson(lessonId).catch(() => {})
    setTimeout(() => router.push(dashboardPathForRole(user?.role)), 1200)
  }

  function sendMessage() {
    if (!draft.trim()) return
    setMessages((prev) => [...prev, { id: `m-${Date.now()}`, author: 'me', text: draft.trim() }])
    setDraft('')
  }

  if (callState === 'ended') {
    return (
      <div className="flex min-h-[calc(100vh-64px)] flex-col items-center justify-center gap-3 px-4 text-center text-white">
        <PhoneOff className="h-10 w-10 text-white/60" aria-hidden="true" />
        <p className="text-lg font-semibold">Lekcja zakończona</p>
        <p className="text-sm text-white/60">Czas trwania: {formatElapsed(elapsed)} · Przekierowywanie do panelu…</p>
      </div>
    )
  }

  return (
    <div className="flex min-h-[calc(100vh-64px)] flex-col text-white">
      {/* Status bar */}
      <div className="flex items-center justify-between px-4 py-3 text-sm">
        <div className="flex items-center gap-2">
          <span className={cn('h-2 w-2 rounded-full', callState === 'connecting' ? 'animate-pulse bg-yellow-400' : 'bg-emerald-400')} aria-hidden="true" />
          {callState === 'connecting' ? 'Łączenie…' : `Połączono · ${formatElapsed(elapsed)}`}
        </div>
        <div className="text-white/50">Sala lekcji #{lessonId.slice(-6)}</div>
      </div>

      {/* Video stage */}
      <div className="relative mx-4 mb-4 flex-1 overflow-hidden rounded-2xl bg-[#151515]">
        <div className="flex h-full min-h-[360px] flex-col items-center justify-center gap-3">
          <div className="flex h-24 w-24 items-center justify-center rounded-full bg-[#F4B400] text-3xl font-bold text-[#0A0A0A]">
            {other.slice(0, 2).toUpperCase()}
          </div>
          <p className="text-sm text-white/70">
            {callState === 'connecting' ? `Łączenie z ${other}…` : other}
          </p>
          {topic && <p className="max-w-md text-center text-xs text-white/40">{topic}</p>}
        </div>

        {/* Self preview tile */}
        <div className="absolute bottom-4 right-4 flex h-24 w-36 items-center justify-center rounded-xl bg-[#222] shadow-lg ring-1 ring-white/10 sm:h-28 sm:w-44">
          {camOn ? (
            <div className="flex h-10 w-10 items-center justify-center rounded-full text-sm font-bold text-white" style={{ backgroundColor: user?.avatarColor ?? '#3B82F6' }}>
              {user?.initials ?? 'JA'}
            </div>
          ) : (
            <VideoOff className="h-5 w-5 text-white/40" aria-hidden="true" />
          )}
          <span className="absolute bottom-1.5 left-2 text-[10px] text-white/60">Ty</span>
        </div>

        {/* Chat drawer */}
        {chatOpen && (
          <div className="absolute inset-y-0 right-0 flex w-full max-w-xs flex-col border-l border-white/10 bg-[#111]/95 backdrop-blur">
            <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
              <p className="text-sm font-semibold">Czat lekcji</p>
              <button type="button" onClick={() => setChatOpen(false)} className="text-white/50 hover:text-white" aria-label="Zamknij czat">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="flex-1 space-y-2 overflow-y-auto px-4 py-3">
              {messages.map((m) => (
                <div key={m.id} className={cn('flex', m.author === 'me' ? 'justify-end' : 'justify-start')}>
                  <div className={cn('max-w-[85%] rounded-xl px-3 py-1.5 text-xs', m.author === 'me' ? 'bg-[#F4B400] text-[#0A0A0A]' : 'bg-white/10 text-white')}>
                    {m.text}
                  </div>
                </div>
              ))}
            </div>
            <form onSubmit={(e) => { e.preventDefault(); sendMessage() }} className="flex items-center gap-2 border-t border-white/10 p-3">
              <Input
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder="Napisz na czacie..."
                className="border-white/15 bg-white/5 text-white placeholder:text-white/40"
              />
              <Button type="submit" size="icon" className="shrink-0 bg-[#F4B400] text-[#0A0A0A] hover:bg-[#FBBF24]" aria-label="Wyślij">
                <Send className="h-4 w-4" />
              </Button>
            </form>
          </div>
        )}
      </div>

      {/* Controls */}
      <div className="flex items-center justify-center gap-3 pb-8">
        <button
          type="button"
          onClick={() => setMicOn((v) => !v)}
          className={cn('flex h-12 w-12 items-center justify-center rounded-full transition-colors', micOn ? 'bg-white/10 hover:bg-white/20' : 'bg-white text-[#0A0A0A]')}
          aria-label={micOn ? 'Wyłącz mikrofon' : 'Włącz mikrofon'}
        >
          {micOn ? <Mic className="h-5 w-5" /> : <MicOff className="h-5 w-5" />}
        </button>
        <button
          type="button"
          onClick={() => setCamOn((v) => !v)}
          className={cn('flex h-12 w-12 items-center justify-center rounded-full transition-colors', camOn ? 'bg-white/10 hover:bg-white/20' : 'bg-white text-[#0A0A0A]')}
          aria-label={camOn ? 'Wyłącz kamerę' : 'Włącz kamerę'}
        >
          {camOn ? <Video className="h-5 w-5" /> : <VideoOff className="h-5 w-5" />}
        </button>
        <button
          type="button"
          onClick={() => setChatOpen((v) => !v)}
          className={cn('flex h-12 w-12 items-center justify-center rounded-full transition-colors', chatOpen ? 'bg-white text-[#0A0A0A]' : 'bg-white/10 hover:bg-white/20')}
          aria-label="Czat lekcji"
        >
          <MessageSquare className="h-5 w-5" />
        </button>
        <button
          type="button"
          onClick={handleEndCall}
          className="flex h-12 w-12 items-center justify-center rounded-full bg-red-500 transition-colors hover:bg-red-600"
          aria-label="Zakończ lekcję"
        >
          <PhoneOff className="h-5 w-5" />
        </button>
      </div>

      <p className="pb-4 text-center text-[11px] text-white/30">
        To jest prowizoryczna symulacja — bez rzeczywistego przesyłania audio/wideo.
      </p>
    </div>
  )
}
