import { notFound } from 'next/navigation'
import { formatAvailabilityDay } from '@/lib/availability-core'
import Link from 'next/link'
import type { Metadata } from 'next'
import {
  Star, MapPin, Clock, BadgeCheck, Users, BookOpen,
  CalendarDays, GraduationCap, ArrowLeft, Sparkles, MessageCircle, ShieldCheck, Languages,
} from 'lucide-react'
import { Navbar } from '@/components/layout/navbar'
import { Footer } from '@/components/layout/footer'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { StarRating } from '@/components/shared/star-rating'
import { BookLessonActions } from '@/components/teacher/book-lesson-actions'
import { getCategories } from '@/services/categories.service'
import { getAllTeacherIds, getTeacherById, isTeacherApproved } from '@/services/teachers.service'
import { getTeacherPublicStats } from '@/services/teacher-public-stats.service'
import { formatLessonDurations } from '@/lib/lesson-durations'
import { fromGrosze, toGrosze } from '@/lib/stripe-config'
import { buildStudentPaymentBreakdown } from '@/lib/service-fees'
import { getTeacherCategoryIds, getTeacherCustomSubjects } from '@/lib/teacher-categories'
import { normalizeTeachingLevels, teachingLevelLabel } from '@/lib/teaching-levels'
import { absoluteUrl, noIndexMetadata, pageMetadata } from '@/lib/seo'
import type { WeekdayCode } from '@/lib/types'
import styles from './teacher-profile.module.css'

// This page reads `searchParams` (bookingForId/bookingForName — the
// "book for this student" deep link from a parent's dashboard), which
// requires per-request rendering. Combined with `generateStaticParams`
// below, that combination throws `DYNAMIC_SERVER_USAGE` in production
// (Next.js can't reconcile "pre-render this statically" with "this
// specific render depends on the incoming request's query string").
// Forcing dynamic rendering — same fix already used on app/page.tsx,
// app/teach/page.tsx and app/about/page.tsx — resolves it: every
// request renders fresh (fine here, teacher profiles already need to
// reflect live rating/price/availability anyway).
export const dynamic = 'force-dynamic'

interface Props {
  params: Promise<{ id: string }>
  searchParams: Promise<{ bookingForId?: string; bookingForName?: string }>
}

export async function generateStaticParams() {
  const ids = await getAllTeacherIds()
  return ids.map((id) => ({ id }))
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params
  const teacher = await getTeacherById(id)
  if (!teacher || !isTeacherApproved(teacher)) return noIndexMetadata('Nauczyciel nie znaleziony')

  return pageMetadata({
    title: `${teacher.name} — ${teacher.specialty}`,
    description: `${teacher.name} prowadzi indywidualne lekcje online: ${teacher.specialty}. Stawka ${teacher.hourlyRate} zł/godz., ocena ${teacher.rating.toFixed(1)} na podstawie ${teacher.reviewCount} opinii.`,
    path: `/teacher/${teacher.id}`,
    image: teacher.photoUrl ?? '/og-image.png',
  })
}

function jsonLd(data: unknown): string {
  return JSON.stringify(data).replace(/</g, '\\u003c')
}

function localImageUrl(path?: string): string | undefined {
  if (!path?.startsWith('/')) return undefined
  return absoluteUrl(path)
}

function pln(grosze: number): string {
  return `${fromGrosze(grosze).toLocaleString('pl-PL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} zł`
}

export default async function TeacherProfilePage({ params, searchParams }: Props) {
  const { id } = await params
  const { bookingForId, bookingForName } = await searchParams
  const [teacher, categories] = await Promise.all([getTeacherById(id), getCategories()])
  if (!teacher || !isTeacherApproved(teacher)) notFound()
  const teacherStats = await getTeacherPublicStats(teacher.id)
  const bookingFor = bookingForId && bookingForName ? { id: bookingForId, name: bookingForName } : undefined
  const categoryMap = new Map(categories.map((category) => [category.id, category.name]))
  const teacherCategories = [
    ...getTeacherCategoryIds(teacher).map((categoryId) => categoryMap.get(categoryId) ?? categoryId),
    ...getTeacherCustomSubjects(teacher),
  ]
  const teacherTeachingLevels = normalizeTeachingLevels(teacher.teachingLevels)
  const hourlyPayment = buildStudentPaymentBreakdown(toGrosze(teacher.hourlyRate))
  const profileUrl = absoluteUrl(`/teacher/${teacher.id}`)
  const teacherDescription = teacher.shortBio || teacher.bio
  const teacherImage = localImageUrl(teacher.photoUrl)
  const completionRateLabel = teacherStats.lessons > 0 ? `${teacher.completionRate}%` : 'Brak danych'
  const knowsAbout = [...new Set([teacher.specialty, ...teacherCategories, ...teacher.skills].filter(Boolean))]
  const structuredData = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'ProfilePage',
        '@id': `${profileUrl}#profile`,
        url: profileUrl,
        name: `${teacher.name} — ${teacher.specialty}`,
        description: teacherDescription,
        mainEntity: {
          '@id': `${profileUrl}#person`,
        },
      },
      {
        '@type': 'Person',
        '@id': `${profileUrl}#person`,
        name: teacher.name,
        ...(teacherImage ? { image: teacherImage } : {}),
        description: teacherDescription,
        url: profileUrl,
        ...(knowsAbout.length > 0 ? { knowsAbout } : {}),
      },
      {
        '@type': 'BreadcrumbList',
        '@id': `${profileUrl}#breadcrumb`,
        itemListElement: [
          {
            '@type': 'ListItem',
            position: 1,
            name: 'Runbee',
            item: absoluteUrl('/'),
          },
          {
            '@type': 'ListItem',
            position: 2,
            name: 'Marketplace',
            item: absoluteUrl('/marketplace'),
          },
          {
            '@type': 'ListItem',
            position: 3,
            name: teacher.name,
            item: profileUrl,
          },
        ],
      },
    ],
  }

  const dayLabels = ['Pon', 'Wt', 'Śr', 'Czw', 'Pt', 'Sob', 'Niedz']
  const dayKeys: WeekdayCode[] = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
  const availabilitySummary = teacher.availabilityHours
    ? dayKeys
        .filter((day) => teacher.availability.includes(day))
        .map((day) => {
          const hours = teacher.availabilityHours?.[day]
          return hours ? `${dayLabels[dayKeys.indexOf(day)]} ${formatAvailabilityDay(day, teacher)}` : null
        })
        .filter(Boolean)
        .join(', ')
    : teacher.availabilityStart && teacher.availabilityEnd
      ? `${teacher.availabilityStart}-${teacher.availabilityEnd}`
      : ''

  const stats = [
    { icon: Users, value: teacherStats.students.toLocaleString('pl-PL'), label: 'Uczniów' },
    { icon: BookOpen, value: teacherStats.lessons.toLocaleString('pl-PL'), label: 'Lekcji' },
    { icon: CalendarDays, value: `${teacher.experience} lat`, label: 'Doświadczenia' },
    { icon: ShieldCheck, value: completionRateLabel, label: 'Ukończonych lekcji' },
  ]
  const cardClass = 'rounded-2xl border border-border bg-card/60'

  return (
    <>
      <Navbar />
      <main id="main-content" className="bg-background">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: jsonLd(structuredData) }}
        />

        {/* ── Hero ── */}
        <div className="relative overflow-hidden border-b border-border">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -top-32 left-1/2 h-72 w-[48rem] -translate-x-1/2 rounded-full bg-primary/10 blur-3xl"
          />
          <div className="relative mx-auto max-w-7xl px-4 pb-8 pt-6 md:px-8">
            <Link
              href="/marketplace"
              className="mb-6 inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              <ArrowLeft className="h-4 w-4" aria-hidden="true" />
              Powrót do giełdy nauczycieli
            </Link>

            <div className={styles.heroRow}>
              <div className={styles.avatarWrap}>
                <Avatar>
                  {teacher.photoUrl && <AvatarImage src={teacher.photoUrl} alt="" />}
                  <AvatarFallback color={teacher.avatarColor}>{teacher.initials}</AvatarFallback>
                </Avatar>
              </div>

              <div className={styles.heroMain}>
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="text-3xl font-bold tracking-tight text-foreground">{teacher.name}</h1>
                  {teacher.verified && (
                    <BadgeCheck className="h-6 w-6 text-primary" aria-label="Zweryfikowany nauczyciel" />
                  )}
                  {teacher.featured && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-1 text-[11px] font-semibold text-primary">
                      <Sparkles className="h-3 w-3" aria-hidden="true" />
                      Wyróżniony
                    </span>
                  )}
                </div>
                <p className="mt-1.5 max-w-3xl text-base text-muted-foreground">{teacher.specialty}</p>

                <div className="mt-4 flex flex-wrap items-center gap-2 text-sm">
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card/60 px-3 py-1.5">
                    <Star className="h-3.5 w-3.5 fill-primary stroke-none" aria-hidden="true" />
                    <span className="font-semibold text-foreground">{teacher.rating.toFixed(1)}</span>
                    <span className="text-muted-foreground">({teacher.reviewCount} opinii)</span>
                  </span>
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card/60 px-3 py-1.5 text-muted-foreground">
                    <MapPin className="h-3.5 w-3.5" aria-hidden="true" />
                    {teacher.location}
                  </span>
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card/60 px-3 py-1.5 text-muted-foreground">
                    <Clock className="h-3.5 w-3.5" aria-hidden="true" />
                    Odpowiada {teacher.responseTime}
                  </span>
                </div>

                {teacherCategories.length > 0 && (
                  <div className="mt-4 flex flex-wrap gap-1.5">
                    {teacherCategories.map((category) => (
                      <Badge key={category} variant="secondary">{category}</Badge>
                    ))}
                  </div>
                )}
                {teacherTeachingLevels.length > 0 && (
                  <div className="mt-3 flex flex-wrap items-center gap-1.5">
                    <span className="mr-1 text-xs font-medium text-muted-foreground">Poziomy:</span>
                    {teacherTeachingLevels.map((level) => (
                      <Badge key={level} variant="outline">{teachingLevelLabel(level)}</Badge>
                    ))}
                  </div>
                )}
              </div>

              {/* Phones: price + jump to booking, since the booking card sits below the content there */}
              <div className={styles.mobilePrice}>
                <div>
                  <p className="text-[11px] text-muted-foreground">Stawka za 60 min</p>
                  <p className="text-xl font-bold text-foreground">{pln(hourlyPayment.subtotalGrosze)}</p>
                </div>
                <a
                  href="#rezerwacja"
                  className="inline-flex h-11 items-center rounded-xl bg-primary px-5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
                >
                  Zarezerwuj
                </a>
              </div>
            </div>

            <div className="mt-8 grid grid-cols-2 gap-3 lg:grid-cols-4">
              {stats.map(({ icon: Icon, value, label }) => (
                <div key={label} className={`${cardClass} flex items-center gap-3 px-4 py-3.5`}>
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <Icon className="h-5 w-5" aria-hidden="true" />
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-lg font-bold leading-tight text-foreground">{value}</p>
                    <p className="truncate text-[11px] text-muted-foreground">{label}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="mx-auto max-w-7xl px-4 py-8 md:px-8">
          <div className={styles.layout}>
            {/* ── Left: main content ── */}
            <div className={styles.main}>
              <section id="o-nauczycielu" className={`${styles.card} scroll-mt-20`}>
                <h2 className="flex items-center gap-2 text-lg font-bold text-foreground">
                  <MessageCircle className="h-5 w-5 text-primary" aria-hidden="true" />
                  O nauczycielu
                </h2>
                <div className={styles.aboutBody}>
                  {teacher.shortBio && teacher.shortBio.trim() !== teacher.bio.trim() && (
                    <blockquote className={styles.quote}>{teacher.shortBio}</blockquote>
                  )}
                  <p className={styles.bio}>{teacher.bio}</p>
                  {teacher.skills.length > 0 && (
                    <div className={styles.skills}>
                      <p className={styles.label}>Umiejętności</p>
                      <div className={styles.chips}>
                        {teacher.skills.map((skill) => (
                          <Badge key={skill} variant="secondary">{skill}</Badge>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </section>

              {teacher.education.length > 0 && (
                <section id="wyksztalcenie" className={`${styles.card} scroll-mt-20`}>
                  <h2 className="flex items-center gap-2 text-lg font-bold text-foreground">
                    <GraduationCap className="h-5 w-5 text-primary" aria-hidden="true" />
                    Wykształcenie i certyfikaty
                  </h2>
                  <ol className="mt-5 flex flex-col">
                    {teacher.education.map((edu, index) => (
                      <li key={edu.degree} className="relative flex gap-4 pb-5 last:pb-0">
                        {index < teacher.education.length - 1 && (
                          <span aria-hidden="true" className="absolute left-[17px] top-9 h-[calc(100%-2rem)] w-px bg-border" />
                        )}
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                          <GraduationCap className="h-4 w-4" aria-hidden="true" />
                        </span>
                        <div className="min-w-0 pt-0.5">
                          <p className="text-sm font-semibold text-foreground">{edu.degree}</p>
                          <p className="text-xs text-muted-foreground">{edu.institution} · {edu.year}</p>
                        </div>
                      </li>
                    ))}
                  </ol>
                </section>
              )}

              <section id="opinie" className={`${styles.card} scroll-mt-20`}>
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <h2 className="flex items-center gap-2 text-lg font-bold text-foreground">
                    <Star className="h-5 w-5 text-primary" aria-hidden="true" />
                    Opinie uczniów
                  </h2>
                  <div className="flex items-center gap-3 rounded-xl border border-border bg-background/60 px-4 py-2">
                    <span className="text-2xl font-bold text-foreground">{teacher.rating.toFixed(1)}</span>
                    <div>
                      <StarRating rating={teacher.rating} />
                      <p className="mt-0.5 text-[11px] text-muted-foreground">{teacher.reviewCount} opinii</p>
                    </div>
                  </div>
                </div>
                {/*
                  States plainly what the number means. Each student holds
                  one opinion per teacher regardless of how many lessons
                  they take, so the count is reviewers — not reviews left
                  after individual lessons, which is what it used to be.
                */}
                <p className="mt-3 text-[11px] text-muted-foreground">
                  Jedna opinia na ucznia — liczba powyżej to liczba różnych uczniów, którzy ocenili tego nauczyciela.
                </p>
                {teacher.reviews.length === 0 ? (
                  <p className="mt-5 rounded-xl border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
                    Ten nauczyciel nie ma jeszcze opinii.
                  </p>
                ) : (
                  <div className="mt-5 grid gap-3 md:grid-cols-2">
                    {teacher.reviews.map((review) => (
                      <article key={review.id} className="flex flex-col gap-3 rounded-xl border border-border bg-background/60 p-4">
                        <div className="flex items-center gap-3">
                          <Avatar className="h-9 w-9 shrink-0">
                            {review.authorPhotoUrl && <AvatarImage src={review.authorPhotoUrl} alt="" />}
                            <AvatarFallback color={review.authorColor} className="text-xs">
                              {review.authorInitials}
                            </AvatarFallback>
                          </Avatar>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-semibold text-foreground">{review.author}</p>
                            <p className="text-[11px] text-muted-foreground">{review.date}</p>
                          </div>
                          <StarRating rating={review.rating} />
                        </div>
                        <p className="text-sm leading-relaxed text-muted-foreground">{review.comment}</p>
                      </article>
                    ))}
                  </div>
                )}
              </section>
            </div>

            {/* ── Right: booking sidebar ── */}
            <aside id="rezerwacja" className={styles.side}>
              <div className={styles.sideInner}>
                <div className="relative overflow-hidden rounded-2xl border border-primary/30 bg-card/60 p-6">
                  <div aria-hidden="true" className="pointer-events-none absolute -right-16 -top-16 h-40 w-40 rounded-full bg-primary/10 blur-2xl" />
                  <div className="relative">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-xs font-medium text-muted-foreground">Stawka nauczyciela</p>
                        <p className="mt-1">
                          <span className="text-4xl font-bold tracking-tight text-foreground">{pln(hourlyPayment.subtotalGrosze)}</span>
                          <span className="ml-1 text-sm text-muted-foreground">/60 min</span>
                        </p>
                        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                          Z opłatą serwisową: {pln(hourlyPayment.studentTotalGrosze)}
                        </p>
                      </div>
                      <Badge variant="secondary" className="shrink-0 text-xs">
                        {teacher.responseTime}
                      </Badge>
                    </div>

                    <BookLessonActions
                      teacherId={teacher.id}
                      teacherName={teacher.name}
                      teacherInitials={teacher.initials}
                      teacherAvatarColor={teacher.avatarColor}
                      teacherPhotoUrl={teacher.photoUrl}
                      specialty={teacher.specialty}
                      bookingFor={bookingFor}
                    />

                    <ul className="mt-5 flex flex-col gap-2.5 border-t border-border pt-4 text-xs">
                      <li className="flex items-center gap-2.5 text-muted-foreground">
                        <ShieldCheck className="h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
                        Wskaźnik ukończenia <span className="ml-auto font-semibold text-foreground">{completionRateLabel}</span>
                      </li>
                      <li className="flex items-center gap-2.5 text-muted-foreground">
                        <Clock className="h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
                        Czas odpowiedzi <span className="ml-auto font-semibold text-foreground">{teacher.responseTime}</span>
                      </li>
                      <li className="flex items-center gap-2.5 text-muted-foreground">
                        <CalendarDays className="h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
                        Doświadczenie <span className="ml-auto font-semibold text-foreground">{teacher.experience} lat</span>
                      </li>
                    </ul>
                  </div>
                </div>

                <div className={styles.availCard}>
                  <h3 className={styles.availTitle}>
                    <CalendarDays className="h-4 w-4 text-primary" aria-hidden="true" />
                    Dostępność
                  </h3>
                  <div className={styles.days}>
                    {dayLabels.map((day, index) => {
                      const active = teacher.availability.includes(dayKeys[index])
                      return (
                        <span
                          key={day}
                          aria-label={`${day}: ${active ? 'dostępny' : 'niedostępny'}`}
                          className={active ? `${styles.day} ${styles.dayOn}` : styles.day}
                        >
                          {day}
                        </span>
                      )
                    })}
                  </div>
                  {availabilitySummary && <p className={styles.hours}>{availabilitySummary}</p>}
                  <div className={styles.section}>
                    <p className={styles.sectionLabel}>Długość lekcji</p>
                    <p className={styles.sectionValue}>{formatLessonDurations(teacher.lessonDurations)}</p>
                  </div>
                  {teacher.languages.length > 0 && (
                    <div className={styles.section}>
                      <p className={styles.sectionLabel}>Języki</p>
                      <div className={styles.langs}>
                        {teacher.languages.map((lang) => (
                          <Badge key={lang} variant="secondary">{lang}</Badge>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </aside>
          </div>
        </div>
      </main>
      <Footer />
    </>
  )
}
