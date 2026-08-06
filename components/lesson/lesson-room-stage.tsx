'use client'

import { useEffect, useRef, useState } from 'react'
import {
  RoomAudioRenderer,
  useChat,
  useConnectionState,
  useLocalParticipant,
  useParticipants,
  useRoomContext,
  useTracks,
  VideoTrack,
} from '@livekit/components-react'
import { ConnectionState, Track } from 'livekit-client'
import { Mic, MicOff, Video, VideoOff, PhoneOff, MessageSquare, Send, X, ScreenShare, ScreenShareOff } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn, formatChatTime } from '@/lib/utils'

interface Props {
  lessonId: string
  topic?: string
  /** Display name for the other party, used only in the "waiting for them to join" state before they've connected. */
  waitingForLabel?: string
  onLeave: () => void
}

function initialsOf(name: string | undefined): string {
  return (name ?? '?').trim().slice(0, 2).toUpperCase() || '?'
}

function formatElapsed(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60).toString().padStart(2, '0')
  const s = (totalSeconds % 60).toString().padStart(2, '0')
  return `${m}:${s}`
}

/**
 * The actual call UI — everything here runs *inside* `<LiveKitRoom>`
 * (see lesson-room-client.tsx), which is what makes the LiveKit hooks
 * used below (useLocalParticipant, useTracks, useChat, ...) work: they
 * all read from the room context that component provides.
 */
export function LessonRoomStage({ lessonId, topic, waitingForLabel, onLeave }: Props) {
  const room = useRoomContext()
  const connectionState = useConnectionState(room)
  const {
    localParticipant,
    isMicrophoneEnabled,
    isCameraEnabled,
    isScreenShareEnabled,
    lastMicrophoneError,
    lastCameraError,
  } = useLocalParticipant()
  const participants = useParticipants()
  const tracks = useTracks([Track.Source.Camera, Track.Source.ScreenShare], { onlySubscribed: false })
  const { chatMessages, send } = useChat()

  const [chatOpen, setChatOpen] = useState(false)
  const [draft, setDraft] = useState('')
  const [elapsed, setElapsed] = useState(0)
  const chatEndRef = useRef<HTMLDivElement | null>(null)

  const isConnected = connectionState === ConnectionState.Connected
  const remoteParticipants = participants.filter((p) => p.identity !== localParticipant.identity)
  const screenShareTrack = tracks.find((t) => t.source === Track.Source.ScreenShare)
  const cameraTrackFor = (identity: string) =>
    tracks.find((t) => t.source === Track.Source.Camera && t.participant.identity === identity)

  useEffect(() => {
    if (!isConnected) return
    const timer = setInterval(() => setElapsed((s) => s + 1), 1000)
    return () => clearInterval(timer)
  }, [isConnected])

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [chatMessages.length])

  async function toggleMic() {
    try {
      await localParticipant.setMicrophoneEnabled(!isMicrophoneEnabled)
    } catch {
      // surfaced to the user via lastMicrophoneError below
    }
  }

  async function toggleCamera() {
    try {
      await localParticipant.setCameraEnabled(!isCameraEnabled)
    } catch {
      // surfaced to the user via lastCameraError below
    }
  }

  async function toggleScreenShare() {
    try {
      await localParticipant.setScreenShareEnabled(!isScreenShareEnabled)
    } catch {
      // user cancelled the browser's screen picker — nothing to show
    }
  }

  function handleLeave() {
    room.disconnect()
    onLeave()
  }

  function sendMessage() {
    if (!draft.trim()) return
    send(draft.trim()).catch(() => {})
    setDraft('')
  }

  return (
    <div className="flex min-h-[calc(100vh-64px)] flex-col text-white">
      <RoomAudioRenderer />

      {/* Status bar */}
      <div className="flex items-center justify-between px-4 py-3 text-sm">
        <div className="flex items-center gap-2">
          <span className={cn('h-2 w-2 rounded-full', isConnected ? 'bg-emerald-400' : 'animate-pulse bg-yellow-400')} aria-hidden="true" />
          {isConnected ? `Połączono · ${formatElapsed(elapsed)}` : 'Łączenie…'}
        </div>
        <div className="text-white/50">Sala lekcji #{lessonId.slice(-6)}</div>
      </div>

      {/* Video stage */}
      <div className="relative mx-4 mb-4 flex-1 overflow-hidden rounded-2xl bg-[#151515]">
        {screenShareTrack ? (
          <div className="flex h-full min-h-[360px] flex-col">
            <div className="relative flex-1 overflow-hidden bg-black">
              <VideoTrack trackRef={screenShareTrack} className="h-full w-full object-contain" />
              <span className="absolute left-3 top-3 rounded-full bg-black/60 px-2.5 py-1 text-[11px] font-medium">
                Udostępnianie ekranu — {screenShareTrack.participant.name || screenShareTrack.participant.identity}
              </span>
            </div>
            {/* Face strip so people stay visible while a screen is shared */}
            <div className="flex shrink-0 gap-2 overflow-x-auto border-t border-white/10 bg-[#111] p-2">
              {participants.map((p) => {
                const camTrack = cameraTrackFor(p.identity)
                return (
                  <div key={p.identity} className="relative h-16 w-24 shrink-0 overflow-hidden rounded-lg bg-[#222]">
                    {camTrack ? (
                      <VideoTrack
                        trackRef={camTrack}
                        className="h-full w-full object-cover"
                        style={p.isLocal ? { transform: 'scaleX(-1)' } : undefined}
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-xs font-bold" style={{ backgroundColor: '#333' }}>
                        {initialsOf(p.name || p.identity)}
                      </div>
                    )}
                    <span className="absolute bottom-0.5 left-1 text-[9px] text-white/70">{p.isLocal ? 'Ty' : p.name || p.identity}</span>
                  </div>
                )
              })}
            </div>
          </div>
        ) : remoteParticipants.length === 0 ? (
          <div className="flex h-full min-h-[360px] flex-col items-center justify-center gap-3">
            <div className="flex h-24 w-24 items-center justify-center rounded-full bg-[#F4B400] text-3xl font-bold text-[#0A0A0A]">
              {initialsOf(waitingForLabel)}
            </div>
            <p className="text-sm text-white/70">Oczekiwanie na {waitingForLabel ?? 'drugą osobę'}…</p>
            {topic && <p className="max-w-md text-center text-xs text-white/40">{topic}</p>}
          </div>
        ) : (
          <div className={cn('grid h-full min-h-[360px] gap-2 p-2', remoteParticipants.length === 1 ? 'grid-cols-1' : 'grid-cols-1 sm:grid-cols-2')}>
            {remoteParticipants.map((p) => {
              const camTrack = cameraTrackFor(p.identity)
              return (
                <div key={p.identity} className="relative flex items-center justify-center overflow-hidden rounded-xl bg-[#1c1c1c]">
                  {camTrack ? (
                    <VideoTrack trackRef={camTrack} className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-20 w-20 items-center justify-center rounded-full text-2xl font-bold text-white" style={{ backgroundColor: '#3B82F6' }}>
                      {initialsOf(p.name || p.identity)}
                    </div>
                  )}
                  <span className="absolute bottom-2 left-2 rounded-full bg-black/50 px-2 py-0.5 text-[11px]">{p.name || p.identity}</span>
                </div>
              )
            })}
          </div>
        )}

        {/* Self preview tile — the face strip during screen share already covers this */}
        {!screenShareTrack && (
          <div className="absolute bottom-4 right-4 flex h-24 w-36 items-center justify-center overflow-hidden rounded-xl bg-[#222] shadow-lg ring-1 ring-white/10 sm:h-28 sm:w-44">
            {isCameraEnabled && cameraTrackFor(localParticipant.identity) ? (
              <VideoTrack
                trackRef={cameraTrackFor(localParticipant.identity)!}
                className="h-full w-full object-cover"
                style={{ transform: 'scaleX(-1)' }}
              />
            ) : (
              <div className="flex h-10 w-10 items-center justify-center rounded-full text-sm font-bold text-white" style={{ backgroundColor: '#3B82F6' }}>
                {initialsOf(localParticipant.name)}
              </div>
            )}
            <span className="absolute bottom-1.5 left-2 text-[10px] text-white/60">Ty</span>
            {!isMicrophoneEnabled && <MicOff className="absolute right-1.5 top-1.5 h-3.5 w-3.5 text-white/70" aria-hidden="true" />}
          </div>
        )}

        {/* Chat drawer — LiveKit's built-in reliable data-channel chat, scoped to this call only */}
        {chatOpen && (
          <div className="absolute inset-y-0 right-0 flex w-full max-w-xs flex-col border-l border-white/10 bg-[#111]/95 backdrop-blur">
            <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
              <p className="text-sm font-semibold">Czat lekcji</p>
              <button type="button" onClick={() => setChatOpen(false)} className="text-white/50 hover:text-white" aria-label="Zamknij czat">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="flex-1 space-y-2 overflow-y-auto px-4 py-3">
              {chatMessages.length === 0 && <p className="pt-6 text-center text-xs text-white/30">Brak wiadomości — napisz coś!</p>}
              {chatMessages.map((m) => {
                const isMe = m.from?.isLocal ?? false
                return (
                  <div key={m.id} className={cn('flex flex-col', isMe ? 'items-end' : 'items-start')}>
                    <div className={cn('max-w-[85%] rounded-xl px-3 py-1.5 text-xs', isMe ? 'bg-[#F4B400] text-[#0A0A0A]' : 'bg-white/10 text-white')}>
                      {m.message}
                    </div>
                    <span className="mt-0.5 px-1 text-[10px] text-white/30">{formatChatTime(m.timestamp)}</span>
                  </div>
                )
              })}
              <div ref={chatEndRef} />
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

      {(lastMicrophoneError || lastCameraError) && (
        <p className="mx-4 -mt-2 mb-2 text-center text-[11px] text-red-400">
          {lastMicrophoneError ? 'Brak dostępu do mikrofonu — sprawdź uprawnienia przeglądarki.' : 'Brak dostępu do kamery — sprawdź uprawnienia przeglądarki.'}
        </p>
      )}

      {/* Controls */}
      <div className="flex flex-wrap items-center justify-center gap-3 pb-8">
        <button
          type="button"
          onClick={toggleMic}
          className={cn('flex h-12 w-12 items-center justify-center rounded-full transition-colors', isMicrophoneEnabled ? 'bg-white/10 hover:bg-white/20' : 'bg-white text-[#0A0A0A]')}
          aria-label={isMicrophoneEnabled ? 'Wyłącz mikrofon' : 'Włącz mikrofon'}
        >
          {isMicrophoneEnabled ? <Mic className="h-5 w-5" /> : <MicOff className="h-5 w-5" />}
        </button>
        <button
          type="button"
          onClick={toggleCamera}
          className={cn('flex h-12 w-12 items-center justify-center rounded-full transition-colors', isCameraEnabled ? 'bg-white/10 hover:bg-white/20' : 'bg-white text-[#0A0A0A]')}
          aria-label={isCameraEnabled ? 'Wyłącz kamerę' : 'Włącz kamerę'}
        >
          {isCameraEnabled ? <Video className="h-5 w-5" /> : <VideoOff className="h-5 w-5" />}
        </button>
        <button
          type="button"
          onClick={toggleScreenShare}
          className={cn('flex h-12 w-12 items-center justify-center rounded-full transition-colors', isScreenShareEnabled ? 'bg-white text-[#0A0A0A]' : 'bg-white/10 hover:bg-white/20')}
          aria-label={isScreenShareEnabled ? 'Zatrzymaj udostępnianie ekranu' : 'Udostępnij ekran'}
        >
          {isScreenShareEnabled ? <ScreenShareOff className="h-5 w-5" /> : <ScreenShare className="h-5 w-5" />}
        </button>
        <button
          type="button"
          onClick={() => setChatOpen((v) => !v)}
          className={cn('relative flex h-12 w-12 items-center justify-center rounded-full transition-colors', chatOpen ? 'bg-white text-[#0A0A0A]' : 'bg-white/10 hover:bg-white/20')}
          aria-label="Czat lekcji"
        >
          <MessageSquare className="h-5 w-5" />
          {!chatOpen && chatMessages.length > 0 && (
            <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-[#F4B400]" aria-hidden="true" />
          )}
        </button>
        <button
          type="button"
          onClick={handleLeave}
          className="flex h-12 w-12 items-center justify-center rounded-full bg-red-500 transition-colors hover:bg-red-600"
          aria-label="Zakończ lekcję"
        >
          <PhoneOff className="h-5 w-5" />
        </button>
      </div>
    </div>
  )
}
