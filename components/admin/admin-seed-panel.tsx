'use client'

import { useState } from 'react'
import { DatabaseZap, CheckCircle2, AlertTriangle, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { isFirebaseConfigured } from '@/lib/firebase'
import { seedFirestoreDemoData, type SeedResult } from '@/services/seed.service'

export function AdminSeedPanel() {
  const [status, setStatus] = useState<'idle' | 'loading' | 'done' | 'error'>('idle')
  const [results, setResults] = useState<SeedResult[]>([])
  const [error, setError] = useState<string | null>(null)

  async function handleSeed() {
    setStatus('loading')
    setError(null)
    try {
      const res = await seedFirestoreDemoData()
      setResults(res)
      setStatus('done')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Nie udało się zasiać danych.')
      setStatus('error')
    }
  }

  return (
    <section id="settings" className="rounded-2xl border border-border bg-card p-6">
      <div className="flex items-center gap-2">
        <DatabaseZap className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
        <h2 className="font-semibold text-foreground">Ustawienia — dane Firestore</h2>
      </div>

      {!isFirebaseConfigured ? (
        <div className="mt-3 flex items-start gap-2.5 rounded-xl border border-yellow-500/30 bg-yellow-500/5 p-4 text-sm text-yellow-700 dark:text-yellow-400">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <div>
            <p className="font-medium">Firebase nie jest jeszcze skonfigurowane.</p>
            <p className="mt-1 text-muted-foreground">
              Uzupełnij zmienne <code className="rounded bg-muted px-1 py-0.5">NEXT_PUBLIC_FIREBASE_*</code> w pliku <code className="rounded bg-muted px-1 py-0.5">.env.local</code>, aby przełączyć platformę z trybu lokalnego (localStorage) na prawdziwą bazę danych. Do tego czasu aplikacja działa w pełni na danych demonstracyjnych.
            </p>
          </div>
        </div>
      ) : (
        <div className="mt-3">
          <p className="text-sm text-muted-foreground">
            Wgraj katalog demo (nauczyciele, kategorie, opinie, FAQ) do kolekcji Firestore. Bezpieczne do wielokrotnego uruchomienia — nadpisuje te same dokumenty.
          </p>
          <Button onClick={handleSeed} disabled={status === 'loading'} className="mt-3 bg-[#F4B400] text-[#0A0A0A] hover:bg-[#FBBF24] font-semibold">
            {status === 'loading' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <DatabaseZap className="mr-2 h-4 w-4" />}
            Zasiej dane demo
          </Button>
          {status === 'done' && (
            <div className="mt-3 flex items-start gap-2.5 rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-3 text-sm text-emerald-700 dark:text-emerald-400">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
              <ul className="flex flex-col gap-0.5">
                {results.map((r) => (
                  <li key={r.collection}>{r.collection}: {r.count} dokumentów</li>
                ))}
              </ul>
            </div>
          )}
          {status === 'error' && (
            <p className="mt-3 text-sm text-destructive">{error}</p>
          )}
        </div>
      )}
    </section>
  )
}
