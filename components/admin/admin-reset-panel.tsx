'use client'

import { useState } from 'react'
import { Trash2, CheckCircle2, AlertTriangle, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { isFirebaseConfigured } from '@/lib/firebase'
import { resetActivityData, type ResetResult } from '@/services/reset.service'

/**
 * Wipes per-user activity data (messages, lessons/bookings, wallets,
 * notifications, parent-link codes, BeePoints) — see
 * services/reset.service.ts for exactly what is and isn't touched.
 * Destructive and irreversible, so it sits behind an explicit
 * confirmation step rather than running on the first click.
 */
export function AdminResetPanel() {
  const [confirming, setConfirming] = useState(false)
  const [status, setStatus] = useState<'idle' | 'loading' | 'done' | 'error'>('idle')
  const [results, setResults] = useState<ResetResult[]>([])
  const [error, setError] = useState<string | null>(null)

  async function handleReset() {
    setStatus('loading')
    setError(null)
    try {
      const res = await resetActivityData()
      setResults(res)
      setStatus('done')
      setConfirming(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Nie udało się zresetować danych.')
      setStatus('error')
    }
  }

  return (
    <section className="rounded-2xl border border-destructive/30 bg-destructive/5 p-6">
      <div className="flex items-center gap-2">
        <Trash2 className="h-4 w-4 text-destructive" aria-hidden="true" />
        <h2 className="font-semibold text-foreground">Reset danych aktywności</h2>
      </div>

      {!isFirebaseConfigured ? (
        <p className="mt-3 text-sm text-muted-foreground">Dostępne dopiero po skonfigurowaniu Firebase.</p>
      ) : (
        <div className="mt-3">
          <p className="text-sm text-muted-foreground">
            Trwale usuwa wiadomości i konwersacje, lekcje/rezerwacje, portfele i transakcje, powiadomienia, kody łączące rodzic-uczeń, salda/zdarzenia BeePoints oraz historię wypłat i log webhooka Stripe.
            {' '}<span className="font-medium text-foreground">Nie</span> usuwa kont użytkowników, profili/aplikacji nauczycieli (w tym ich połączenia ze Stripe Connect) ani katalogu (kategorie, opinie, FAQ). Nie dotyka też danych po stronie samego Stripe (konta, płatności) — do tego służy „Reset test data" w Stripe Dashboard (Test Mode).
          </p>

          {!confirming ? (
            <Button
              variant="destructive"
              className="mt-3"
              onClick={() => setConfirming(true)}
            >
              <Trash2 className="mr-2 h-4 w-4" aria-hidden="true" />
              Zresetuj dane aktywności
            </Button>
          ) : (
            <div className="mt-3 flex flex-col gap-3 rounded-xl border border-destructive/40 bg-background p-4">
              <div className="flex items-start gap-2.5 text-sm text-destructive">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                <p>Tej operacji nie można cofnąć. Na pewno chcesz usunąć wszystkie dane aktywności?</p>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={() => setConfirming(false)} disabled={status === 'loading'}>
                  Anuluj
                </Button>
                <Button variant="destructive" size="sm" onClick={handleReset} disabled={status === 'loading'}>
                  {status === 'loading' ? <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" aria-hidden="true" /> : null}
                  Tak, usuń wszystko
                </Button>
              </div>
            </div>
          )}

          {status === 'done' && (
            <div className="mt-3 flex items-start gap-2.5 rounded-xl border border-success/30 bg-success-surface p-3 text-sm text-success-on-surface">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
              <ul className="flex flex-col gap-0.5">
                {results.map((r) => (
                  <li key={r.collection}>{r.collection}: usunięto {r.count}</li>
                ))}
              </ul>
            </div>
          )}
          {status === 'error' && <p className="mt-3 text-sm text-destructive">{error}</p>}
        </div>
      )}
    </section>
  )
}
