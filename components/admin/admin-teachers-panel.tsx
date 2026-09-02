'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { Search, Star, Trash2, Check, X, RotateCcw, ExternalLink, Loader2, GraduationCap } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { getAllTeachersForAdmin, deleteTeacherProfile, reviewTeacherApplication, setTeacherFeatured } from '@/services/teachers.service'
import { StatusBadge, type StatusTone } from '@/components/ui/status-badge'
import { cn } from '@/lib/utils'
import type { Category, Teacher } from '@/lib/types'

interface Props {
  categories: Category[]
}

type StatusFilter = 'all' | 'approved' | 'pending' | 'rejected'

const statusConfig: Record<'approved' | 'pending' | 'rejected', { label: string; tone: StatusTone }> = {
  approved: { label: 'Zaakceptowany', tone: 'success' },
  pending: { label: 'Oczekuje', tone: 'warning' },
  rejected: { label: 'Odrzucony', tone: 'error' },
}

function statusOf(t: Teacher): 'approved' | 'pending' | 'rejected' {
  return t.status ?? 'approved'
}

/** Full "manage the giełda" view for admins — every teacher regardless of status, with approve/reject/feature/delete controls. */
export function AdminTeachersPanel({ categories }: Props) {
  const [teachers, setTeachers] = useState<Teacher[] | null>(null)
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<StatusFilter>('all')
  const [busyId, setBusyId] = useState<string | null>(null)

  const categoryName = useMemo(() => {
    const map = new Map(categories.map((c) => [c.id, c.name]))
    return (id: string) => map.get(id) ?? id
  }, [categories])

  function reload() {
    setTeachers(null)
    getAllTeachersForAdmin().then(setTeachers)
  }

  useEffect(reload, [])

  const filtered = (teachers ?? [])
    .filter((t) => filter === 'all' || statusOf(t) === filter)
    .filter((t) => {
      if (!query.trim()) return true
      const q = query.toLowerCase()
      return t.name.toLowerCase().includes(q) || t.specialty.toLowerCase().includes(q)
    })

  async function withBusy(id: string, action: () => Promise<void>) {
    setBusyId(id)
    try {
      await action()
      reload()
    } finally {
      setBusyId(null)
    }
  }

  async function handleDelete(t: Teacher) {
    if (!window.confirm(`Usunąć profil „${t.name}" z giełdy? Tej operacji nie można cofnąć.`)) return
    await withBusy(t.id, () => deleteTeacherProfile(t.id))
  }

  const counts = {
    all: teachers?.length ?? 0,
    approved: teachers?.filter((t) => statusOf(t) === 'approved').length ?? 0,
    pending: teachers?.filter((t) => statusOf(t) === 'pending').length ?? 0,
    rejected: teachers?.filter((t) => statusOf(t) === 'rejected').length ?? 0,
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative sm:w-72">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
          <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Szukaj po imieniu lub specjalizacji..." className="pl-9" />
        </div>
        <div className="flex flex-wrap gap-1.5">
          {([
            { key: 'all', label: 'Wszyscy' },
            { key: 'approved', label: 'Zaakceptowani' },
            { key: 'pending', label: 'Oczekujący' },
            { key: 'rejected', label: 'Odrzuceni' },
          ] as const).map((f) => (
            <button
              key={f.key}
              type="button"
              onClick={() => setFilter(f.key)}
              className={cn(
                'rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors',
                filter === f.key ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-muted/70',
              )}
            >
              {f.label} <span className="opacity-70">({counts[f.key]})</span>
            </button>
          ))}
        </div>
      </div>

      {teachers === null ? (
        <div className="h-40 animate-pulse rounded-2xl border border-border bg-card" />
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-2xl border border-border bg-card p-10 text-center">
          <GraduationCap className="h-8 w-8 text-muted-foreground/40" aria-hidden="true" />
          <p className="text-sm text-muted-foreground">Brak nauczycieli spełniających kryteria.</p>
        </div>
      ) : (
        <div className="flex flex-col divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card">
          {filtered.map((t) => {
            const status = statusOf(t)
            const badge = statusConfig[status]
            const busy = busyId === t.id
            return (
              <div key={t.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex min-w-0 items-start gap-3">
                  <Avatar className="h-10 w-10 shrink-0">
                    <AvatarFallback color={t.avatarColor}>{t.initials}</AvatarFallback>
                  </Avatar>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <p className="text-sm font-semibold text-foreground">{t.name}</p>
                      <StatusBadge tone={badge.tone} dot={false} className="px-2 py-0.5 text-[10px]">{badge.label}</StatusBadge>
                      {t.featured && <Badge className="text-[10px]">Wyróżniony</Badge>}
                    </div>
                    <p className="truncate text-xs text-muted-foreground">{t.specialty} · {categoryName(t.categoryId)}</p>
                    <p className="text-xs text-muted-foreground">{t.location} · {t.hourlyRate} zł/godz.</p>
                  </div>
                </div>

                <div className="flex shrink-0 flex-wrap items-center gap-1.5 self-end sm:self-center">
                  {status === 'approved' && (
                    <>
                      <Link href={`/teacher/${t.id}`} target="_blank">
                        <Button size="sm" variant="ghost" title="Zobacz profil publiczny">
                          <ExternalLink className="h-3.5 w-3.5" />
                        </Button>
                      </Link>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={busy}
                        onClick={() => withBusy(t.id, () => setTeacherFeatured(t.id, !t.featured))}
                        className={t.featured ? 'text-bee-yellow-dark' : ''}
                      >
                        <Star className={cn('h-3.5 w-3.5', t.featured && 'fill-primary stroke-primary')} />
                        {t.featured ? 'Cofnij wyróżnienie' : 'Wyróżnij'}
                      </Button>
                      <Button size="sm" variant="outline" disabled={busy} onClick={() => withBusy(t.id, () => reviewTeacherApplication(t.id, 'rejected'))} className="text-destructive hover:text-destructive">
                        {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <X className="h-3.5 w-3.5" />}
                        Cofnij akceptację
                      </Button>
                    </>
                  )}
                  {status === 'pending' && (
                    <>
                      <Button size="sm" variant="outline" disabled={busy} onClick={() => withBusy(t.id, () => reviewTeacherApplication(t.id, 'rejected'))} className="text-destructive hover:text-destructive">
                        {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <X className="h-3.5 w-3.5" />}
                        Odrzuć
                      </Button>
                      <Button size="sm" disabled={busy} onClick={() => withBusy(t.id, () => reviewTeacherApplication(t.id, 'approved'))} className="font-semibold">
                        {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                        Zaakceptuj
                      </Button>
                    </>
                  )}
                  {status === 'rejected' && (
                    <Button size="sm" disabled={busy} onClick={() => withBusy(t.id, () => reviewTeacherApplication(t.id, 'approved'))} className="font-semibold">
                      {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RotateCcw className="h-3.5 w-3.5" />}
                      Przywróć / zaakceptuj
                    </Button>
                  )}
                  <Button size="sm" variant="ghost" disabled={busy} onClick={() => handleDelete(t)} className="text-destructive hover:text-destructive" title="Usuń z giełdy">
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
