'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { CalendarDays, CheckCircle2, Clock, Loader2, Send, Sparkles, UserRound } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { ProfilePhotoPicker } from '@/components/profile/profile-photo-picker'
import { useAuth } from '@/lib/auth-context'
import { getCategories } from '@/services/categories.service'
import { getTeacherApplication, submitTeacherApplication } from '@/services/teachers.service'
import { toParticipant } from '@/services/chat.service'
import type { Category, Teacher } from '@/lib/types'

const WEEKDAYS = [
  { code: 'Mon', label: 'Pon' },
  { code: 'Tue', label: 'Wt' },
  { code: 'Wed', label: 'Śr' },
  { code: 'Thu', label: 'Czw' },
  { code: 'Fri', label: 'Pt' },
  { code: 'Sat', label: 'Sob' },
  { code: 'Sun', label: 'Niedz' },
]

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

  const [photoUrl, setPhotoUrl] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [specialty, setSpecialty] = useState('')
  const [hourlyRate, setHourlyRate] = useState('150')
  const [location, setLocation] = useState('')
  const [experience, setExperience] = useState('5')
  const [shortBio, setShortBio] = useState('')
  const [bio, setBio] = useState('')
  const [skills, setSkills] = useState('')
  const [languages, setLanguages] = useState('Polski')
  const [availability, setAvailability] = useState<string[]>(['Mon', 'Tue', 'Wed', 'Thu', 'Fri'])
  const [availabilityStart, setAvailabilityStart] = useState('09:00')
  const [availabilityEnd, setAvailabilityEnd] = useState('17:00')

  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)

  useEffect(() => {
    if (!user) return
    Promise.all([getCategories(), getTeacherApplication(user.id)]).then(([cats, app]) => {
      setCategories(cats)
      if (app) {
        setExisting(app)
        setPhotoUrl(app.photoUrl ?? user.photoUrl ?? '')
        setCategoryId(app.categoryId)
        setSpecialty(app.specialty)
        setHourlyRate(String(app.hourlyRate))
        setLocation(app.location)
        setExperience(String(app.experience))
        setShortBio(app.shortBio)
        setBio(app.bio)
        setSkills(app.skills.join(', '))
        setLanguages(app.languages.join(', '))
        setAvailability(app.availability)
        setAvailabilityStart(app.availabilityStart ?? '09:00')
        setAvailabilityEnd(app.availabilityEnd ?? '17:00')
      } else if (cats[0]) {
        setPhotoUrl(user.photoUrl ?? '')
        setCategoryId(cats[0].id)
      }
      setLoaded(true)
    })
  }, [user])

  function toggleDay(code: string) {
    setAvailability((prev) => (prev.includes(code) ? prev.filter((d) => d !== code) : [...prev, code]))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!user) return
    setSubmitting(true)
    try {
      const profileUser = photoUrl.trim() !== (user.photoUrl ?? '')
        ? await updateProfile({ name: user.name, photoUrl })
        : user
      await submitTeacherApplication(toParticipant(profileUser), {
        photoUrl: photoUrl.trim() || undefined,
        categoryId,
        specialty: specialty.trim(),
        hourlyRate: Number(hourlyRate) || 0,
        location: location.trim(),
        experience: Number(experience) || 0,
        shortBio: shortBio.trim(),
        bio: bio.trim(),
        skills: skills.split(',').map((s) => s.trim()).filter(Boolean),
        languages: languages.split(',').map((s) => s.trim()).filter(Boolean),
        availability,
        availabilityStart,
        availabilityEnd,
      })
      setSubmitted(true)
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
          Twój profil czeka teraz na weryfikację przez administratora. Po akceptacji pojawisz się w giełdzie nauczycieli.
        </p>
        <Button onClick={() => router.push('/dashboard/teacher')} className="mt-5 font-semibold">
          Wróć do panelu
        </Button>
      </div>
    )
  }

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

      <FormSection icon={UserRound} title="Prezentacja profilu">
        <ProfilePhotoPicker
          value={photoUrl}
          onChange={setPhotoUrl}
          initials={user?.initials ?? existing?.initials ?? '??'}
          avatarColor={user?.avatarColor ?? existing?.avatarColor ?? '#F4B400'}
        />

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="categoryId" className="text-xs font-medium text-foreground">Kategoria specjalizacji</label>
            <select
              id="categoryId"
              required
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              className="h-10 w-full rounded-lg border border-input bg-transparent px-2.5 text-base outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 md:h-8 md:text-sm"
            >
              {categories.map((c) => (
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
              <Input id="hourlyRate" type="number" min={20} required value={hourlyRate} onChange={(e) => setHourlyRate(e.target.value)} />
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
      </FormSection>

      <FormSection icon={Sparkles} title="Doświadczenie i umiejętności">
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
          <div className="mb-3 flex items-center gap-2">
            <Clock className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
            <p className="text-xs font-medium text-foreground">Godziny rezerwacji</p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="availabilityStart" className="text-[11px] text-muted-foreground">Od</label>
              <Input id="availabilityStart" type="time" required value={availabilityStart} onChange={(e) => setAvailabilityStart(e.target.value)} />
            </div>
            <div className="flex flex-col gap-1.5">
              <label htmlFor="availabilityEnd" className="text-[11px] text-muted-foreground">Do</label>
              <Input id="availabilityEnd" type="time" required value={availabilityEnd} onChange={(e) => setAvailabilityEnd(e.target.value)} />
            </div>
          </div>
          <p className="mt-2 text-[11px] text-muted-foreground">Kalendarz generuje godzinne terminy tylko w wybranym zakresie i aktywnych dniach.</p>
        </div>
      </FormSection>

      <Button type="submit" disabled={submitting} className="mt-1 font-semibold">
        {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
        Wyślij zgłoszenie do weryfikacji
      </Button>
    </form>
  )
}
