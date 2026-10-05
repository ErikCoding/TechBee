'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { LiveKitRoom } from '@livekit/components-react'
import type { DisconnectReason, MediaDeviceFailure } from 'livekit-client'
import { AlertTriangle, Loader2, PhoneCall, PhoneOff } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/lib/auth-context'
import { isLiveKitConfigured } from '@/lib/livekit-config'
import { postLiveKitDiagnosticEvent, type LiveKitDisconnectSource } from '@/lib/livekit-diagnostics'
import { LessonRoomStage } from '@/components/lesson/lesson-room-stage'

interface LiveKitTestConnection {
  token: string
  url: string
  roomId: string
  expiresAt: number
}

interface Props {
  connection: LiveKitTestConnection
  returnHref: string
}

type TestRoomState = 'ready' | 'disconnected' | 'ended' | 'error'

function createClientSessionId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID()
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
}

function formatExpiry(expiresAt: number): string {
  return new Intl.DateTimeFormat('pl-PL', { hour: '2-digit', minute: '2-digit' }).format(new Date(expiresAt))
}

export function LiveKitTestRoomView({ connection, returnHref }: Props) {
  const { user } = useAuth()
  const router = useRouter()
  const [state, setState] = useState<TestRoomState>('ready')
  const [error, setError] = useState<string | null>(null)
  const clientSessionIdRef = useRef(createClientSessionId())
  const endedRef = useRef(false)
  const intentionalDisconnectRef = useRef(false)
  const lastDisconnectSourceRef = useRef<LiveKitDisconnectSource | undefined>(undefined)

  const diagnosticLessonId = `livekit-test:${connection.roomId}`

  const reportDiagnostic = useCallback((
    event: Parameters<typeof postLiveKitDiagnosticEvent>[0]['event'],
    details: Partial<Parameters<typeof postLiveKitDiagnosticEvent>[0]> = {},
  ) => {
    postLiveKitDiagnosticEvent({
      clientSessionId: clientSessionIdRef.current,
      lessonId: diagnosticLessonId,
      uid: user?.id,
      role: user?.role,
      event,
      timestamp: new Date().toISOString(),
      ...details,
    })
  }, [diagnosticLessonId, user?.id, user?.role])

  useEffect(() => {
    const reportPageLifecycle = (source: LiveKitDisconnectSource) => {
      lastDisconnectSourceRef.current = source
      reportDiagnostic('page_lifecycle', { disconnectSource: source })
    }
    const handlePageHide = () => reportPageLifecycle('pagehide')
    const handleBeforeUnload = () => reportPageLifecycle('beforeunload')
    const handleFreeze = () => reportPageLifecycle('freeze')

    window.addEventListener('pagehide', handlePageHide)
    window.addEventListener('beforeunload', handleBeforeUnload)
    window.addEventListener('freeze', handleFreeze)
    return () => {
      window.removeEventListener('pagehide', handlePageHide)
      window.removeEventListener('beforeunload', handleBeforeUnload)
      window.removeEventListener('freeze', handleFreeze)
    }
  }, [reportDiagnostic])

  const handleDisconnectIntent = useCallback((source: LiveKitDisconnectSource) => {
    lastDisconnectSourceRef.current = source
    intentionalDisconnectRef.current = source === 'leave' || source === 'end'
    reportDiagnostic('disconnect_intent', { disconnectSource: source })
  }, [reportDiagnostic])

  const handleConnectionStateDiagnostic = useCallback((connectionState: string) => {
    reportDiagnostic('connection_state_changed', { connectionState })
  }, [reportDiagnostic])

  const handleStageMediaDeviceError = useCallback(({ deviceKind, error }: { deviceKind: MediaDeviceKind; error: Error }) => {
    reportDiagnostic('media_device_error', {
      deviceKind,
      errorName: error.name,
      errorMessage: error.message,
    })
  }, [reportDiagnostic])

  function handleDisconnected(reason?: DisconnectReason) {
    reportDiagnostic('disconnected', {
      disconnectReason: reason === undefined ? undefined : String(reason),
      disconnectSource: lastDisconnectSourceRef.current,
    })
    lastDisconnectSourceRef.current = undefined
    if (endedRef.current) return
    if (intentionalDisconnectRef.current) {
      intentionalDisconnectRef.current = false
      return
    }
    setState('disconnected')
  }

  function handleLiveKitError(err: Error) {
    reportDiagnostic('livekit_room_error', {
      errorName: err.name,
      errorMessage: err.message,
    })
    setError(err.message)
    setState('error')
  }

  function handleMediaDeviceFailure(failure?: MediaDeviceFailure, kind?: MediaDeviceKind) {
    reportDiagnostic('media_device_failure', {
      deviceKind: kind,
      mediaDeviceFailure: failure === undefined ? undefined : String(failure),
    })
  }

  function handleLeave() {
    setState('disconnected')
  }

  function handleEndTest() {
    endedRef.current = true
    setState('ended')
  }

  if (!isLiveKitConfigured) {
    return (
      <div className="flex min-h-[calc(100vh-64px)] flex-col items-center justify-center gap-3 px-4 text-center text-white">
        <AlertTriangle className="h-8 w-8 text-primary" aria-hidden="true" />
        <p className="text-lg font-semibold">LiveKit nie jest skonfigurowany</p>
        <p className="max-w-sm text-sm text-white/60">Brakuje zmiennych środowiskowych LiveKit.</p>
      </div>
    )
  }

  if (state === 'ended') {
    return (
      <div className="flex min-h-[calc(100vh-64px)] flex-col items-center justify-center gap-4 px-4 text-center text-white">
        <PhoneOff className="h-10 w-10 text-white/60" aria-hidden="true" />
        <div>
          <p className="text-lg font-semibold">Test zakończony</p>
          <p className="mt-1 text-sm text-white/60">Nie zmieniono żadnej lekcji ani płatności.</p>
        </div>
        <Button onClick={() => router.push(returnHref)} className="font-semibold">
          Wróć
        </Button>
      </div>
    )
  }

  if (state === 'disconnected') {
    return (
      <div className="flex min-h-[calc(100vh-64px)] flex-col items-center justify-center gap-4 px-4 text-center text-white">
        <PhoneOff className="h-10 w-10 text-white/60" aria-hidden="true" />
        <div>
          <p className="text-lg font-semibold">Połączenie testowe przerwane</p>
          <p className="mt-1 max-w-sm text-sm text-white/60">Możesz wrócić do tego samego pokoju, dopóki token LiveKit jest ważny.</p>
        </div>
        <Button onClick={() => setState('ready')} className="font-semibold">
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
        <p className="text-lg font-semibold">Nie udało się dołączyć do testu</p>
        {error && <p className="max-w-sm text-sm text-white/60">{error}</p>}
      </div>
    )
  }

  if (state !== 'ready') {
    return (
      <div className="flex min-h-[calc(100vh-64px)] flex-col items-center justify-center gap-3 px-4 text-center text-white">
        <Loader2 className="h-8 w-8 animate-spin text-primary" aria-hidden="true" />
        <p className="text-sm text-white/60">Łączenie z pokojem testowym…</p>
      </div>
    )
  }

  return (
    <LiveKitRoom
      serverUrl={connection.url}
      token={connection.token}
      connect
      audio={false}
      video={false}
      onDisconnected={handleDisconnected}
      onError={handleLiveKitError}
      onMediaDeviceFailure={handleMediaDeviceFailure}
    >
      <LessonRoomStage
        lessonId={connection.roomId}
        topic={`Test połączenia LiveKit. Link zaproszeniowy jest ważny do ${formatExpiry(connection.expiresAt)}.`}
        roomLabel="Pokój testowy LiveKit"
        waitingForLabel="drugą osobę"
        endButtonLabel="Zakończ test"
        endConfirmationMessage="Zakończyć test połączenia? To tylko rozłączy ten pokój testowy."
        onLeave={handleLeave}
        onEndLesson={handleEndTest}
        onDisconnectIntent={handleDisconnectIntent}
        onConnectionStateChange={handleConnectionStateDiagnostic}
        onMediaDeviceError={handleStageMediaDeviceError}
      />
    </LiveKitRoom>
  )
}
