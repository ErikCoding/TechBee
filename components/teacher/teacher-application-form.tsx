'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, Send, CheckCircle2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
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

export function TeacherApplicationForm() {
  const { user } = useAuth()
  const router = useRouter()
  const [categories, setCategories] = useState<Category[]>([])
  const [existing, setExisting] = useState<Teacher | null>(null)
  const [loaded, setLoaded] = useState(false)

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

  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)

  useEffect(() => {
    if (!user) return
    Promise.all([getCategories(), getTeacherApplication(user.id)]).then(([cats, app]) => {
      setCategories(cats)
      if (app) {
        setExisting(app)
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
      } else if (cats[0]) {
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
      await submitTeacherApplication(toParticipant(user), {
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
      <div className="animate-fade-in-up rounded-2xl border border-[#F4B400]/30 bg-[#FEF3C7] p-8 text-center dark:bg-[#3B2800]">
        <CheckCircle2 className="mx-auto h-10 w-10 text-[#B45309] dark:text-[#FBBF24]" aria-hidden="true" />
        <h2 className="mt-3 text-lg font-semibold text-[#78350F] dark:text-[#FBBF24]">Zgłoszenie wysłane!</h2>
        <p className="mt-1 text-sm text-[#92400E] dark:text-[#FCD34D]">
          Twój profil czeka teraz na weryfikację przez administratora. Po akceptacji pojawisz się w giełdzie nauczycieli.
        </p>
        <Button onClick={() => router.push('/dashboard/teacher')} className="mt-5 bg-[#F4B400] text-[#0A0A0A] hover:bg-[#FBBF24] font-semibold">
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
        <div className="rounded-xl border border-yellow-500/30 bg-yellow-500/5 p-4 text-sm text-yellow-700 dark:text-yellow-400">
          Masz już zgłoszenie oczekujące na weryfikację. Możesz je poniżej zaktualizować — wyślij ponownie, aby zapisać zmiany.
        </div>
      )}

      <div className="flex flex-col gap-1.5">
        <label htmlFor="categoryId" className="text-xs font-medium text-foreground">Kategoria specjalizacji</label>
        <select
          id="categoryId"
          required
          value={categoryId}
          onChange={(e) => setCategoryId(e.target.value)}
          className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          {categories.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="specialty" className="text-xs font-medium text-foreground">Specjalizacja (tytuł profilu)</label>
          <Input id="specialty" required value={specialty} onChange={(e) => setSpecialty(e.target.value)} placeholder="np. Programowanie PLC — Siemens TIA Portal" />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="location" className="text-xs font-medium text-foreground">Lokalizacja</label>
          <Input id="location" required value={location} onChange={(e) => setLocation(e.target.value)} placeholder="np. Warszawa" />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="hourlyRate" className="text-xs font-medium text-foreground">Stawka godzinowa (zł)</label>
          <Input id="hourlyRate" type="number" min={20} required value={hourlyRate} onChange={(e) => setHourlyRate(e.target.value)} />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="experience" className="text-xs font-medium text-foreground">Lata doświadczenia</label>
          <Input id="experience" type="number" min={0} required value={experience} onChange={(e) => setExperience(e.target.value)} />
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="shortBio" className="text-xs font-medium text-foreground">Krótki opis (widoczny na liście)</label>
        <Textarea id="shortBio" required rows={2} value={shortBio} onChange={(e) => setShortBio(e.target.value)} placeholder="Jedno-dwa zdania podsumowujące Twoje doświadczenie." />
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="bio" className="text-xs font-medium text-foreground">Pełny opis (widoczny na profilu)</label>
        <Textarea id="bio" required rows={5} value={bio} onChange={(e) => setBio(e.target.value)} placeholder="Opisz swoje doświadczenie, certyfikaty i to, czego mogą nauczyć się Twoi uczniowie." />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="skills" className="text-xs font-medium text-foreground">Umiejętności (oddziel przecinkami)</label>
          <Input id="skills" required value={skills} onChange={(e) => setSkills(e.target.value)} placeholder="Siemens S7-1500, TIA Portal, PROFINET" />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="languages" className="text-xs font-medium text-foreground">Języki (oddziel przecinkami)</label>
          <Input id="languages" required value={languages} onChange={(e) => setLanguages(e.target.value)} placeholder="Polski, Angielski" />
        </div>
      </div>

      <div>
        <p className="mb-2 text-xs font-medium text-foreground">Dostępność (dni tygodnia)</p>
        <div className="flex flex-wrap gap-1.5">
          {WEEKDAYS.map((d) => (
            <button
              key={d.code}
              type="button"
              onClick={() => toggleDay(d.code)}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
                availability.includes(d.code)
                  ? 'bg-[#F4B400] text-[#0A0A0A]'
                  : 'bg-muted text-muted-foreground hover:bg-muted/70'
              }`}
            >
              {d.label}
            </button>
          ))}
        </div>
      </div>

      <Button type="submit" disabled={submitting} className="mt-1 bg-[#F4B400] text-[#0A0A0A] hover:bg-[#FBBF24] font-semibold">
        {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
        Wyślij zgłoszenie do weryfikacji
      </Button>
    </form>
  )
}
