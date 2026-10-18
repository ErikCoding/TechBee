'use client'

import { AvailabilityEditor } from './availability-editor'
import { normalizeAvailability } from '@/lib/availability-core'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, ArrowRight, BookOpen, CalendarDays, Check, CheckCircle2, ChevronDown, Clock, FileText, Loader2, Save, Send, UserRound } from 'lucide-react'
import styles from './teacher-application-form.module.css'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { ProfilePhotoPicker } from '@/components/profile/profile-photo-picker'
import { useAuth } from '@/lib/auth-context'
import { LESSON_DURATION_OPTIONS, normalizeLessonDurations } from '@/lib/lesson-durations'
import { toGrosze, fromGrosze } from '@/lib/stripe-config'
import { getCategories } from '@/services/categories.service'
import { getTeacherApplication, submitTeacherApplication } from '@/services/teachers.service'
import { toParticipant } from '@/services/chat.service'
import { normalizeTeacherApplicationCategoryIds } from '@/lib/teacher-application-categories'
import { normalizeTeacherCustomSubjects } from '@/lib/teacher-categories'
import { normalizeTeachingLevels, teachingLevels } from '@/lib/teaching-levels'
import { normalizeOfferedLessonPackageSizes } from '@/lib/lesson-packages-core'
import { normalizeTrialLessonDuration, normalizeTrialLessonPriceGrosze } from '@/lib/trial-lessons'
import type { AvailabilityHours, Category, LessonPackageSize, Teacher } from '@/lib/types'

const DEFAULT_AVAILABILITY_START = '09:00'
const DEFAULT_AVAILABILITY_END = '17:00'

const VISIBLE_CATEGORY_LIMIT = 9
const SECTIONS = [
  { id: 'identity', label: 'Twój profil', icon: UserRound },
  { id: 'subjects', label: 'Przedmioty i poziomy', icon: BookOpen },
  { id: 'description', label: 'O Tobie', icon: FileText },
  { id: 'offer', label: 'Lekcje i ceny', icon: Clock },
  { id: 'availability', label: 'Dostępność', icon: CalendarDays },
] as const

function categoryIdsFromProfile(cats: Category[], app: Teacher) {
  return normalizeTeacherApplicationCategoryIds(cats, app.categoryId, app.categoryIds)
}


function FormSection({
  id,
  title,
  description,
  aside,
  children,
}: {
  id: string
  number?: string
  icon?: React.ElementType
  title: string
  description: string
  aside?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <section id={`application-${id}`} aria-labelledby={`heading-${id}`} className={styles.section}>
      <header className={styles.sectionHeader}>
        <div>
          <h2 id={`heading-${id}`} tabIndex={-1}>{title}</h2>
          <p>{description}</p>
        </div>
        {aside}
      </header>
      <div className={styles.sectionBody}>{children}</div>
    </section>
  )
}

export function TeacherApplicationForm() {
  const { user, updateProfile } = useAuth()
  const router = useRouter()
  const [categories, setCategories] = useState<Category[]>([])
  const [existing, setExisting] = useState<Teacher | null>(null)
  const [loaded, setLoaded] = useState(false)
  const [loadFailed, setLoadFailed] = useState(false)

  const [displayName, setDisplayName] = useState('')
  const [photoUrl, setPhotoUrl] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [categoryIds, setCategoryIds] = useState<string[]>([])
  const [categoriesExpanded, setCategoriesExpanded] = useState(false)
  const [customSubjects, setCustomSubjects] = useState('')
  const [selectedTeachingLevels, setSelectedTeachingLevels] = useState<string[]>([])
  const [specialty, setSpecialty] = useState('')
  const [hourlyRate, setHourlyRate] = useState('150')
  const [location, setLocation] = useState('')
  const [experience, setExperience] = useState('5')
  const [shortBio, setShortBio] = useState('')
  const [bio, setBio] = useState('')
  const [skills, setSkills] = useState('')
  const [languages, setLanguages] = useState('Polski')
  const [lessonDurations, setLessonDurations] = useState<number[]>([60])
  const [trialLessonEnabled, setTrialLessonEnabled] = useState(false)
  const [trialLessonDuration, setTrialLessonDuration] = useState(30)
  const [trialLessonPrice, setTrialLessonPrice] = useState('')
  const [lessonPackageSizes, setLessonPackageSizes] = useState<LessonPackageSize[]>([])
  const [availability, setAvailability] = useState<string[]>(['Mon', 'Tue', 'Wed', 'Thu', 'Fri'])
  const [availabilityStart, setAvailabilityStart] = useState('09:00')
  const [availabilityEnd, setAvailabilityEnd] = useState('17:00')
  const [availabilityHours, setAvailabilityHours] = useState<AvailabilityHours>({})

  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [profileSaving, setProfileSaving] = useState(false)
  const [profileSaved, setProfileSaved] = useState(false)
  const [profileError, setProfileError] = useState<string | null>(null)
  const [step, setStep] = useState(0)
  const [direction, setDirection] = useState<'forward' | 'back'>('forward')
  const formRef = useRef<HTMLFormElement>(null)
  const stepperRef = useRef<HTMLDivElement>(null)
  const errorRef = useRef<HTMLParagraphElement>(null)
  const lastStep = SECTIONS.length - 1
  const progress = ((step + 1) / SECTIONS.length) * 100

  useEffect(() => { if (profileError) errorRef.current?.focus() }, [profileError])

  function changeStep(next: number) {
    setDirection(next > step ? 'forward' : 'back')
    setStep(next)
    requestAnimationFrame(() => {
      const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
      stepperRef.current?.scrollIntoView({ behavior: reduce ? 'instant' : 'smooth', block: 'start' })
      document.getElementById(`heading-${SECTIONS[next].id}`)?.focus({ preventScroll: true })
    })
  }

  function goNext() {
    // Only the current step is mounted, so native validation covers exactly this step.
    if (formRef.current && !formRef.current.reportValidity()) return
    if (step < lastStep) changeStep(step + 1)
  }

  function goBack() {
    if (step > 0) changeStep(step - 1)
  }

  useEffect(() => {
    if (!user) return
    Promise.all([getCategories(), getTeacherApplication(user.id)]).then(([cats, app]) => {
      setCategories(cats)
      setDisplayName(user.name)
      if (app) {
        setExisting(app)
        setPhotoUrl(app.photoUrl ?? user.photoUrl ?? '')
        const selectedCategoryIds = categoryIdsFromProfile(cats, app)
        const primaryCategoryId = selectedCategoryIds.includes(app.categoryId)
          ? app.categoryId
          : selectedCategoryIds[0] ?? cats[0]?.id ?? ''
        setCategoryIds(selectedCategoryIds.length ? selectedCategoryIds : (cats[0] ? [cats[0].id] : []))
        setCategoryId(primaryCategoryId)
        setCustomSubjects(normalizeTeacherCustomSubjects(app.customSubjects).join(', '))
        setSelectedTeachingLevels(normalizeTeachingLevels(app.teachingLevels))
        setSpecialty(app.specialty)
        setHourlyRate(String(app.hourlyRate))
        setLocation(app.location)
        setExperience(String(app.experience))
        setShortBio(app.shortBio)
        setBio(app.bio)
        setSkills(app.skills.join(', '))
        setLanguages(app.languages.join(', '))
        const normalizedDurations = normalizeLessonDurations(app.lessonDurations)
        setLessonDurations(normalizedDurations)
        setTrialLessonEnabled(app.trialLessonEnabled === true)
        setTrialLessonDuration(normalizeTrialLessonDuration(app.trialLessonDuration) ?? normalizedDurations[0] ?? 60)
        setTrialLessonPrice(app.trialLessonPriceGrosze ? String(fromGrosze(app.trialLessonPriceGrosze)) : '')
        setLessonPackageSizes(normalizeOfferedLessonPackageSizes(app.lessonPackageSizes))
        setAvailability(app.availability)
        setAvailabilityStart(app.availabilityStart ?? DEFAULT_AVAILABILITY_START)
        setAvailabilityEnd(app.availabilityEnd ?? DEFAULT_AVAILABILITY_END)
        setAvailabilityHours(app.availabilityHours ?? {})
      } else if (cats[0]) {
        setPhotoUrl(user.photoUrl ?? '')
        setCategoryId(cats[0].id)
        setCategoryIds([cats[0].id])
      }
      setLoaded(true)
    }).catch(() => setLoadFailed(true))
  }, [user?.id])


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

  function toggleTeachingLevel(id: string) {
    setSelectedTeachingLevels((prev) => (
      prev.includes(id) ? prev.filter((level) => level !== id) : [...prev, id]
    ))
  }

  function toggleLessonPackageSize(size: LessonPackageSize) {
    setLessonPackageSizes((prev) => (
      prev.includes(size) ? prev.filter((packageSize) => packageSize !== size) : normalizeOfferedLessonPackageSizes([...prev, size])
    ))
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
      const selectedCategoryIds = normalizeTeacherApplicationCategoryIds(categories, categoryId, categoryIds)
      const selectedCustomSubjects = normalizeTeacherCustomSubjects(customSubjects.split(','))
      const normalizedTeachingLevels = normalizeTeachingLevels(selectedTeachingLevels)
      if (!selectedCategoryIds.length) throw new Error('Wybierz przynajmniej jedną dziedzinę nauczania.')
      const selectedTrialDuration = normalizeTrialLessonDuration(trialLessonDuration)
      const parsedTrialPrice = Number(trialLessonPrice.replace(',', '.'))
      const selectedTrialPriceGrosze = normalizeTrialLessonPriceGrosze(toGrosze(parsedTrialPrice))
      if (trialLessonEnabled && !selectedTrialDuration) {
        throw new Error('Wybierz poprawną długość lekcji próbnej.')
      }
      if (trialLessonEnabled && !selectedTrialPriceGrosze) {
        throw new Error('Podaj poprawną cenę lekcji próbnej.')
      }
      const selectedAvailabilityHours = normalizeAvailability({ availability, availabilityStart, availabilityEnd, availabilityHours })
      await submitTeacherApplication(toParticipant(profileUser), {
        photoUrl: trimmedPhotoUrl || undefined,
        categoryId: selectedCategoryIds.includes(categoryId) ? categoryId : selectedCategoryIds[0],
        categoryIds: selectedCategoryIds,
        customSubjects: selectedCustomSubjects,
        teachingLevels: normalizedTeachingLevels,
        specialty: specialty.trim(),
        hourlyRate: Number(hourlyRate) || 0,
        location: location.trim(),
        experience: Number(experience) || 0,
        shortBio: shortBio.trim(),
        bio: bio.trim(),
        skills: skills.split(',').map((s) => s.trim()).filter(Boolean),
        languages: languages.split(',').map((s) => s.trim()).filter(Boolean),
        lessonDurations: normalizeLessonDurations(lessonDurations),
        trialLessonEnabled,
        trialLessonDuration: trialLessonEnabled ? selectedTrialDuration : undefined,
        trialLessonPriceGrosze: trialLessonEnabled ? selectedTrialPriceGrosze : undefined,
        lessonPackageSizes: normalizeOfferedLessonPackageSizes(lessonPackageSizes),
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

  if (loadFailed) return <div role="alert" className="p-6 text-sm">Nie udało się wczytać ogłoszenia. <Button variant="outline" onClick={() => window.location.reload()}>Spróbuj ponownie</Button></div>
  if (!loaded) {
    return <div className="h-64 animate-pulse rounded-2xl border border-border bg-card" />
  }

  if (submitted) {
    return (
      <div className={styles.success} role="status">
        <div className={styles.successBadge} aria-hidden="true">
          <span className={styles.successRing} />
          <span className={styles.successRing} data-delay="true" />
          <svg viewBox="0 0 52 52" className={styles.successSvg}>
            <circle className={styles.successCircle} cx="26" cy="26" r="23" fill="none" />
            <path className={styles.successTick} d="M15 27l8 8 14-16" fill="none" />
          </svg>
          {Array.from({ length: 12 }).map((_, i) => (
            <i key={i} className={styles.spark} style={{ '--a': `${i * 30}deg`, '--d': `${(i % 4) * 60}ms` } as React.CSSProperties} />
          ))}
        </div>
        <h2>Zgłoszenie wysłane!</h2>
        <p>
          Dane zawodowe czekają teraz na weryfikację przez administratora. Zdjęcie i nazwa konta zostały zapisane osobno.
        </p>
        <Button onClick={() => router.push('/dashboard/teacher')} className={styles.successButton}>
          Wróć do panelu
        </Button>
      </div>
    )
  }

  const visibleCategories = categoriesExpanded
    ? categories
    : categories.filter((category, index) => index < VISIBLE_CATEGORY_LIMIT || categoryIds.includes(category.id))
  const hiddenCategoryCount = categories.length - visibleCategories.length

  const stepAside = (
    <span className={styles.stepAside} aria-live="polite">
      <CalendarDays size={14} aria-hidden="true" />
      Krok {step + 1} z {SECTIONS.length} · {step === lastStep ? 'ostatni krok' : `zostało ${lastStep - step}`}
    </span>
  )

  return (
    <div className={styles.editor}>
      <header className={styles.pageHeader}>
        <h1>{existing ? 'Edytuj swoje ogłoszenie' : 'Stwórz swoje ogłoszenie'}</h1>
        <p>Przedstaw się, dopasuj lekcje i wybierz godziny, w których chcesz uczyć.</p>
      </header>
      <div ref={stepperRef} className={styles.stepperAnchor}>
        <nav aria-label="Etapy ogłoszenia" className={styles.stepper}>
          <ol className={styles.stepList}>
            {SECTIONS.map(({ id, label }, index) => {
              const done = index < step
              const active = index === step
              const inner = (
                <>
                  <span className={styles.stepDot} data-state={active ? 'active' : done ? 'done' : 'todo'}>
                    {done ? <Check size={13} aria-hidden="true" /> : index + 1}
                  </span>
                  <span className={styles.stepLabel} data-active={active}>{label}</span>
                </>
              )
              return (
                <li key={id} aria-current={active ? 'step' : undefined}>
                  {done ? (
                    <button type="button" className={styles.stepButton} onClick={() => changeStep(index)} disabled={submitting}>{inner}</button>
                  ) : (
                    <div className={styles.stepButton}>{inner}</div>
                  )}
                </li>
              )
            })}
          </ol>
          <div className={styles.progressTrack} role="progressbar" aria-valuemin={1} aria-valuemax={SECTIONS.length} aria-valuenow={step + 1} aria-label="Postęp wypełniania ogłoszenia">
            <div className={styles.progressFill} style={{ width: `${progress}%` }} />
          </div>
        </nav>
      </div>
    <form ref={formRef} onSubmit={(event) => { if (step < lastStep) { event.preventDefault(); goNext(); return } handleSubmit(event) }} className={styles.form}>
      {profileError && <p ref={errorRef} tabIndex={-1} role="alert" className={styles.error}>{profileError}</p>}
      {existing?.status === 'pending' && (
        <div className={`${styles.notice} ${styles.noticePending}`}>
          <strong>Zgłoszenie czeka na weryfikację</strong>
          Możesz je poniżej zaktualizować — wyślij ponownie, aby zapisać zmiany.
        </div>
      )}

      <div key={step} className={styles.stepPanel} data-direction={direction}>
      {step === 0 && <FormSection aside={stepAside} id="identity" number="01" icon={UserRound} title="Daj się poznać" description="Zdjęcie i nazwa, które zobaczą Twoi przyszli uczniowie.">
        <div className={styles.identityLayout}>
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

          <div className={styles.identityActions}>
            <p>Zdjęcie i nazwa są zapisywane od razu, niezależnie od weryfikacji ogłoszenia.</p>
            <Button
              type="button"
              onClick={handleSavePublicProfile}
              disabled={profileSaving}
              variant="outline"
              className="min-h-11 shrink-0 font-semibold"
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
      </FormSection>}

      {step === 1 && <FormSection aside={stepAside} id="subjects" number="02" icon={BookOpen} title="Czego uczysz?" description="Wybierz przedmioty i poziomy, na których czujesz się najlepiej.">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-3 sm:col-span-2">
            <div className="flex flex-col gap-1">
              <p className="text-xs font-medium text-foreground">Dziedziny nauczania</p>
              <p className="text-xs text-muted-foreground">
                Zaznacz wszystkie dziedziny, pod którymi profil ma pojawiać się w filtrach giełdy.
              </p>
            </div>
            <div className={styles.choiceGrid}>
              {visibleCategories.map((c) => {
                const active = categoryIds.includes(c.id)
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => toggleCategory(c.id)}
                    aria-pressed={active}
                    className={styles.choice}
                  >
                    <span>{c.name}</span>
                    <span className={styles.choiceCheck} aria-hidden="true">{active && <Check size={12} />}</span>
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
            <label htmlFor="customSubjects" className="text-xs font-medium text-foreground">Dodatkowe tematy</label>
            <Input
              id="customSubjects"
              value={customSubjects}
              onChange={(e) => setCustomSubjects(e.target.value)}
              placeholder="np. Podstawy programowania, Statystyka, analiza arkuszy maturalnych"
            />
            <p className="text-xs text-muted-foreground">
              Wpisz po przecinku tylko te tematy, których nie ma na liście powyżej. Będą widoczne na profilu i przy rezerwacji.
            </p>
          </div>

          <div className="flex flex-col gap-3 sm:col-span-2">
            <div className="flex flex-col gap-1">
              <p className="text-xs font-medium text-foreground">Poziomy nauczania</p>
              <p className="text-xs text-muted-foreground">
                Zaznacz poziomy, na których prowadzisz zajęcia.
              </p>
            </div>
            <div className={styles.levelGrid}>
              {teachingLevels.map((level) => {
                const active = selectedTeachingLevels.includes(level.id)
                return (
                  <button
                    key={level.id}
                    type="button"
                    onClick={() => toggleTeachingLevel(level.id)}
                    aria-pressed={active}
                    className={styles.choice}
                  >
                    <span>{level.label}</span>
                    <span className={styles.choiceCheck} aria-hidden="true">{active && <Check size={12} />}</span>
                  </button>
                )
              })}
            </div>
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
            <Input id="specialty" required value={specialty} onChange={(e) => setSpecialty(e.target.value)} placeholder="np. Matematyka maturalna, konwersacje po angielsku, programowanie PLC" />
            <p className="text-xs text-muted-foreground">
              Krótko opisz, w czym się specjalizujesz. Ta informacja będzie widoczna przy Twoim profilu.
            </p>
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="location" className="text-xs font-medium text-foreground">Lokalizacja</label>
            <Input id="location" required value={location} onChange={(e) => setLocation(e.target.value)} placeholder="np. Warszawa" />
          </div>
          <div>
            <div className="flex flex-col gap-1.5">
              <label htmlFor="experience" className="text-xs font-medium text-foreground">Doświadczenie (lata)</label>
              <Input id="experience" type="number" min={0} required value={experience} onChange={(e) => setExperience(e.target.value)} />
            </div>
          </div>
        </div>

      </FormSection>}

      {step === 2 && <FormSection aside={stepAside} id="description" number="03" icon={FileText} title="Twoje podejście do nauki" description="Opowiedz, co wyróżnia Twoje lekcje i jak pomagasz osiągać cele.">
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

      </FormSection>}

      {step === 3 && <FormSection aside={stepAside} id="offer" number="04" icon={Clock} title="Lekcje na Twoich zasadach" description="Ustal stawkę i wybierz dostępne formaty spotkań.">
        <div className={styles.rateRow}>
          <div><label htmlFor="hourlyRate">Twoja stawka</label><p>Za standardową lekcję 60 minut</p></div>
          <div className={styles.rateInput}><Input id="hourlyRate" type="number" min={5} required value={hourlyRate} onChange={(e) => setHourlyRate(e.target.value)} /><span aria-hidden="true">zł / 60 min</span></div>
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
                  className={`${styles.choice} ${styles.durationChoice}`}
                >
                  <Clock size={16} aria-hidden="true" />{option.label}
                </button>
              )
            })}
          </div>
        </div>

        <div className={styles.offerOption}>
          <label className="flex items-start justify-between gap-4">
            <span>
              <span className="block text-sm font-semibold text-foreground">Lekcja próbna</span>
              <span className="mt-1 block text-xs leading-relaxed text-muted-foreground">
                Ustal długość i cenę pierwszego spotkania.
              </span>
            </span>
            <Switch checked={trialLessonEnabled} onCheckedChange={setTrialLessonEnabled} aria-label="Oferuję lekcję próbną" />
          </label>

          {trialLessonEnabled && (
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <div className="flex flex-col gap-1.5">
                <label htmlFor="trialLessonDuration" className="text-xs font-medium text-foreground">Długość lekcji próbnej</label>
                <select
                  id="trialLessonDuration"
                  required
                  value={trialLessonDuration}
                  onChange={(e) => setTrialLessonDuration(Number(e.target.value))}
                  className="h-10 w-full rounded-lg border border-input bg-transparent px-2.5 text-base outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 md:h-8 md:text-sm"
                >
                  {LESSON_DURATION_OPTIONS.map((option) => (
                    <option key={option.minutes} value={option.minutes}>{option.label}</option>
                  ))}
                </select>
              </div>
              <div className="flex flex-col gap-1.5">
                <label htmlFor="trialLessonPrice" className="text-xs font-medium text-foreground">Cena lekcji próbnej (zł)</label>
                <Input
                  id="trialLessonPrice"
                  type="number"
                  min={1}
                  step={1}
                  required
                  value={trialLessonPrice}
                  onChange={(e) => setTrialLessonPrice(e.target.value)}
                  placeholder="np. 50"
                />
              </div>
            </div>
          )}
        </div>

        <div className={styles.offerOption}>
          <div>
            <p className="text-sm font-semibold text-foreground">Regularna nauka w pakiecie</p>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
              Uczeń płaci za pakiet jednorazowo, a środki za poszczególne lekcje są rozliczane zgodnie z odbytymi lekcjami.
            </p>
          </div>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {[5, 10].map((size) => {
              const packageSize = size as LessonPackageSize
              const active = lessonPackageSizes.includes(packageSize)
              return (
                <button
                  key={packageSize}
                  type="button"
                  onClick={() => toggleLessonPackageSize(packageSize)}
                  aria-pressed={active}
                  className={`${styles.choice} ${styles.packageChoice}`}
                >
                  <span><strong>{packageSize}</strong> lekcji</span>
                  <span className={styles.choiceCheck} aria-hidden="true">{active && <Check size={12} />}</span>
                </button>
              )
            })}
          </div>
        </div>
      </FormSection>}

      {step === 4 && <FormSection aside={stepAside} id="availability" number="05" icon={CalendarDays} title="Twój tydzień, Twój rytm" description="Wybierz dni i przedziały, w których przyjmujesz rezerwacje.">
        <AvailabilityEditor activeDays={availability} hours={availabilityHours} fallback={{ start: availabilityStart, end: availabilityEnd }} onDaysChange={setAvailability} onHoursChange={setAvailabilityHours} />
      </FormSection>}
      </div>

      <div id="application-submit" className={styles.stepFooter}>
        {step === lastStep && <p className={styles.footerHint}>Ogłoszenie trafi do weryfikacji przed publikacją.</p>}
        <div className={styles.footerActions}>
          {step > 0 ? (
            <Button type="button" variant="outline" onClick={goBack} disabled={submitting} className={styles.backButton}>
              <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Wstecz
            </Button>
          ) : <span className={styles.footerSpacer} />}
          {step < lastStep ? (
            <Button key="next" type="button" onClick={goNext} className={styles.submitButton}>
              Dalej <ArrowRight className="ml-2 h-4 w-4" aria-hidden="true" />
            </Button>
          ) : (
            <Button key="submit" type="submit" disabled={submitting || profileSaving} className={styles.submitButton}>
              {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
              Wyślij do weryfikacji
            </Button>
          )}
        </div>
      </div>
    </form>
    </div>
  )
}
