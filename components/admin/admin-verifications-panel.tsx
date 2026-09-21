'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ArrowRight, CalendarClock, Check, Clock3, Languages, Loader2, MapPin, ShieldCheck, Sparkles, UserRound, WalletCards, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { cn } from '@/lib/utils'
import { formatLessonDurations } from '@/lib/lesson-durations'
import { getTeacherCategoryIds, normalizeTeacherCategoryIds, normalizeTeacherCustomSubjects } from '@/lib/teacher-categories'
import { getCategories } from '@/services/categories.service'
import { getPendingTeacherApplications, reviewTeacherApplication } from '@/services/teachers.service'
import type { Category, Teacher, TeacherProfileSnapshot } from '@/lib/types'

const WEEKDAY_LABELS: Record<string, string> = {
  Mon: 'Pon',
  Tue: 'Wt',
  Wed: 'Śr',
  Thu: 'Czw',
  Fri: 'Pt',
  Sat: 'Sob',
  Sun: 'Niedz',
}

function formatSubmittedAt(value?: number) {
  if (!value) return 'Brak daty'
  return new Intl.DateTimeFormat('pl-PL', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value))
}

function formatList(items?: string[]) {
  return items?.length ? items.join(', ') : 'Nie podano'
}

function formatAvailability(profile: Pick<TeacherProfileSnapshot, 'availability' | 'availabilityStart' | 'availabilityEnd' | 'availabilityHours'>) {
  const days = profile.availability.length
    ? profile.availability.map((day) => WEEKDAY_LABELS[day] ?? day).join(', ')
    : 'Brak dni'
  const dayHours = profile.availabilityHours
    ? profile.availability
        .map((day) => {
          const hours = profile.availabilityHours?.[day as keyof typeof profile.availabilityHours]
          return hours ? `${WEEKDAY_LABELS[day] ?? day} ${hours.start}-${hours.end}` : null
        })
        .filter(Boolean)
        .join(', ')
    : ''
  if (dayHours) return dayHours
  return `${days}, ${profile.availabilityStart ?? '09:00'}-${profile.availabilityEnd ?? '17:00'}`
}

function profileFromTeacher(app: Teacher): TeacherProfileSnapshot {
  return {
    name: app.name,
    initials: app.initials,
    avatarColor: app.avatarColor,
    ...(app.photoUrl ? { photoUrl: app.photoUrl } : {}),
    specialty: app.specialty,
    categoryId: app.categoryId,
    categoryIds: getTeacherCategoryIds(app),
    customSubjects: normalizeTeacherCustomSubjects(app.customSubjects),
    hourlyRate: app.hourlyRate,
    location: app.location,
    experience: app.experience,
    bio: app.bio,
    shortBio: app.shortBio,
    skills: app.skills,
    languages: app.languages,
    lessonDurations: app.lessonDurations ?? [60],
    availability: app.availability,
    availabilityStart: app.availabilityStart,
    availabilityEnd: app.availabilityEnd,
    availabilityHours: app.availabilityHours,
    featured: app.featured,
    responseTime: app.responseTime,
    completionRate: app.completionRate,
  }
}

function categoryName(categories: Category[], id: string) {
  return categories.find((category) => category.id === id)?.name ?? id
}

function subjectNames(categories: Category[], profile: Pick<TeacherProfileSnapshot, 'categoryId' | 'categoryIds' | 'customSubjects'>) {
  return [
    ...normalizeTeacherCategoryIds(profile.categoryId, profile.categoryIds).map((id) => categoryName(categories, id)),
    ...normalizeTeacherCustomSubjects(profile.customSubjects),
  ].join(', ')
}

function CompactMetric({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ElementType
  label: string
  value: string
}) {
  return (
    <div className="rounded-xl border border-border bg-background/70 px-3 py-2.5">
      <div className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        <Icon className="h-3.5 w-3.5" aria-hidden="true" />
        {label}
      </div>
      <p className="mt-1 text-sm font-semibold text-foreground">{value}</p>
    </div>
  )
}

function ChangeRow({
  label,
  before,
  after,
}: {
  label: string
  before?: string
  after: string
}) {
  const changed = before !== undefined && before !== after
  return (
    <div className={cn(
      'grid gap-2 border-t border-border px-3 py-3 text-sm md:grid-cols-[150px_minmax(0,1fr)_28px_minmax(0,1fr)] md:items-start',
      changed && 'bg-primary/5',
    )}>
      <p className="font-medium text-foreground">{label}</p>
      {before === undefined ? (
        <p className="text-muted-foreground md:col-span-3">{after}</p>
      ) : (
        <>
          <p className={cn('min-w-0 rounded-lg border border-border bg-background px-3 py-2 text-muted-foreground', changed && 'line-through decoration-destructive/60')}>
            {before}
          </p>
          <ArrowRight className="hidden h-4 w-4 self-center text-muted-foreground md:block" aria-hidden="true" />
          <p className={cn('min-w-0 rounded-lg border px-3 py-2 font-medium text-foreground', changed ? 'border-primary/40 bg-accent' : 'border-border bg-background')}>
            {after}
          </p>
        </>
      )}
    </div>
  )
}

export function AdminVerificationsPanel() {
  const [applications, setApplications] = useState<Teacher[] | null>(null)
  const [categories, setCategories] = useState<Category[]>([])
  const [busyId, setBusyId] = useState<string | null>(null)

  useEffect(() => {
    Promise.all([getPendingTeacherApplications(), getCategories()]).then(([apps, cats]) => {
      setApplications(apps)
      setCategories(cats)
    })
  }, [])

  async function decide(id: string, decision: 'approved' | 'rejected') {
    setBusyId(id)
    try {
      await reviewTeacherApplication(id, decision)
      setApplications((prev) => (prev ?? []).filter((a) => a.id !== id))
    } finally {
      setBusyId(null)
    }
  }

  return (
    <section className="animate-fade-in-up overflow-hidden rounded-2xl border border-border">
      <div className="flex items-center gap-2 bg-muted/40 px-5 py-3.5">
        <ShieldCheck className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
        <h2 className="text-sm font-semibold text-foreground">Oczekujące zgłoszenia</h2>
        {applications !== null && applications.length > 0 && (
          <Badge className="ml-auto">{applications.length}</Badge>
        )}
      </div>

      <div className="bg-card p-5">
      {applications === null ? (
        <div className="h-20 animate-pulse rounded-xl bg-muted" />
      ) : applications.length === 0 ? (
        <p className="text-sm text-muted-foreground">Brak zgłoszeń czekających na weryfikację.</p>
      ) : (
        <div className="flex flex-col gap-4">
          {applications.map((app) => {
            const next = profileFromTeacher(app)
            const previous = app.previousProfile
            const isUpdate = Boolean(previous)
            return (
              <article key={app.id} className="overflow-hidden rounded-xl border border-border bg-background">
                <div className="flex flex-col gap-4 border-b border-border bg-muted/30 p-4 lg:flex-row lg:items-start lg:justify-between">
                  <div className="flex min-w-0 items-start gap-3">
                    <Avatar className="h-12 w-12 shrink-0">
                      {app.photoUrl && <AvatarImage src={app.photoUrl} alt="" />}
                      <AvatarFallback color={app.avatarColor}>{app.initials}</AvatarFallback>
                    </Avatar>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-base font-semibold text-foreground">{app.name}</h3>
                        <Badge variant={isUpdate ? 'outline' : 'secondary'} className="text-[10px]">
                          {isUpdate ? 'Zmiana profilu' : 'Nowy nauczyciel'}
                        </Badge>
                        <Badge variant="secondary" className="text-[10px]">{categoryName(categories, app.categoryId)}</Badge>
                      </div>
                      <p className="mt-1 max-w-3xl text-sm text-muted-foreground">{app.shortBio}</p>
                      <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                        <span className="inline-flex items-center gap-1"><UserRound className="h-3.5 w-3.5" aria-hidden="true" /> ID: {app.id}</span>
                        <span className="inline-flex items-center gap-1"><Clock3 className="h-3.5 w-3.5" aria-hidden="true" /> {formatSubmittedAt(app.submittedAt)}</span>
                      </p>
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-2 self-end lg:self-start">
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={busyId === app.id}
                      onClick={() => decide(app.id, 'rejected')}
                      className="text-destructive hover:text-destructive"
                    >
                      {busyId === app.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <X className="h-3.5 w-3.5" />}
                      Odrzuć
                    </Button>
                    <Button
                      size="sm"
                      disabled={busyId === app.id}
                      onClick={() => decide(app.id, 'approved')}
                      className="font-semibold"
                    >
                      {busyId === app.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                      Zaakceptuj
                    </Button>
                  </div>
                </div>

                <div className="grid gap-3 p-4 sm:grid-cols-2 xl:grid-cols-4">
                  <CompactMetric icon={WalletCards} label="Stawka" value={`${app.hourlyRate} zł/godz.`} />
                  <CompactMetric icon={Sparkles} label="Specjalizacja" value={app.specialty} />
                  <CompactMetric icon={MapPin} label="Lokalizacja" value={app.location} />
                  <CompactMetric icon={CalendarClock} label="Dostępność" value={`${formatAvailability(next)} · ${formatLessonDurations(next.lessonDurations)}`} />
                </div>

                <div className="px-4 pb-4">
                  <div className="overflow-hidden rounded-xl border border-border">
                    <div className="grid gap-2 bg-card px-3 py-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground md:grid-cols-[150px_minmax(0,1fr)_28px_minmax(0,1fr)]">
                      <span>Pole</span>
                      <span>{isUpdate ? 'Przed' : 'Dane do sprawdzenia'}</span>
                      {isUpdate && <span aria-hidden="true" />}
                      {isUpdate && <span>Po</span>}
                    </div>
                    <ChangeRow label="Główna dziedzina" before={previous ? categoryName(categories, previous.categoryId) : undefined} after={categoryName(categories, next.categoryId)} />
                    <ChangeRow label="Wszystkie dziedziny" before={previous ? subjectNames(categories, previous) : undefined} after={subjectNames(categories, next)} />
                    <ChangeRow label="Specjalizacja" before={previous?.specialty} after={next.specialty} />
                    <ChangeRow label="Stawka" before={previous ? `${previous.hourlyRate} zł/godz.` : undefined} after={`${next.hourlyRate} zł/godz.`} />
                    <ChangeRow label="Lokalizacja" before={previous?.location} after={next.location} />
                    <ChangeRow label="Doświadczenie" before={previous ? `${previous.experience} lat` : undefined} after={`${next.experience} lat`} />
                    <ChangeRow label="Długość lekcji" before={previous ? formatLessonDurations(previous.lessonDurations) : undefined} after={formatLessonDurations(next.lessonDurations)} />
                    <ChangeRow label="Dostępność" before={previous ? formatAvailability(previous) : undefined} after={formatAvailability(next)} />
                    <ChangeRow label="Języki" before={previous ? formatList(previous.languages) : undefined} after={formatList(next.languages)} />
                    <ChangeRow label="Umiejętności" before={previous ? formatList(previous.skills) : undefined} after={formatList(next.skills)} />
                    <ChangeRow label="Krótki opis" before={previous?.shortBio} after={next.shortBio} />
                    <ChangeRow label="Pełny opis" before={previous?.bio} after={next.bio} />
                  </div>

                  <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    <span className="inline-flex items-center gap-1">
                      <Languages className="h-3.5 w-3.5" aria-hidden="true" />
                      {formatList(app.languages)}
                    </span>
                    <span>Ocena: {app.rating || 0}/5</span>
                    <span>Opinie: {app.reviewCount}</span>
                    <span>Lekcje: {app.lessons}</span>
                  </div>
                </div>
              </article>
            )
          })}
        </div>
      )}

      <p className="mt-4 text-xs text-muted-foreground">
        Zaakceptowani nauczyciele pojawiają się od razu w{' '}
        <Link href="/marketplace" className="underline underline-offset-2 hover:text-foreground">giełdzie nauczycieli</Link>.
      </p>
      </div>
    </section>
  )
}
