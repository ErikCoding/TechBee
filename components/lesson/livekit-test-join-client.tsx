'use client'

import { useState } from 'react'
import { AlertTriangle, Loader2, PhoneCall } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { requestLiveKitTestToken, type LiveKitTestTokenResult } from '@/services/livekit-test.service'
import { LiveKitTestRoomView } from '@/components/lesson/livekit-test-room-view'

interface Props {
  invite?: string
}

export function LiveKitTestJoinClient({ invite }: Props) {
  const [connection, setConnection] = useState<LiveKitTestTokenResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function joinTest() {
    if (!invite) return
    setLoading(true)
    setError(null)
    try {
      setConnection(await requestLiveKitTestToken(invite))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Nie udało się dołączyć do testu LiveKit.')
    } finally {
      setLoading(false)
    }
  }

  if (connection) {
    return <LiveKitTestRoomView connection={connection} returnHref="/dashboard/student" />
  }

  return (
    <div className="flex min-h-[calc(100vh-64px)] items-center justify-center bg-[#0A0A0A] px-4 text-white">
      <section className="w-full max-w-md rounded-2xl border border-white/10 bg-white/[0.04] p-6 text-center shadow-2xl">
        <h1 className="text-xl font-semibold">Test połączenia LiveKit</h1>
        <p className="mt-2 text-sm leading-relaxed text-white/60">
          Dołączysz do izolowanego pokoju testowego Runbee. Test nie tworzy lekcji ani płatności.
        </p>

        {!invite ? (
          <div className="mt-5 rounded-lg border border-red-400/30 bg-red-400/10 px-3 py-2 text-sm text-red-100">
            <AlertTriangle className="mx-auto mb-2 h-5 w-5" aria-hidden="true" />
            Brakuje tokenu zaproszenia.
          </div>
        ) : (
          <Button onClick={joinTest} disabled={loading} className="mt-6 font-semibold">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <PhoneCall className="h-4 w-4" />}
            Dołącz do testu
          </Button>
        )}

        {error && (
          <p className="mt-4 rounded-lg border border-red-400/30 bg-red-400/10 px-3 py-2 text-sm text-red-100">
            {error}
          </p>
        )}
      </section>
    </div>
  )
}
