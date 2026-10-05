'use client'

import { useState } from 'react'
import { Copy, Loader2, PhoneCall, PlusCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { createLiveKitTestSession, requestLiveKitTestToken, type LiveKitTestSession, type LiveKitTestTokenResult } from '@/services/livekit-test.service'
import { LiveKitTestRoomView } from '@/components/lesson/livekit-test-room-view'

function formatExpiry(expiresAt: number): string {
  return new Intl.DateTimeFormat('pl-PL', {
    hour: '2-digit',
    minute: '2-digit',
    day: '2-digit',
    month: '2-digit',
  }).format(new Date(expiresAt))
}

export function AdminLiveKitTestClient() {
  const [session, setSession] = useState<LiveKitTestSession | null>(null)
  const [connection, setConnection] = useState<LiveKitTestTokenResult | null>(null)
  const [status, setStatus] = useState<'idle' | 'creating' | 'joining'>('idle')
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  async function createSession() {
    setStatus('creating')
    setError(null)
    setCopied(false)
    try {
      const nextSession = await createLiveKitTestSession()
      setSession(nextSession)
      setConnection(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Nie udało się utworzyć testu LiveKit.')
    } finally {
      setStatus('idle')
    }
  }

  async function copyInvite() {
    if (!session) return
    await navigator.clipboard.writeText(session.inviteUrl)
    setCopied(true)
  }

  async function joinSession() {
    if (!session) return
    setStatus('joining')
    setError(null)
    try {
      setConnection(await requestLiveKitTestToken(session.invite))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Nie udało się dołączyć do testu LiveKit.')
    } finally {
      setStatus('idle')
    }
  }

  if (connection) {
    return <LiveKitTestRoomView connection={connection} returnHref="/admin/livekit-test" />
  }

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-4">
      <div>
        <h1 className="text-lg font-semibold text-foreground">Test LiveKit</h1>
        <p className="text-sm text-muted-foreground">
          Izolowany pokój diagnostyczny bez lekcji, rezerwacji i płatności.
        </p>
      </div>

      <section className="rounded-lg border border-border bg-card p-5 shadow-sm">
        <div className="flex flex-col gap-4">
          <div>
            <p className="text-sm font-semibold text-foreground">Sesja testowa</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Link działa przez 60 minut i wymaga zalogowanego konta Runbee.
            </p>
          </div>

          <Button onClick={createSession} disabled={status !== 'idle'} className="w-fit font-semibold">
            {status === 'creating' ? <Loader2 className="h-4 w-4 animate-spin" /> : <PlusCircle className="h-4 w-4" />}
            Utwórz test połączenia
          </Button>

          {session && (
            <div className="space-y-3 rounded-lg border border-border bg-muted/30 p-4">
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Link zaproszeniowy</p>
                <p className="mt-1 text-xs text-muted-foreground">Ważny do {formatExpiry(session.expiresAt)}.</p>
              </div>
              <div className="flex flex-col gap-2 sm:flex-row">
                <Input value={session.inviteUrl} readOnly className="font-mono text-xs" />
                <Button type="button" variant="outline" onClick={copyInvite} className="shrink-0">
                  <Copy className="h-4 w-4" />
                  {copied ? 'Skopiowano' : 'Kopiuj'}
                </Button>
              </div>
              <Button type="button" onClick={joinSession} disabled={status !== 'idle'} className="font-semibold">
                {status === 'joining' ? <Loader2 className="h-4 w-4 animate-spin" /> : <PhoneCall className="h-4 w-4" />}
                Dołącz do testu
              </Button>
            </div>
          )}

          {error && (
            <p className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </p>
          )}
        </div>
      </section>
    </div>
  )
}
