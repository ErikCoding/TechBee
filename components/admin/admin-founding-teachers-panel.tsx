'use client'

import { useEffect, useMemo, useState } from 'react'
import { CheckCircle2, Clock3, Edit3, Eye, Loader2, Percent, Save, Search, Settings2, Trophy, Users } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Dialog,
  DialogBody,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  getFoundingTeacherDashboard,
  initializeFoundingTeacherProgram,
  updateFoundingTeacherProgramConfig,
  updateFoundingTeacherPromotion,
} from '@/services/admin.service'
import type { FoundingTeacherAdminDashboard, FoundingTeacherParticipantRow } from '@/lib/types'

function formatDate(ts?: number) {
  if (!ts) return '—'
  return new Date(ts).toLocaleDateString('pl-PL', { day: 'numeric', month: 'short', year: 'numeric' })
}

function toDateInput(ts?: number) {
  if (!ts) return ''
  const d = new Date(ts)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function fromDateInput(value: string) {
  if (!value) return undefined
  const [year, month, day] = value.split('-').map(Number)
  const ts = new Date(year, month - 1, day, 23, 59, 59, 999).getTime()
  return Number.isFinite(ts) ? ts : undefined
}

function statusLabel(status: FoundingTeacherParticipantRow['status']) {
  if (status === 'active') return 'Aktywna'
  if (status === 'expiring_soon') return 'Kończy się'
  return 'Zakończona'
}

export function AdminFoundingTeachersPanel() {
  const [dashboard, setDashboard] = useState<FoundingTeacherAdminDashboard | null>(null)
  const [query, setQuery] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [configDraft, setConfigDraft] = useState({
    enabled: false,
    limit: '50',
    promoRate: '5',
    durationDays: '90',
    marketplaceHighlightEnabled: true,
    homepageBannerEnabled: true,
    teachSectionEnabled: true,
  })
  const [promoDraft, setPromoDraft] = useState({ rate: '', endsAt: '', marketplaceHighlight: true })
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    getFoundingTeacherDashboard()
      .then((data) => {
        if (cancelled) return
        setDashboard(data)
        setConfigDraft({
          enabled: data.config.enabled,
          limit: String(data.config.limit),
          promoRate: String(data.config.promoRate),
          durationDays: String(data.config.durationDays),
          marketplaceHighlightEnabled: data.config.marketplaceHighlightEnabled,
          homepageBannerEnabled: data.config.homepageBannerEnabled,
          teachSectionEnabled: data.config.teachSectionEnabled,
        })
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Nie udało się pobrać programu.')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const selected = dashboard?.participants.find((row) => row.teacherId === selectedId) ?? dashboard?.participants[0] ?? null

  useEffect(() => {
    if (!selected) return
    setSelectedId(selected.teacherId)
    setPromoDraft({
      rate: String(selected.promotion.rate),
      endsAt: toDateInput(selected.promotion.endsAt),
      marketplaceHighlight: Boolean(selected.promotion.marketplaceHighlight),
    })
  }, [selected?.teacherId])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!dashboard) return []
    if (!q) return dashboard.participants
    return dashboard.participants.filter((row) => (
      row.name.toLowerCase().includes(q) ||
      row.teacherId.toLowerCase().includes(q) ||
      row.specialty?.toLowerCase().includes(q)
    ))
  }, [dashboard, query])

  async function saveConfig() {
    setSaving(true)
    setError(null)
    try {
      const next = await updateFoundingTeacherProgramConfig({
        enabled: configDraft.enabled,
        limit: Number(configDraft.limit),
        promoRate: Number(configDraft.promoRate.replace(',', '.')),
        durationDays: Number(configDraft.durationDays),
        marketplaceHighlightEnabled: configDraft.marketplaceHighlightEnabled,
        homepageBannerEnabled: configDraft.homepageBannerEnabled,
        teachSectionEnabled: configDraft.teachSectionEnabled,
      })
      setDashboard(next)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Nie udało się zapisać konfiguracji.')
    } finally {
      setSaving(false)
    }
  }

  async function initialize(confirm: boolean) {
    setSaving(true)
    setError(null)
    try {
      const next = await initializeFoundingTeacherProgram(confirm)
      setDashboard(next)
      setConfigDraft((draft) => ({
        ...draft,
        enabled: next.config.enabled,
        limit: String(next.config.limit),
        promoRate: String(next.config.promoRate),
        durationDays: String(next.config.durationDays),
      }))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Nie udało się uruchomić programu.')
    } finally {
      setSaving(false)
    }
  }

  async function savePromotion() {
    if (!selected) return
    setSaving(true)
    setError(null)
    try {
      const next = await updateFoundingTeacherPromotion(selected.teacherId, {
        rate: Number(promoDraft.rate.replace(',', '.')),
        endsAt: fromDateInput(promoDraft.endsAt),
        marketplaceHighlight: promoDraft.marketplaceHighlight,
      })
      setDashboard(next)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Nie udało się zapisać promocji.')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex h-48 items-center justify-center rounded-2xl border border-border bg-card text-sm text-muted-foreground">
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        Ładowanie programu...
      </div>
    )
  }

  if (!dashboard) {
    return <div className="rounded-2xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">{error ?? 'Brak danych programu.'}</div>
  }

  const remaining = Math.max(0, dashboard.config.limit - dashboard.config.participantsCount)
  const progress = Math.round((dashboard.config.participantsCount / dashboard.config.limit) * 100)
  const previewStartNumber = dashboard.config.participantsCount + 1

  return (
    <div className="flex flex-col gap-4">
      {error && <div className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">{error}</div>}

      <section className="grid gap-3 md:grid-cols-4">
        {[
          { icon: Trophy, label: 'Zajęte miejsca', value: `${dashboard.config.participantsCount}/${dashboard.config.limit}` },
          { icon: Users, label: 'Pozostało', value: String(remaining) },
          { icon: Percent, label: 'Promocyjna prowizja', value: `${dashboard.config.promoRate}%` },
          { icon: Clock3, label: 'Długość promocji', value: `${dashboard.config.durationDays} dni` },
        ].map((card) => {
          const Icon = card.icon
          return (
            <div key={card.label} className="rounded-2xl border border-border bg-card p-4">
              <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                <Icon className="h-4 w-4" />
                {card.label}
              </div>
              <p className="mt-2 text-2xl font-bold tabular-nums text-foreground">{card.value}</p>
            </div>
          )
        })}
      </section>

      <section className="overflow-hidden rounded-2xl border border-border bg-card">
        <div className="flex items-center justify-between border-b border-border bg-muted/40 px-5 py-4">
          <div>
            <h2 className="text-sm font-semibold text-foreground">Ustawienia programu</h2>
            <p className="mt-0.5 text-xs text-muted-foreground">Zmiany działają dla przyszłych uczestników; istniejące promocje są snapshotami.</p>
          </div>
          <Button type="button" onClick={saveConfig} disabled={saving} size="sm">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Zapisz
          </Button>
        </div>
        <div className="grid gap-4 p-5 lg:grid-cols-[1fr_220px]">
          <div className="grid gap-3 sm:grid-cols-4">
            <label className="text-xs font-medium text-muted-foreground">
              Limit miejsc
              <Input className="mt-1" inputMode="numeric" value={configDraft.limit} onChange={(e) => setConfigDraft((d) => ({ ...d, limit: e.target.value }))} />
            </label>
            <label className="text-xs font-medium text-muted-foreground">
              Prowizja promocyjna (%)
              <Input className="mt-1" inputMode="decimal" value={configDraft.promoRate} onChange={(e) => setConfigDraft((d) => ({ ...d, promoRate: e.target.value }))} />
            </label>
            <label className="text-xs font-medium text-muted-foreground">
              Czas promocji (dni)
              <Input className="mt-1" inputMode="numeric" value={configDraft.durationDays} onChange={(e) => setConfigDraft((d) => ({ ...d, durationDays: e.target.value }))} />
            </label>
            <div className="rounded-xl border border-border bg-background/50 p-3">
              <p className="text-xs font-medium text-muted-foreground">Postęp</p>
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-muted">
                <div className="h-full rounded-full bg-primary" style={{ width: `${Math.min(100, progress)}%` }} />
              </div>
              <p className="mt-2 text-xs text-muted-foreground">{progress}% wykorzystane</p>
            </div>
          </div>
          <div className="grid gap-2 text-xs">
            {[
              ['enabled', 'Program aktywny'],
              ['marketplaceHighlightEnabled', 'Wyróżnienie na giełdzie'],
              ['homepageBannerEnabled', 'Banner na stronie głównej'],
              ['teachSectionEnabled', 'Sekcja na /teach'],
            ].map(([key, label]) => (
              <label key={key} className="flex items-center justify-between gap-3 rounded-lg border border-border bg-background/50 px-3 py-2 text-muted-foreground">
                <span>{label}</span>
                <input
                  type="checkbox"
                  checked={Boolean(configDraft[key as keyof typeof configDraft])}
                  onChange={(e) => setConfigDraft((d) => ({ ...d, [key]: e.target.checked }))}
                  className="h-4 w-4 accent-primary"
                />
              </label>
            ))}
          </div>
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-[minmax(0,1.6fr)_minmax(320px,0.9fr)]">
        <div className="overflow-hidden rounded-2xl border border-border bg-card">
          <div className="flex flex-col gap-3 border-b border-border bg-muted/40 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-sm font-semibold text-foreground">Uczestnicy</h2>
              <p className="mt-0.5 text-xs text-muted-foreground">Aktywne i historyczne promocje pierwszych nauczycieli.</p>
            </div>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Szukaj..." className="h-9 pl-9" />
            </div>
          </div>
          <div className="divide-y divide-border">
            {filtered.length === 0 ? (
              <p className="px-5 py-8 text-center text-sm text-muted-foreground">Brak uczestników programu.</p>
            ) : filtered.map((row) => (
              <button
                key={row.teacherId}
                type="button"
                onClick={() => setSelectedId(row.teacherId)}
                className={`grid w-full gap-2 px-5 py-3 text-left text-xs transition-colors sm:grid-cols-[72px_1fr_120px_120px] sm:items-center ${selected?.teacherId === row.teacherId ? 'bg-accent/60' : 'hover:bg-muted/40'}`}
              >
                <span className="font-bold text-foreground">#{row.foundingTeacherNumber}</span>
                <span className="min-w-0">
                  <span className="block truncate font-semibold text-foreground">{row.name}</span>
                  <span className="block truncate text-muted-foreground">{row.specialty ?? row.teacherId}</span>
                </span>
                <span className="text-muted-foreground">{row.promotion.rate}% do {formatDate(row.promotion.endsAt)}</span>
                <span className="font-medium text-foreground">{statusLabel(row.status)}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-4">
          <section className="rounded-2xl border border-border bg-card p-5">
            <div className="flex items-center gap-2">
              <Edit3 className="h-4 w-4 text-muted-foreground" />
              <h2 className="text-sm font-semibold text-foreground">Szczegóły promocji</h2>
            </div>
            {selected ? (
              <div className="mt-4 flex flex-col gap-3">
                <div>
                  <p className="text-sm font-semibold text-foreground">{selected.name}</p>
                  <p className="text-xs text-muted-foreground">Miejsce #{selected.foundingTeacherNumber} · od {formatDate(selected.promotion.startedAt)}</p>
                </div>
                <label className="text-xs font-medium text-muted-foreground">
                  Prowizja %
                  <Input className="mt-1" inputMode="decimal" value={promoDraft.rate} onChange={(e) => setPromoDraft((d) => ({ ...d, rate: e.target.value }))} />
                </label>
                <label className="text-xs font-medium text-muted-foreground">
                  Koniec promocji
                  <Input className="mt-1" type="date" value={promoDraft.endsAt} onChange={(e) => setPromoDraft((d) => ({ ...d, endsAt: e.target.value }))} />
                </label>
                <label className="flex items-center justify-between rounded-lg border border-border px-3 py-2 text-xs text-muted-foreground">
                  Badge Pierwsza 50
                  <input type="checkbox" checked={promoDraft.marketplaceHighlight} onChange={(e) => setPromoDraft((d) => ({ ...d, marketplaceHighlight: e.target.checked }))} className="h-4 w-4 accent-primary" />
                </label>
                <Button type="button" onClick={savePromotion} disabled={saving}>
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                  Zapisz promocję
                </Button>
              </div>
            ) : (
              <p className="mt-4 text-sm text-muted-foreground">Wybierz uczestnika z tabeli.</p>
            )}
          </section>

          <section className="rounded-2xl border border-border bg-card p-5">
            <div className="flex items-center gap-2">
              <Settings2 className="h-4 w-4 text-muted-foreground" />
              <h2 className="text-sm font-semibold text-foreground">Inicjalizacja</h2>
            </div>
            <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
              Istniejący nauczyciele nie są dodawani automatycznie. Najpierw podejrzyj kolejkę, potem potwierdź start.
            </p>
            <div className="mt-4 flex gap-2">
              <Button type="button" variant="outline" size="sm" onClick={() => initialize(false)} disabled={saving}>
                <Eye className="h-4 w-4" />
                Podgląd
              </Button>
              <Button type="button" size="sm" onClick={() => setConfirmOpen(true)} disabled={saving || dashboard.preview.length === 0}>
                <Trophy className="h-4 w-4" />
                Uruchom program
              </Button>
            </div>
            <div className="mt-4 max-h-52 overflow-auto rounded-xl border border-border">
              {dashboard.preview.length === 0 ? (
                <p className="p-4 text-xs text-muted-foreground">Brak kwalifikujących się nauczycieli w limicie.</p>
              ) : dashboard.preview.map((row, index) => (
                <div key={row.teacherId} className="flex items-center justify-between gap-3 border-b border-border px-3 py-2 last:border-b-0">
                  <div className="min-w-0">
                    <p className="truncate text-xs font-semibold text-foreground">{index + 1}. {row.name}</p>
                    <p className="truncate text-[11px] text-muted-foreground">{row.specialty ?? '—'} · {formatDate(row.approvedAt ?? row.submittedAt)}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>
      </section>

      <section className="overflow-hidden rounded-2xl border border-border bg-card">
        <div className="border-b border-border bg-muted/40 px-5 py-4">
          <h2 className="text-sm font-semibold text-foreground">Audit log</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">Start programu, nadania miejsc, zmiany konfiguracji i ręczne korekty.</p>
        </div>
        <div className="divide-y divide-border">
          {dashboard.audit.length === 0 ? (
            <p className="px-5 py-6 text-sm text-muted-foreground">Brak wpisów audytu.</p>
          ) : dashboard.audit.map((entry) => (
            <div key={entry.id} className="grid gap-1 px-5 py-3 text-xs sm:grid-cols-[140px_1fr]">
              <span className="text-muted-foreground">{formatDate(entry.createdAt)}</span>
              <span>
                <span className="font-semibold text-foreground">{entry.message}</span>
                {entry.teacherName && <span className="text-muted-foreground"> · {entry.teacherName}</span>}
              </span>
            </div>
          ))}
        </div>
      </section>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Uruchomić program Pierwsza 50?</DialogTitle>
            <DialogDescription>
              To nada miejsca nauczycielom widocznym na publicznej giełdzie i rozpocznie ich indywidualny okres promocyjny.
            </DialogDescription>
          </DialogHeader>
          <DialogBody>
            <div className="grid gap-3 text-sm">
              <div className="rounded-xl border border-border bg-background/50 p-3">
                <p className="text-xs font-medium text-muted-foreground">Zostanie dodanych</p>
                <p className="mt-1 text-xl font-bold text-foreground">{dashboard.preview.length} nauczycieli</p>
              </div>
              <div className="grid gap-2 rounded-xl border border-border bg-background/50 p-3 text-xs">
                <div className="flex justify-between gap-3">
                  <span className="text-muted-foreground">Numery</span>
                  <span className="font-semibold text-foreground">
                    #{previewStartNumber}–#{previewStartNumber + dashboard.preview.length - 1}
                  </span>
                </div>
                <div className="flex justify-between gap-3">
                  <span className="text-muted-foreground">Prowizja</span>
                  <span className="font-semibold text-foreground">{dashboard.config.promoRate}%</span>
                </div>
                <div className="flex justify-between gap-3">
                  <span className="text-muted-foreground">Czas promocji</span>
                  <span className="font-semibold text-foreground">{dashboard.config.durationDays} dni</span>
                </div>
              </div>
              <div className="max-h-48 overflow-auto rounded-xl border border-border">
                {dashboard.preview.map((row, index) => (
                  <div key={row.teacherId} className="flex items-center justify-between gap-3 border-b border-border px-3 py-2 text-xs last:border-b-0">
                    <span className="min-w-0 truncate font-medium text-foreground">{row.name}</span>
                    <span className="shrink-0 text-muted-foreground">#{previewStartNumber + index}</span>
                  </div>
                ))}
              </div>
              <p className="text-xs leading-relaxed text-muted-foreground">
                Dla obecnych nauczycieli okres promocyjny rozpocznie się dokładnie w momencie tej inicjalizacji. Każdy uczestnik ma własne startedAt i endsAt; późniejsi nauczyciele dostaną własne 90 dni od chwili przyznania miejsca.
              </p>
            </div>
          </DialogBody>
          <DialogFooter className="justify-end">
            <DialogClose render={<Button type="button" variant="outline" disabled={saving}>Anuluj</Button>} />
            <Button
              type="button"
              disabled={saving || dashboard.preview.length === 0}
              onClick={async () => {
                await initialize(true)
                setConfirmOpen(false)
              }}
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trophy className="h-4 w-4" />}
              Potwierdź uruchomienie
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
