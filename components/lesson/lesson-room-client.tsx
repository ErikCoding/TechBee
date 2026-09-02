'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { LiveKitRoom } from '@livekit/components-react'
import { PhoneOff, Loader2, AlertTriangle } from 'lucide-react'
import { useAuth } from '@/lib/auth-context'
import { completeLesson } from '@/services/lessons.service'
import { requestLiveKitToken } from '@/services/livekit.service'
import { isLiveKitConfigured } from '@/lib/livekit-config'
import { dashboardPathForRole } from '@/lib/utils'
import { LessonRoomStage } from '@/components/lesson/lesson-room-stage'

interface Props {
  lessonId: string
  topic?: string
  participantName?: string
}

type RoomState = 'loading' | 'ready' | 'error' | 'ended'

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
  const [connection, setConnection] = useState<{ token: string; url: string } | null>(null)
  const endedRef = useRef(false)

  useEffect(() => {
    if (!user) return
    let cancelled = false
    requestLiveKitToken({ lessonId, identity: user.id, name: user.name })
      .then((result) => {
        if (cancelled) return
        setConnection(result)
        setState('ready')
      })
      .catch((err: unknown) => {
        if (cancelled) return
        setError(err instanceof Error ? err.message : 'Nie udało się dołączyć do lekcji.')
        setState('error')
      })
    return () => {
      cancelled = true
    }
  }, [user, lessonId])

  // Both an explicit "leave" click and an unexpected disconnect (network
  // drop, tab closed elsewhere) route through here — guarded so the
  // lesson-completion side effect only ever runs once.
  function endCallOnce() {
    if (endedRef.current) return
    endedRef.current = true
    setState('ended')
    // Ending the call is what actually completes the lesson — this is the
    // one moment the simulated payment moves from student to teacher (see
    // services/lessons.service.ts completeLesson). Best-effort: a failed
    // write here shouldn't trap the person in the call room.
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
      onDisconnected={endCallOnce}
      onError={(err) => {
        setError(err.message)
        setState('error')
      }}
    >
      <LessonRoomStage lessonId={lessonId} topic={topic} waitingForLabel={participantName} onLeave={endCallOnce} />
    </LiveKitRoom>
  )
}
