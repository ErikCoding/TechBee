'use client'

import { useEffect, useMemo, useState } from 'react'
import { Archive, CheckCheck, Inbox, Loader2, Mail, MailOpen, RefreshCw, Reply, Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { EmptyState } from '@/components/ui/empty-state'
import { FormError } from '@/components/ui/form-error'
import { StatusBadge, type StatusTone } from '@/components/ui/status-badge'
import { listAdminSupportMessages, updateAdminSupportMessageStatus } from '@/services/support.service'
import { useAuth } from '@/lib/auth-context'
import { cn } from '@/lib/utils'
import type { SupportMessage, SupportMessageStatus } from '@/lib/types'

type Filter = 'active' | 'unread' | 'read' | 'archived'

const statusConfig: Record<SupportMessageStatus, { label: string; tone: StatusTone }> = {
  unread: { label: 'Nowa', tone: 'warning' },
  read: { label: 'Odczytana', tone: 'success' },
  archived: { label: 'Archiwum', tone: 'neutral' },
}

function formatDate(ts: number) {
  if (!ts) return 'Brak daty'
  return new Intl.DateTimeFormat('pl-PL', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(ts))
}

export function AdminSupportMessagesPanel() {
  const { user } = useAuth()
  const [messages, setMessages] = useState<SupportMessage[] | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [filter, setFilter] = useState<Filter>('active')
  const [query, setQuery] = useState('')
  const [busyId, setBusyId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function load() {
    if (!user || user.role !== 'admin') return
    setError(null)
    try {
      const data = await listAdminSupportMessages()
      setMessages(data.messages)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Nie udało się pobrać wiadomości.')
      setMessages([])
    }
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user])

  const counts = useMemo(() => {
    const list = messages ?? []
    return {
      active: list.filter((message) => message.status !== 'archived').length,
      unread: list.filter((message) => message.status === 'unread').length,
      read: list.filter((message) => message.status === 'read').length,
      archived: list.filter((message) => message.status === 'archived').length,
    }
  }, [messages])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return (messages ?? [])
      .filter((message) => {
        if (filter === 'active') return message.status !== 'archived'
        return message.status === filter
      })
      .filter((message) => {
        if (!q) return true
        return [message.name, message.email, message.subject, message.message].some((value) => value.toLowerCase().includes(q))
      })
  }, [messages, filter, query])

  async function setStatus(message: SupportMessage, status: SupportMessageStatus) {
    setBusyId(message.id)
    setError(null)
    try {
      await updateAdminSupportMessageStatus(message.id, status)
      setMessages((current) => current?.map((item) => (
        item.id === message.id
          ? { ...item, status, updatedAt: Date.now(), ...(status === 'read' ? { readAt: Date.now() } : {}), ...(status === 'archived' ? { archivedAt: Date.now() } : {}) }
          : item
      )) ?? null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Nie udało się zaktualizować wiadomości.')
    } finally {
      setBusyId(null)
    }
  }

  async function toggleSelected(message: SupportMessage) {
    const next = selectedId === message.id ? null : message.id
    setSelectedId(next)
    if (next && message.status === 'unread') {
      await setStatus(message, 'read')
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-2xl border border-border bg-card p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <Inbox className="h-5 w-5 text-primary" aria-hidden="true" />
              <h2 className="text-base font-semibold text-foreground">Wiadomości ze strony</h2>
              {counts.unread > 0 && <Badge>{counts.unread} nowych</Badge>}
            </div>
            <p className="mt-1 text-sm text-muted-foreground">Wiadomości wysłane z formularza kontaktowego do supportu Runbee.</p>
          </div>
          <Button variant="outline" size="sm" onClick={load} disabled={!messages}>
            <RefreshCw className="h-3.5 w-3.5" />
            Odśwież
          </Button>
        </div>

        <div className="mt-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="relative lg:w-80">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
            <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Szukaj po mailu, temacie lub treści..." className="pl-9" />
          </div>
          <div className="flex flex-wrap gap-1.5">
            {([
              { key: 'active', label: 'Aktywne' },
              { key: 'unread', label: 'Nowe' },
              { key: 'read', label: 'Odczytane' },
              { key: 'archived', label: 'Archiwum' },
            ] as const).map((item) => (
              <button
                key={item.key}
                type="button"
                onClick={() => setFilter(item.key)}
                className={cn(
                  'rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors',
                  filter === item.key ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-muted/70',
                )}
              >
                {item.label} <span className="opacity-70">({counts[item.key]})</span>
              </button>
            ))}
          </div>
        </div>
        <FormError className="mt-3">{error}</FormError>
      </div>

      {messages === null ? (
        <div className="h-52 animate-pulse rounded-2xl border border-border bg-card" />
      ) : filtered.length === 0 ? (
        <EmptyState icon={MailOpen} title="Brak wiadomości" description="Nie ma tu jeszcze żadnych zgłoszeń z formularza kontaktowego." className="rounded-2xl border border-border bg-card py-14" />
      ) : (
        <div className="flex flex-col divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card">
          {filtered.map((message) => {
            const selected = selectedId === message.id
            const status = statusConfig[message.status]
            const busy = busyId === message.id
            return (
              <article key={message.id} className={cn('transition-colors', message.status === 'unread' && 'bg-warning-surface/35')}>
                <button type="button" onClick={() => toggleSelected(message)} className="flex w-full flex-col gap-3 p-4 text-left sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex min-w-0 items-start gap-3">
                    <div className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-xl', message.status === 'unread' ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground')}>
                      {message.status === 'unread' ? <Mail className="h-4 w-4" aria-hidden="true" /> : <MailOpen className="h-4 w-4" aria-hidden="true" />}
                    </div>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-semibold text-foreground">{message.subject}</p>
                        <StatusBadge tone={status.tone} dot={false} className="px-2 py-0.5 text-[10px]">{status.label}</StatusBadge>
                      </div>
                      <p className="mt-0.5 truncate text-xs text-muted-foreground">{message.name} · {message.email}</p>
                      <p className="mt-1 line-clamp-1 text-xs text-muted-foreground">{message.message}</p>
                    </div>
                  </div>
                  <span className="shrink-0 text-xs text-muted-foreground">{formatDate(message.createdAt)}</span>
                </button>

                {selected && (
                  <div className="border-t border-border bg-muted/25 px-4 py-4">
                    <div className="grid gap-4 lg:grid-cols-[1fr_220px]">
                      <div>
                        <p className="whitespace-pre-line rounded-xl border border-border bg-card p-4 text-sm leading-relaxed text-muted-foreground">{message.message}</p>
                      </div>
                      <div className="flex flex-col gap-2">
                        <a href={`mailto:${message.email}?subject=${encodeURIComponent(`Re: ${message.subject}`)}`}>
                          <Button size="sm" className="w-full font-semibold">
                            <Reply className="h-3.5 w-3.5" />
                            Odpowiedz mailem
                          </Button>
                        </a>
                        <Button size="sm" variant="outline" disabled={busy} onClick={() => setStatus(message, message.status === 'unread' ? 'read' : 'unread')}>
                          {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCheck className="h-3.5 w-3.5" />}
                          {message.status === 'unread' ? 'Oznacz odczytane' : 'Oznacz jako nowe'}
                        </Button>
                        {message.status !== 'archived' && (
                          <Button size="sm" variant="outline" disabled={busy} onClick={() => setStatus(message, 'archived')}>
                            {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Archive className="h-3.5 w-3.5" />}
                            Archiwizuj
                          </Button>
                        )}
                        <div className="rounded-xl border border-border bg-card p-3 text-xs text-muted-foreground">
                          <p><span className="font-medium text-foreground">Od: </span>{message.name}</p>
                          <p className="mt-1 break-all"><span className="font-medium text-foreground">Email: </span>{message.email}</p>
                          <p className="mt-1"><span className="font-medium text-foreground">Dodano: </span>{formatDate(message.createdAt)}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </article>
            )
          })}
        </div>
      )}
    </div>
  )
}
