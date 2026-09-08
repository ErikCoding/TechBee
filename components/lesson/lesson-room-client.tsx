'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { LiveKitRoom } from '@livekit/components-react'
import { PhoneCall, PhoneOff, Loader2, AlertTriangle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/lib/auth-context'
import { completeLesson, getLessonById } from '@/services/lessons.service'
import { requestLiveKitToken } from '@/services/livekit.service'
import { isLiveKitConfigured } from '@/lib/livekit-config'
import { canJoinLesson, formatDurationClock, lessonAutoEndAtMs, lessonEndAtMs } from '@/lib/lesson-time'
import { dashboardPathForRole } from '@/lib/utils'
import { LessonRoomStage } from '@/components/lesson/lesson-room-stage'
import type { Lesson } from '@/lib/types'

interface Props {
  lessonId: string
  topic?: string
  participantName?: string
}

type RoomState = 'loading' | 'ready' | 'blocked' | 'disconnected' | 'error' | 'ended'

function allowEarlyJoinForTesting(): boolean {
  if (process.env.NEXT_PUBLIC_ALLOW_EARLY_LESSON_JOIN === 'true') return true
  if (typeof window === 'undefined') return false
  return window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
}

/**
 * Entry point for a lesson's video call — fetches a LiveKit room token
 * scoped to this lesson (see services/livekit.service.ts +
 * app/api/livekit/token/route.ts), then mounts `<LiveKitRoom>` with the
 * actual call UI (LessonRoomStage) inside it. Both the teacher and
 * student land here via the same `/lesson/{id}/room` URL, which is what
 * puts them in the same LiveKit room (see lib/livekit-config.ts).
 */
export function LessonRoomClient({ lessonId, topic, participantName }: Props) {
  const { user } = useAuth()
  const router = useRouter()
  const [state, setState] = useState<RoomState>('loading')
  const [error, setError] = useState<string | null>(null)
  const [lesson, setLesson] = useState<Lesson | null>(null)
  const [connection, setConnection] = useState<{ token: string; url: string } | null>(null)
  const [now, setNow] = useState(Date.now())
  const endedRef = useRef(false)
  const intentionalDisconnectRef = useRef(false)

  useEffect(() => {
    if (!user) return
    let cancelled = false

    async function connect() {
      setState('loading')
      setError(null)
      const currentLesson = await getLessonById(lessonId)
      if (cancelled) return
      if (!currentLesson) {
        setError('Nie znaleziono tej lekcji.')
        setState('error')
        return
      }
      setLesson(currentLesson)

      const joinState = canJoinLesson(currentLesson, Date.now(), { allowEarlyJoin: allowEarlyJoinForTesting() })
      if (!joinState.canJoin) {
        setError(joinState.reason ?? 'Nie można teraz dołączyć do lekcji.')
        setState('blocked')
        return
      }

      const result = await requestLiveKitToken({ lessonId, identity: user!.id, name: user!.name })
      if (cancelled) return
      setConnection(result)
      setState('ready')
    }

    connect().catch((err: unknown) => {
        if (cancelled) return
        setError(err instanceof Error ? err.message : 'Nie udało się dołączyć do lekcji.')
        setState('error')
      })
    return () => {
      cancelled = true
    }
  }, [user, lessonId])

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(timer)
  }, [])

  useEffect(() => {
    if (state !== 'blocked' || !lesson || !user) return
    const joinState = canJoinLesson(lesson, now, { allowEarlyJoin: allowEarlyJoinForTesting() })
    if (!joinState.canJoin) return
    requestLiveKitToken({ lessonId, identity: user.id, name: user.name })
      .then((result) => {
        setConnection(result)
        setState('ready')
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : 'Nie udało się dołączyć do lekcji.')
        setState('error')
      })
  }, [state, lesson, user, now, lessonId])

  function leaveCallTemporarily() {
    intentionalDisconnectRef.current = true
    setState('disconnected')
    setConnection(null)
  }

  function handleDisconnected() {
    setConnection(null)
    if (endedRef.current) return
    if (intentionalDisconnectRef.current) {
      intentionalDisconnectRef.current = false
      return
    }
    setState('disconnected')
  }

  function reconnect() {
    if (!user) return
    setState('loading')
    requestLiveKitToken({ lessonId, identity: user.id, name: user.name })
      .then((result) => {
        setConnection(result)
        setState('ready')
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : 'Nie udało się ponownie dołączyć do lekcji.')
        setState('error')
      })
  }

  function endLessonPermanently() {
    if (endedRef.current) return
    endedRef.current = true
    setState('ended')
    setConnection(null)
    completeLesson(lessonId).catch(() => {})
    setTimeout(() => router.push(dashboardPathForRole(user?.role)), 1200)
  }

  if (!isLiveKitConfigured) {
    return (
      <div className="flex min-h-[calc(100vh-64px)] flex-col items-center justify-center gap-3 px-4 text-center text-white">
        <AlertTriangle className="h-8 w-8 text-primary" aria-hidden="true" />
        <p className="text-lg font-semibold">Wideolekcje nie są jeszcze skonfigurowane</p>
        <p className="max-w-sm text-sm text-white/60">
          Brakuje zmiennych środowiskowych LiveKit (NEXT_PUBLIC_LIVEKIT_URL, LIVEKIT_API_KEY, LIVEKIT_API_SECRET) — zobacz .env.example.
        </p>
      </div>
    )
  }

  if (state === 'ended') {
    return (
      <div className="flex min-h-[calc(100vh-64px)] flex-col items-center justify-center gap-3 px-4 text-center text-white">
        <PhoneOff className="h-10 w-10 text-white/60" aria-hidden="true" />
        <p className="text-lg font-semibold">Lekcja zakończona</p>
        <p className="text-sm text-white/60">Przekierowywanie do panelu…</p>
      </div>
    )
  }

  if (state === 'blocked') {
    const startsAt = lesson ? canJoinLesson(lesson, now).startsAt : undefined
    return (
      <div className="flex min-h-[calc(100vh-64px)] flex-col items-center justify-center gap-3 px-4 text-center text-white">
        <AlertTriangle className="h-8 w-8 text-primary" aria-hidden="true" />
        <p className="text-lg font-semibold">Sala otworzy się 5 minut przed lekcją</p>
        {startsAt && <p className="text-sm text-white/60">Do startu zostało {formatDurationClock(startsAt - now)}.</p>}
        {error && <p className="max-w-sm text-sm text-white/60">{error}</p>}
      </div>
    )
  }

  if (state === 'disconnected') {
    return (
      <div className="flex min-h-[calc(100vh-64px)] flex-col items-center justify-center gap-4 px-4 text-center text-white">
        <PhoneOff className="h-10 w-10 text-white/60" aria-hidden="true" />
        <div>
          <p className="text-lg font-semibold">Połączenie przerwane</p>
          <p className="mt-1 max-w-sm text-sm text-white/60">
            Lekcja nie została zakończona. Możesz wrócić do tej samej sali.
          </p>
        </div>
        <Button onClick={reconnect} className="font-semibold">
          <PhoneCall className="h-4 w-4" aria-hidden="true" />
          Dołącz ponownie
        </Button>
      </div>
    )
  }

  if (state === 'error') {
    return (
      <div className="flex min-h-[calc(100vh-64px)] flex-col items-center justify-center gap-3 px-4 text-center text-white">
        <AlertTriangle className="h-8 w-8 text-red-400" aria-hidden="true" />
        <p className="text-lg font-semibold">Nie udało się dołączyć do lekcji</p>
        {error && <p className="max-w-sm text-sm text-white/60">{error}</p>}
      </div>
    )
  }

  if (state === 'loading' || !connection) {
    return (
      <div className="flex min-h-[calc(100vh-64px)] flex-col items-center justify-center gap-3 px-4 text-center text-white">
        <Loader2 className="h-8 w-8 animate-spin text-primary" aria-hidden="true" />
        <p className="text-sm text-white/60">Łączenie z salą lekcji…</p>
      </div>
    )
  }

  return (
    <LiveKitRoom
      serverUrl={connection.url}
      token={connection.token}
      connect
      audio
      video
      onDisconnected={handleDisconnected}
      onError={(err) => {
        setError(err.message)
        setState('error')
      }}
    >
      <LessonRoomStage
        lessonId={lessonId}
        topic={topic}
        waitingForLabel={participantName}
        scheduledEndAtMs={lesson ? lessonEndAtMs(lesson) ?? undefined : undefined}
        autoEndAtMs={lesson ? lessonAutoEndAtMs(lesson) ?? undefined : undefined}
        onLeave={leaveCallTemporarily}
        onEndLesson={endLessonPermanently}
      />
    </LiveKitRoom>
  )
}
