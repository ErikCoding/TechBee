'use client'

import { useState } from 'react'
import { FlaskConical, CheckCircle2, AlertTriangle, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { isFirebaseConfigured } from '@/lib/firebase'
import { resetSandboxStripeData } from '@/services/admin.service'

/**
 * Narrower sibling of AdminResetPanel — clears only Stripe *sandbox*
 * (test-mode) bookings, identified by Lesson.livemode being falsy (see
 * the doc comment on that field in lib/types.ts). Meant for clearing
 * out noise built up while testing locally against the Stripe test
 * keys, without touching real/live lessons or any chat/message
 * history — unlike the broader reset button below, this one is safe
 * to use even after the site has real users on it.
 */
export function AdminSandboxResetPanel() {
  const [confirming, setConfirming] = useState(false)
  const [status, setStatus] = useState<'idle' | 'loading' | 'done' | 'error'>('idle')
  const [result, setResult] = useState<{ deletedLessons: number; deletedSlotLocks: number } | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function handleReset() {
    setStatus('loading')
    setError(null)
    try {
      const res = await resetSandboxStripeData()
      setResult(res)
      setStatus('done')
      setConfirming(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Nie udało się wyczyścić danych sandboxa.')
      setStatus('error')
    }
  }

  return (
    <section className="rounded-2xl border border-border bg-card p-6">
      <div className="flex items-center gap-2">
        <FlaskConical className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
        <h2 className="font-semibold text-foreground">Wyczyść dane sandboxa Stripe</h2>
      </div>

      {!isFirebaseConfigured ? (
        <p className="mt-3 text-sm text-muted-foreground">Dostępne dopiero po skonfigurowaniu Firebase.</p>
      ) : (
        <div className="mt-3">
          <p className="text-sm text-muted-foreground">
            Usuwa tylko rezerwacje/lekcje opłacone kluczem testowym Stripe (np. z lokalnego <code>npm run dev</code>) —
            rozpoznawane po tym, że nie były prawdziwą, „live" płatnością. Realne, opłacone przez klientów lekcje oraz
            wszystkie wiadomości/czaty zostają nietknięte. Przydaje się, żeby wyczyścić panel „Portfel platformy" z
            szumu po testowaniu, bez ryzyka usunięcia czegokolwiek prawdziwego.
          </p>

          {!confirming ? (
            <Button variant="outline" className="mt-3" onClick={() => setConfirming(true)}>
              <FlaskConical className="mr-2 h-4 w-4" aria-hidden="true" />
              Wyczyść dane sandboxa
            </Button>
          ) : (
            <div className="mt-3 flex flex-col gap-3 rounded-xl border border-border bg-background p-4">
              <div className="flex items-start gap-2.5 text-sm text-muted-foreground">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                <p>Tej operacji nie można cofnąć. Usunąć wszystkie testowe (sandboxowe) lekcje?</p>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={() => setConfirming(false)} disabled={status === 'loading'}>
                  Anuluj
                </Button>
                <Button variant="destructive" size="sm" onClick={handleReset} disabled={status === 'loading'}>
                  {status === 'loading' ? <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" aria-hidden="true" /> : null}
                  Tak, wyczyść sandbox
                </Button>
              </div>
            </div>
          )}

          {status === 'done' && result && (
            <div className="mt-3 flex items-start gap-2.5 rounded-xl border border-success/30 bg-success-surface p-3 text-sm text-success-on-surface">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
              <p>
                Usunięto {result.deletedLessons} testowych lekcji i {result.deletedSlotLocks} powiązanych blokad terminów.
              </p>
            </div>
          )}
          {status === 'error' && <p className="mt-3 text-sm text-destructive">{error}</p>}
        </div>
      )}
    </section>
  )
}
