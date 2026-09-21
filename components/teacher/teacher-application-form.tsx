'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { CalendarDays, CheckCircle2, ChevronDown, Clock, Loader2, Save, Send, Sparkles, UserRound } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { ProfilePhotoPicker } from '@/components/profile/profile-photo-picker'
import { useAuth } from '@/lib/auth-context'
import { LESSON_DURATION_OPTIONS, normalizeLessonDurations } from '@/lib/lesson-durations'
import { timeToMinutes } from '@/lib/lesson-time'
import { getCategories } from '@/services/categories.service'
import { getTeacherApplication, submitTeacherApplication } from '@/services/teachers.service'
import { toParticipant } from '@/services/chat.service'
import { normalizeTeacherCustomSubjects } from '@/lib/teacher-categories'
import type { AvailabilityHours, Category, Teacher, WeekdayCode } from '@/lib/types'

const WEEKDAYS = [
  { code: 'Mon', label: 'Pon' },
  { code: 'Tue', label: 'Wt' },
  { code: 'Wed', label: 'Śr' },
  { code: 'Thu', label: 'Czw' },
  { code: 'Fri', label: 'Pt' },
  { code: 'Sat', label: 'Sob' },
  { code: 'Sun', label: 'Niedz' },
] satisfies { code: WeekdayCode; label: string }[]

const DEFAULT_AVAILABILITY_START = '09:00'
const DEFAULT_AVAILABILITY_END = '17:00'

const VISIBLE_CATEGORY_LIMIT = 9

function normalizeSelectedCategoryIds(cats: Category[], primaryId: string, ids?: string[]) {
  const availableIds = new Set(cats.map((cat) => cat.id))
  return [...new Set([...(ids ?? []), primaryId].filter((id) => availableIds.has(id)))]
}

function inferCategoryIdsFromText(cats: Category[], values: string[]) {
  const text = values.join(' ').toLowerCase()
  return cats
    .filter((cat) => text.includes(cat.name.toLowerCase()))
    .map((cat) => cat.id)
}

function inferCategoryIdsFromProfile(cats: Category[], app: Teacher) {
  const explicit = normalizeSelectedCategoryIds(cats, app.categoryId, app.categoryIds)
  if (app.categoryIds?.length) return explicit
  const inferred = inferCategoryIdsFromText(cats, [app.specialty, app.shortBio, app.bio, ...app.skills])
  return normalizeSelectedCategoryIds(cats, app.categoryId, [...explicit, ...inferred])
}

function assertValidHours(start: string, end: string, label: string) {
  const startMin = timeToMinutes(start)
  const endMin = timeToMinutes(end)
  if (startMin === null || endMin === null || endMin <= startMin) {
    throw new Error(`${label}: godzina "do" musi być późniejsza niż "od".`)
  }
}

function normalizeAvailabilityHours(
  activeDays: string[],
  availabilityHours: AvailabilityHours,
  fallback: { start: string; end: string },
): AvailabilityHours {
  return activeDays.reduce<AvailabilityHours>((acc, day) => {
    const code = day as WeekdayCode
    const hours = availabilityHours[code] ?? fallback
    acc[code] = { start: hours.start, end: hours.end }
    return acc
  }, {})
}

function FormSection({
  icon: Icon,
  title,
  children,
}: {
  icon: React.ElementType
  title: string
  children: React.ReactNode
}) {
  return (
    <section className="overflow-hidden rounded-2xl border border-border bg-card">
      <div className="flex items-center gap-2 border-b border-border bg-muted/40 px-4 py-3.5 sm:px-5">
        <Icon className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
        <h2 className="text-sm font-semibold text-foreground">{title}</h2>
      </div>
      <div className="flex flex-col gap-4 p-4 sm:p-5">{children}</div>
    </section>
  )
}

export function TeacherApplicationForm() {
  const { user, updateProfile } = useAuth()
  const router = useRouter()
  const [categories, setCategories] = useState<Category[]>([])
  const [existing, setExisting] = useState<Teacher | null>(null)
  const [loaded, setLoaded] = useState(false)

  const [displayName, setDisplayName] = useState('')
  const [photoUrl, setPhotoUrl] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [categoryIds, setCategoryIds] = useState<string[]>([])
  const [categoriesExpanded, setCategoriesExpanded] = useState(false)
  const [customSubjects, setCustomSubjects] = useState('')
  const [specialty, setSpecialty] = useState('')
  const [hourlyRate, setHourlyRate] = useState('150')
  const [location, setLocation] = useState('')
  const [experience, setExperience] = useState('5')
  const [shortBio, setShortBio] = useState('')
  const [bio, setBio] = useState('')
  const [skills, setSkills] = useState('')
  const [languages, setLanguages] = useState('Polski')
  const [lessonDurations, setLessonDurations] = useState<number[]>([60])
  const [availability, setAvailability] = useState<string[]>(['Mon', 'Tue', 'Wed', 'Thu', 'Fri'])
  const [availabilityStart, setAvailabilityStart] = useState('09:00')
  const [availabilityEnd, setAvailabilityEnd] = useState('17:00')
  const [customAvailabilityHours, setCustomAvailabilityHours] = useState(false)
  const [availabilityHours, setAvailabilityHours] = useState<AvailabilityHours>({})

  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [profileSaving, setProfileSaving] = useState(false)
  const [profileSaved, setProfileSaved] = useState(false)
  const [profileError, setProfileError] = useState<string | null>(null)

  useEffect(() => {
    if (!user) return
    Promise.all([getCategories(), getTeacherApplication(user.id)]).then(([cats, app]) => {
      setCategories(cats)
      setDisplayName(user.name)
      if (app) {
        setExisting(app)
        setPhotoUrl(app.photoUrl ?? user.photoUrl ?? '')
        const selectedCategoryIds = inferCategoryIdsFromProfile(cats, app)
        const primaryCategoryId = selectedCategoryIds.includes(app.categoryId)
          ? app.categoryId
          : selectedCategoryIds[0] ?? cats[0]?.id ?? ''
        setCategoryIds(selectedCategoryIds.length ? selectedCategoryIds : (cats[0] ? [cats[0].id] : []))
        setCategoryId(primaryCategoryId)
        setCustomSubjects(normalizeTeacherCustomSubjects(app.customSubjects).join(', '))
        setSpecialty(app.specialty)
        setHourlyRate(String(app.hourlyRate))
        setLocation(app.location)
        setExperience(String(app.experience))
        setShortBio(app.shortBio)
        setBio(app.bio)
        setSkills(app.skills.join(', '))
        setLanguages(app.languages.join(', '))
        setLessonDurations(normalizeLessonDurations(app.lessonDurations))
        setAvailability(app.availability)
        setAvailabilityStart(app.availabilityStart ?? DEFAULT_AVAILABILITY_START)
        setAvailabilityEnd(app.availabilityEnd ?? DEFAULT_AVAILABILITY_END)
        setAvailabilityHours(app.availabilityHours ?? {})
        setCustomAvailabilityHours(Boolean(app.availabilityHours && Object.keys(app.availabilityHours).length > 0))
      } else if (cats[0]) {
        setPhotoUrl(user.photoUrl ?? '')
        setCategoryId(cats[0].id)
        setCategoryIds([cats[0].id])
      }
      setLoaded(true)
    })
  }, [user?.id])

  function toggleDay(code: string) {
    setAvailability((prev) => (prev.includes(code) ? prev.filter((d) => d !== code) : [...prev, code]))
  }

  function dayHours(code: WeekdayCode) {
    return availabilityHours[code] ?? { start: availabilityStart, end: availabilityEnd }
  }

  function updateDayHours(code: WeekdayCode, field: 'start' | 'end', value: string) {
    setAvailabilityHours((prev) => ({
      ...prev,
      [code]: {
        ...(prev[code] ?? { start: availabilityStart, end: availabilityEnd }),
        [field]: value,
      },
    }))
  }

  function applyGlobalHoursToActiveDays() {
    setAvailabilityHours((prev) => normalizeAvailabilityHours(availability, prev, { start: availabilityStart, end: availabilityEnd }))
  }

  function toggleLessonDuration(minutes: number) {
    setLessonDurations((prev) => {
      const next = prev.includes(minutes) ? prev.filter((duration) => duration !== minutes) : [...prev, minutes]
      return normalizeLessonDurations(next.length ? next : [60])
    })
  }

  function toggleCategory(id: string) {
    setCategoryIds((prev) => {
      const next = prev.includes(id) ? prev.filter((category) => category !== id) : [...prev, id]
      if (next.length === 0) return prev
      if (!next.includes(categoryId)) setCategoryId(next[0])
      return next
    })
  }

  async function savePublicProfile(nextPhotoUrl = photoUrl) {
    if (!user) throw new Error('Musisz być zalogowany, aby zapisać profil.')
    const name = displayName.trim()
    if (!name) throw new Error('Podaj imię i nazwisko widoczne na profilu.')
    return updateProfile({ name, photoUrl: nextPhotoUrl.trim() || undefined })
  }

  async function handleSavePublicProfile() {
    setProfileSaving(true)
    setProfileError(null)
    setProfileSaved(false)
    try {
      await savePublicProfile()
      setProfileSaved(true)
      router.refresh()
    } catch (error) {
      setProfileError(error instanceof Error ? error.message : 'Nie udało się zapisać profilu.')
    } finally {
      setProfileSaving(false)
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!user) return
    setSubmitting(true)
    setProfileError(null)
    try {
      const trimmedName = displayName.trim()
      const trimmedPhotoUrl = photoUrl.trim()
      const identityChanged = trimmedName !== user.name || trimmedPhotoUrl !== (user.photoUrl ?? '')
      const profileUser = identityChanged
        ? await savePublicProfile()
        : user
      const inferredCategoryIds = inferCategoryIdsFromText(categories, [specialty, shortBio, bio, skills])
      const selectedCategoryIds = normalizeSelectedCategoryIds(categories, categoryId, [...categoryIds, ...inferredCategoryIds])
      const selectedCustomSubjects = normalizeTeacherCustomSubjects(customSubjects.split(','))
      if (!selectedCategoryIds.length) throw new Error('Wybierz przynajmniej jedną dziedzinę nauczania.')
      assertValidHours(availabilityStart, availabilityEnd, 'Globalna dostępność')
      const selectedAvailabilityHours = customAvailabilityHours
        ? normalizeAvailabilityHours(availability, availabilityHours, { start: availabilityStart, end: availabilityEnd })
        : undefined
      if (selectedAvailabilityHours) {
        for (const day of availability) {
          const weekday = WEEKDAYS.find((d) => d.code === day)
          const hours = selectedAvailabilityHours[day as WeekdayCode]
          if (hours) assertValidHours(hours.start, hours.end, weekday?.label ?? day)
        }
      }
      await submitTeacherApplication(toParticipant(profileUser), {
        photoUrl: trimmedPhotoUrl || undefined,
        categoryId: selectedCategoryIds.includes(categoryId) ? categoryId : selectedCategoryIds[0],
        categoryIds: selectedCategoryIds,
        customSubjects: selectedCustomSubjects,
        specialty: specialty.trim(),
        hourlyRate: Number(hourlyRate) || 0,
        location: location.trim(),
        experience: Number(experience) || 0,
        shortBio: shortBio.trim(),
        bio: bio.trim(),
        skills: skills.split(',').map((s) => s.trim()).filter(Boolean),
        languages: languages.split(',').map((s) => s.trim()).filter(Boolean),
        lessonDurations: normalizeLessonDurations(lessonDurations),
        availability,
        availabilityStart,
        availabilityEnd,
        availabilityHours: selectedAvailabilityHours,
      })
      setSubmitted(true)
      router.refresh()
    } catch (error) {
      setProfileError(error instanceof Error ? error.message : 'Nie udało się zapisać zmian.')
    } finally {
      setSubmitting(false)
    }
  }

  if (!loaded) {
    return <div className="h-64 animate-pulse rounded-2xl border border-border bg-card" />
  }

  if (submitted) {
    return (
      <div className="animate-fade-in-up rounded-2xl border border-primary/30 bg-accent p-8 text-center">
        <CheckCircle2 className="mx-auto h-10 w-10 text-bee-yellow-dark" aria-hidden="true" />
        <h2 className="mt-3 text-lg font-semibold text-accent-foreground">Zgłoszenie wysłane!</h2>
        <p className="mt-1 text-sm text-accent-foreground/80">
          Dane zawodowe czekają teraz na weryfikację przez administratora. Zdjęcie i nazwa konta zostały zapisane osobno.
        </p>
        <Button onClick={() => router.push('/dashboard/teacher')} className="mt-5 font-semibold">
          Wróć do panelu
        </Button>
      </div>
    )
  }

  const visibleCategories = categoriesExpanded
    ? categories
    : categories.filter((category, index) => index < VISIBLE_CATEGORY_LIMIT || categoryIds.includes(category.id))
  const hiddenCategoryCount = categories.length - visibleCategories.length

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5">
      {existing?.status === 'rejected' && (
        <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
          Twoje poprzednie zgłoszenie zostało odrzucone. Popraw dane poniżej i wyślij ponownie — trafi do kolejnej weryfikacji.
        </div>
      )}
      {existing?.status === 'pending' && (
        <div className="rounded-xl border border-warning/30 bg-warning-surface p-4 text-sm text-warning-on-surface">
          Masz już zgłoszenie oczekujące na weryfikację. Możesz je poniżej zaktualizować — wyślij ponownie, aby zapisać zmiany.
        </div>
      )}

      <FormSection icon={UserRound} title="Zdjęcie i dane konta">
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_260px] lg:items-start">
          <div className="flex flex-col gap-4">
            <ProfilePhotoPicker
              value={photoUrl}
              onChange={(url) => {
                setPhotoUrl(url)
                setProfileSaved(false)
                setProfileError(null)
              }}
              onCommit={async (url) => {
                setProfileSaving(true)
                setProfileError(null)
                setProfileSaved(false)
                try {
                  await savePublicProfile(url)
                  setProfileSaved(true)
                  router.refresh()
                } catch (error) {
                  setProfileError(error instanceof Error ? error.message : 'Nie udało się zapisać profilu.')
                  throw error
                } finally {
                  setProfileSaving(false)
                }
              }}
              initials={user?.initials ?? existing?.initials ?? '??'}
              avatarColor={user?.avatarColor ?? existing?.avatarColor ?? '#F4B400'}
            />

            <div className="flex flex-col gap-1.5">
              <label htmlFor="displayName" className="text-xs font-medium text-foreground">Imię i nazwisko na profilu</label>
              <Input
                id="displayName"
                required
                value={displayName}
                onChange={(e) => {
                  setDisplayName(e.target.value)
                  setProfileSaved(false)
                  setProfileError(null)
                }}
                placeholder="np. Marek Kowalski"
              />
            </div>
          </div>

          <div className="rounded-xl border border-border bg-background/60 p-4">
            <p className="text-sm font-semibold text-foreground">Zapis bez weryfikacji</p>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
              Zdjęcie i nazwa konta odświeżą się od razu w panelu, czacie oraz publicznym profilu nauczyciela.
            </p>
            <Button
              type="button"
              onClick={handleSavePublicProfile}
              disabled={profileSaving}
              className="mt-4 w-full font-semibold"
            >
              {profileSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
              Zapisz profil
            </Button>
            {profileSaved && (
              <p className="mt-3 flex items-center gap-1.5 rounded-lg bg-success-surface px-3 py-2 text-xs font-medium text-success-on-surface">
                <CheckCircle2 className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                Zapisano i odświeżono dane.
              </p>
            )}
            {profileError && <p className="mt-3 text-xs font-medium text-destructive">{profileError}</p>}
          </div>
        </div>
      </FormSection>

      <FormSection icon={Sparkles} title="Profil na giełdzie - wymaga weryfikacji">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-3 sm:col-span-2">
            <div className="flex flex-col gap-1">
              <p className="text-xs font-medium text-foreground">Dziedziny nauczania</p>
              <p className="text-xs text-muted-foreground">
                Zaznacz wszystkie dziedziny, pod którymi profil ma pojawiać się w filtrach giełdy.
                Jeśli nazwa dziedziny pojawi się w opisie lub umiejętnościach, system dopisze ją przy wysyłce.
              </p>
            </div>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {visibleCategories.map((c) => {
                const active = categoryIds.includes(c.id)
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => toggleCategory(c.id)}
                    aria-pressed={active}
                    className={`flex min-h-11 items-center justify-between gap-2 rounded-xl border px-3 py-2 text-left text-sm transition-colors ${
                      active
                        ? 'border-primary bg-accent font-semibold text-accent-foreground'
                        : 'border-border bg-background text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    <span>{c.name}</span>
                    {active && <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden="true" />}
                  </button>
                )
              })}
            </div>
            {categories.length > VISIBLE_CATEGORY_LIMIT && (
              <button
                type="button"
                onClick={() => setCategoriesExpanded((expanded) => !expanded)}
                className="inline-flex w-fit items-center gap-1.5 rounded-lg border border-border bg-background px-3 py-1.5 text-xs font-semibold text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                <ChevronDown
                  className={`h-3.5 w-3.5 transition-transform ${categoriesExpanded ? 'rotate-180' : ''}`}
                  aria-hidden="true"
                />
                {categoriesExpanded ? 'Zwiń dziedziny' : `Pokaż pozostałe (${hiddenCategoryCount})`}
              </button>
            )}
          </div>

          <div className="flex flex-col gap-1.5 sm:col-span-2">
            <label htmlFor="customSubjects" className="text-xs font-medium text-foreground">Inne dziedziny</label>
            <Input
              id="customSubjects"
              value={customSubjects}
              onChange={(e) => setCustomSubjects(e.target.value)}
              placeholder="np. Podstawy programowania, Statystyka, Egzamin ósmoklasisty"
            />
            <p className="text-xs text-muted-foreground">
              Wpisz po przecinku tylko te tematy, których nie ma na liście powyżej. Będą widoczne na profilu i przy rezerwacji.
            </p>
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="categoryId" className="text-xs font-medium text-foreground">Główna dziedzina</label>
            <select
              id="categoryId"
              required
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              className="h-10 w-full rounded-lg border border-input bg-transparent px-2.5 text-base outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 md:h-8 md:text-sm"
            >
              {categories.filter((c) => categoryIds.includes(c.id)).map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="specialty" className="text-xs font-medium text-foreground">Specjalizacja</label>
            <Input id="specialty" required value={specialty} onChange={(e) => setSpecialty(e.target.value)} placeholder="np. Programowanie PLC — Siemens TIA Portal" />
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="location" className="text-xs font-medium text-foreground">Lokalizacja</label>
            <Input id="location" required value={location} onChange={(e) => setLocation(e.target.value)} placeholder="np. Warszawa" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="hourlyRate" className="text-xs font-medium text-foreground">Stawka (zł)</label>
              <Input id="hourlyRate" type="number" min={5} required value={hourlyRate} onChange={(e) => setHourlyRate(e.target.value)} />
            </div>
            <div className="flex flex-col gap-1.5">
              <label htmlFor="experience" className="text-xs font-medium text-foreground">Doświadczenie</label>
              <Input id="experience" type="number" min={0} required value={experience} onChange={(e) => setExperience(e.target.value)} />
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="shortBio" className="text-xs font-medium text-foreground">Krótki opis na giełdzie</label>
          <Textarea id="shortBio" required rows={2} value={shortBio} onChange={(e) => setShortBio(e.target.value)} placeholder="Jedno-dwa zdania podsumowujące Twoje doświadczenie." />
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="bio" className="text-xs font-medium text-foreground">Pełny opis profilu</label>
          <Textarea id="bio" required rows={5} value={bio} onChange={(e) => setBio(e.target.value)} placeholder="Opisz swoje doświadczenie, certyfikaty i to, czego mogą nauczyć się Twoi uczniowie." />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="skills" className="text-xs font-medium text-foreground">Umiejętności</label>
            <Input id="skills" required value={skills} onChange={(e) => setSkills(e.target.value)} placeholder="Siemens S7-1500, TIA Portal, PROFINET" />
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="languages" className="text-xs font-medium text-foreground">Języki</label>
            <Input id="languages" required value={languages} onChange={(e) => setLanguages(e.target.value)} placeholder="Polski, Angielski" />
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <div>
            <p className="text-xs font-medium text-foreground">Długość lekcji</p>
            <p className="mt-1 text-xs text-muted-foreground">Zaznacz warianty, które uczniowie mogą wybrać przy rezerwacji. Standardowo dostępne jest 60 min.</p>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {LESSON_DURATION_OPTIONS.map((option) => {
              const active = lessonDurations.includes(option.minutes)
              return (
                <button
                  key={option.minutes}
                  type="button"
                  onClick={() => toggleLessonDuration(option.minutes)}
                  aria-pressed={active}
                  className={`flex h-11 items-center justify-center rounded-xl border text-sm font-semibold transition-colors ${
                    active
                      ? 'border-primary bg-accent text-accent-foreground'
                      : 'border-border bg-background text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {option.label}
                </button>
              )
            })}
          </div>
        </div>
      </FormSection>

      <FormSection icon={CalendarDays} title="Dostępność">
        <div>
          <div className="mb-2 flex items-center justify-between gap-3">
            <p className="text-xs font-medium text-foreground">Dni tygodnia</p>
            <span className="text-[11px] text-muted-foreground">{availability.length}/7 aktywnych</span>
          </div>
          <div className="grid grid-cols-2 gap-2 min-[420px]:grid-cols-4 sm:grid-cols-7">
            {WEEKDAYS.map((d) => {
              const active = availability.includes(d.code)
              return (
                <button
                  key={d.code}
                  type="button"
                  onClick={() => toggleDay(d.code)}
                  aria-pressed={active}
                  className={`flex h-12 items-center justify-center rounded-xl border text-sm font-semibold transition-colors ${
                    active
                      ? 'border-primary bg-accent text-accent-foreground'
                      : 'border-border bg-background text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {d.label}
                </button>
              )
            })}
          </div>
        </div>

        <div className="rounded-xl border border-border bg-background/60 p-4">
          <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
              <p className="text-xs font-medium text-foreground">Godziny rezerwacji</p>
            </div>
            <label className="flex items-center gap-2 text-[11px] font-medium text-muted-foreground">
              <Switch checked={customAvailabilityHours} onCheckedChange={setCustomAvailabilityHours} />
              Osobne godziny dla dni
            </label>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="availabilityStart" className="text-[11px] text-muted-foreground">
                {customAvailabilityHours ? 'Domyślnie od' : 'Od'}
              </label>
              <Input id="availabilityStart" type="time" required value={availabilityStart} onChange={(e) => setAvailabilityStart(e.target.value)} />
            </div>
            <div className="flex flex-col gap-1.5">
              <label htmlFor="availabilityEnd" className="text-[11px] text-muted-foreground">
                {customAvailabilityHours ? 'Domyślnie do' : 'Do'}
              </label>
              <Input id="availabilityEnd" type="time" required value={availabilityEnd} onChange={(e) => setAvailabilityEnd(e.target.value)} />
            </div>
          </div>
          {customAvailabilityHours && (
            <div className="mt-4 flex flex-col gap-2">
              <div className="flex items-center justify-between gap-3">
                <p className="text-[11px] font-medium text-muted-foreground">Zakresy dla aktywnych dni</p>
                <button
                  type="button"
                  onClick={applyGlobalHoursToActiveDays}
                  className="rounded-lg border border-border px-2.5 py-1 text-[11px] font-semibold text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                >
                  Ustaw domyślne
                </button>
              </div>
              <div className="grid gap-2">
                {WEEKDAYS.filter((day) => availability.includes(day.code)).map((day) => {
                  const hours = dayHours(day.code)
                  return (
                    <div key={day.code} className="grid grid-cols-[3.5rem_minmax(0,1fr)_minmax(0,1fr)] items-end gap-2 rounded-lg border border-border bg-card p-2">
                      <span className="pb-2 text-xs font-semibold text-foreground">{day.label}</span>
                      <label className="flex flex-col gap-1 text-[11px] text-muted-foreground">
                        Od
                        <Input type="time" required value={hours.start} onChange={(e) => updateDayHours(day.code, 'start', e.target.value)} />
                      </label>
                      <label className="flex flex-col gap-1 text-[11px] text-muted-foreground">
                        Do
                        <Input type="time" required value={hours.end} onChange={(e) => updateDayHours(day.code, 'end', e.target.value)} />
                      </label>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
          <p className="mt-2 text-[11px] text-muted-foreground">
            Końcowa godzina oznacza najpóźniejszy koniec lekcji. Zapas po spotkaniu blokuje tylko kolizje z kolejnymi rezerwacjami.
          </p>
        </div>
      </FormSection>

      <Button type="submit" disabled={submitting} className="mt-1 font-semibold">
        {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
        Wyślij dane zawodowe do weryfikacji
      </Button>
    </form>
  )
}
