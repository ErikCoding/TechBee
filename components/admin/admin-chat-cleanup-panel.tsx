'use client'

import { useEffect, useMemo, useState } from 'react'
import { MessageSquareOff, Search, Trash2, CheckCircle2, AlertTriangle, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { isFirebaseConfigured } from '@/lib/firebase'
import { deleteAdminConversation, listAdminConversations, type AdminConversationRow } from '@/services/admin.service'

/**
 * Lets an admin find a specific conversation (by participant name) and
 * delete it on its own — for the one-off "this chat needs to go"
 * case, rather than the broader reset-activity button which wipes
 * every conversation on the platform at once.
 */
export function AdminChatCleanupPanel() {
  const [conversations, setConversations] = useState<AdminConversationRow[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [confirming, setConfirming] = useState(false)
  const [status, setStatus] = useState<'idle' | 'loading' | 'done' | 'error'>('idle')
  const [error, setError] = useState<string | null>(null)

  async function loadConversations() {
    setLoading(true)
    setLoadError(null)
    try {
      const list = await listAdminConversations()
      setConversations(list)
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Nie udało się pobrać listy konwersacji.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!isFirebaseConfigured) {
      setLoading(false)
      return
    }
    loadConversations()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return conversations
    return conversations.filter((c) => c.participantNames.some((name) => name.toLowerCase().includes(q)))
  }, [conversations, search])

  const selected = conversations.find((c) => c.id === selectedId) ?? null

  async function handleDelete() {
    if (!selected) return
    setStatus('loading')
    setError(null)
    try {
      await deleteAdminConversation(selected.id)
      setConversations((prev) => prev.filter((c) => c.id !== selected.id))
      setSelectedId(null)
      setConfirming(false)
      setStatus('done')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Nie udało się usunąć konwersacji.')
      setStatus('error')
    }
  }

  return (
    <section className="rounded-2xl border border-border bg-card p-6">
      <div className="flex items-center gap-2">
        <MessageSquareOff className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
        <h2 className="font-semibold text-foreground">Usuń wybraną konwersację</h2>
      </div>

      {!isFirebaseConfigured ? (
        <p className="mt-3 text-sm text-muted-foreground">Dostępne dopiero po skonfigurowaniu Firebase.</p>
      ) : (
        <div className="mt-3 flex flex-col gap-3">
          <p className="text-sm text-muted-foreground">
            Wyszukaj po imieniu i nazwisku uczestnika, żeby trwale usunąć jedną konkretną konwersację razem z całą jej
            historią wiadomości — bez ruszania pozostałych czatów.
          </p>

          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
            <Input
              value={search}
              onChange={(e) => {
                setSearch(e.target.value)
                setSelectedId(null)
              }}
              placeholder="Szukaj po imieniu i nazwisku..."
              className="pl-9"
            />
          </div>

          {loading ? (
            <div className="flex h-24 items-center justify-center text-sm text-muted-foreground">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
              Ładowanie konwersacji...
            </div>
          ) : loadError ? (
            <p className="text-sm text-destructive">{loadError}</p>
          ) : (
            <div className="max-h-72 overflow-y-auto rounded-xl border border-border">
              {filtered.length === 0 ? (
                <p className="px-4 py-6 text-center text-xs text-muted-foreground">
                  {conversations.length === 0 ? 'Brak konwersacji.' : 'Brak wyników dla tego wyszukiwania.'}
                </p>
              ) : (
                <div className="divide-y divide-border">
                  {filtered.map((c) => (
                    <button
                      type="button"
                      key={c.id}
                      onClick={() => {
                        setSelectedId(c.id)
                        setConfirming(false)
                        setStatus('idle')
                      }}
                      className={`flex w-full flex-col gap-0.5 px-4 py-3 text-left text-xs transition-colors hover:bg-muted/40 ${selectedId === c.id ? 'bg-primary/10' : ''}`}
                    >
                      <span className="font-semibold text-foreground">{c.participantNames.join(' ↔ ') || 'Nieznana konwersacja'}</span>
                      <span className="truncate text-muted-foreground">{c.lastMessage || 'Brak wiadomości'}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {selected && (
            <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4">
              <p className="text-sm text-foreground">
                Wybrano: <span className="font-semibold">{selected.participantNames.join(' ↔ ')}</span>
              </p>

              {!confirming ? (
                <Button variant="destructive" size="sm" className="mt-3" onClick={() => setConfirming(true)}>
                  <Trash2 className="mr-2 h-3.5 w-3.5" aria-hidden="true" />
                  Usuń tę konwersację
                </Button>
              ) : (
                <div className="mt-3 flex flex-col gap-3">
                  <div className="flex items-start gap-2.5 text-sm text-destructive">
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                    <p>Tej operacji nie można cofnąć. Na pewno usunąć całą tę konwersację?</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" onClick={() => setConfirming(false)} disabled={status === 'loading'}>
                      Anuluj
                    </Button>
                    <Button variant="destructive" size="sm" onClick={handleDelete} disabled={status === 'loading'}>
                      {status === 'loading' ? <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" aria-hidden="true" /> : null}
                      Tak, usuń
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}

          {status === 'done' && (
            <div className="flex items-start gap-2.5 rounded-xl border border-success/30 bg-success-surface p-3 text-sm text-success-on-surface">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
              <p>Konwersacja została usunięta.</p>
            </div>
          )}
          {status === 'error' && <p className="text-sm text-destructive">{error}</p>}
        </div>
      )}
    </section>
  )
}
