'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { Search, Star, Trash2, Check, X, RotateCcw, ExternalLink, Loader2, GraduationCap, ChevronDown, CalendarClock, Languages } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { getAllTeachersForAdmin, deleteTeacherProfile, reviewTeacherApplication, setTeacherFeatured } from '@/services/teachers.service'
import { StatusBadge, type StatusTone } from '@/components/ui/status-badge'
import { cn } from '@/lib/utils'
import { getTeacherCategoryIds, getTeacherCustomSubjects } from '@/lib/teacher-categories'
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

const WEEKDAY_LABELS: Record<string, string> = {
  monday: 'Poniedziałek',
  tuesday: 'Wtorek',
  wednesday: 'Środa',
  thursday: 'Czwartek',
  friday: 'Piątek',
  saturday: 'Sobota',
  sunday: 'Niedziela',
}

function formatSubmittedAt(value?: number) {
  if (!value) return 'Brak daty zgłoszenia'
  return new Intl.DateTimeFormat('pl-PL', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))
}

function formatList(values?: string[]) {
  if (!values?.length) return 'Nie podano'
  return values.join(', ')
}

function formatAvailability(t: Teacher) {
  const days = t.availability.map((day) => WEEKDAY_LABELS[day] ?? day)
  const hours = t.availabilityStart && t.availabilityEnd ? ` (${t.availabilityStart}-${t.availabilityEnd})` : ''
  return `${formatList(days)}${hours}`
}

/** Full "manage the giełda" view for admins — every teacher regardless of status, with approve/reject/feature/delete controls. */
export function AdminTeachersPanel({ categories }: Props) {
  const [teachers, setTeachers] = useState<Teacher[] | null>(null)
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<StatusFilter>('all')
  const [busyId, setBusyId] = useState<string | null>(null)
  const [expandedRejectedId, setExpandedRejectedId] = useState<string | null>(null)

  const categoryName = useMemo(() => {
    const map = new Map(categories.map((c) => [c.id, c.name]))
    return (id: string) => map.get(id) ?? id
  }, [categories])

  const categoryNames = useMemo(() => {
    return (teacher: Teacher) => [
      ...getTeacherCategoryIds(teacher).map(categoryName),
      ...getTeacherCustomSubjects(teacher),
    ].join(', ')
  }, [categoryName])

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
      return (
        t.name.toLowerCase().includes(q) ||
        t.specialty.toLowerCase().includes(q) ||
        categoryNames(t).toLowerCase().includes(q)
      )
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
            const expanded = expandedRejectedId === t.id
            return (
              <div key={t.id} className="flex flex-col">
                <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex min-w-0 items-start gap-3">
                    <Avatar className="h-10 w-10 shrink-0">
                      {t.photoUrl && <AvatarImage src={t.photoUrl} alt="" />}
                      <AvatarFallback color={t.avatarColor}>{t.initials}</AvatarFallback>
                    </Avatar>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <p className="text-sm font-semibold text-foreground">{t.name}</p>
                        <StatusBadge tone={badge.tone} dot={false} className="px-2 py-0.5 text-[10px]">{badge.label}</StatusBadge>
                        {t.featured && <Badge className="text-[10px]">Wyróżniony</Badge>}
                      </div>
                      <p className="truncate text-xs text-muted-foreground">{t.specialty} · {categoryNames(t)}</p>
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
                      <>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setExpandedRejectedId((current) => (current === t.id ? null : t.id))}
                          aria-expanded={expanded}
                        >
                          <ChevronDown className={cn('h-3.5 w-3.5 transition-transform', expanded && 'rotate-180')} />
                          {expanded ? 'Zwiń prośbę' : 'Rozwiń prośbę'}
                        </Button>
                        <Button size="sm" disabled={busy} onClick={() => withBusy(t.id, () => reviewTeacherApplication(t.id, 'approved'))} className="font-semibold">
                          {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RotateCcw className="h-3.5 w-3.5" />}
                          Przywróć / zaakceptuj
                        </Button>
                      </>
                    )}
                    <Button size="sm" variant="ghost" disabled={busy} onClick={() => handleDelete(t)} className="text-destructive hover:text-destructive" title="Usuń z giełdy">
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>

                {status === 'rejected' && expanded && (
                  <div className="border-t border-border bg-muted/25 px-4 py-4">
                    <div className="grid gap-3 lg:grid-cols-[1fr_1.1fr]">
                      <div className="rounded-xl border border-border bg-card p-4">
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge variant="secondary" className="text-[10px]">{categoryNames(t) || 'Brak przedmiotów'}</Badge>
                          <Badge variant="outline" className="text-[10px]">{formatSubmittedAt(t.submittedAt)}</Badge>
                        </div>
                        <h3 className="mt-3 text-sm font-semibold text-foreground">{t.specialty}</h3>
                        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{t.shortBio || 'Brak krótkiego opisu.'}</p>
                        <div className="mt-4 grid gap-2 text-xs text-muted-foreground sm:grid-cols-2">
                          <p><span className="font-medium text-foreground">Stawka: </span>{t.hourlyRate} zł/godz.</p>
                          <p><span className="font-medium text-foreground">Lokalizacja: </span>{t.location || 'Nie podano'}</p>
                          <p><span className="font-medium text-foreground">Doświadczenie: </span>{t.experience} lat</p>
                          <p><span className="font-medium text-foreground">ID profilu: </span>{t.id}</p>
                        </div>
                      </div>

                      <div className="rounded-xl border border-border bg-card p-4">
                        <div className="grid gap-3 sm:grid-cols-2">
                          <div className="rounded-lg bg-muted/50 p-3">
                            <div className="mb-1 flex items-center gap-1.5 text-xs font-semibold text-foreground">
                              <Languages className="h-3.5 w-3.5" aria-hidden="true" />
                              Języki
                            </div>
                            <p className="text-xs leading-relaxed text-muted-foreground">{formatList(t.languages)}</p>
                          </div>
                          <div className="rounded-lg bg-muted/50 p-3">
                            <div className="mb-1 flex items-center gap-1.5 text-xs font-semibold text-foreground">
                              <CalendarClock className="h-3.5 w-3.5" aria-hidden="true" />
                              Dostępność
                            </div>
                            <p className="text-xs leading-relaxed text-muted-foreground">{formatAvailability(t)}</p>
                          </div>
                        </div>

                        <div className="mt-4">
                          <p className="text-xs font-semibold text-foreground">Umiejętności</p>
                          <div className="mt-2 flex flex-wrap gap-1.5">
                            {t.skills.length > 0 ? t.skills.map((skill) => (
                              <Badge key={skill} variant="outline" className="text-[10px]">{skill}</Badge>
                            )) : <span className="text-xs text-muted-foreground">Nie podano</span>}
                          </div>
                        </div>

                        <div className="mt-4">
                          <p className="text-xs font-semibold text-foreground">Pełny opis</p>
                          <p className="mt-1 whitespace-pre-line text-sm leading-relaxed text-muted-foreground">{t.bio || 'Brak opisu.'}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
