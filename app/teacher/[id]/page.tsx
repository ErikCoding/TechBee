import { notFound } from 'next/navigation'
import Link from 'next/link'
import {
  Star, MapPin, Clock, BadgeCheck, Users, BookOpen,
  CalendarDays, GraduationCap, ArrowLeft, Sparkles, MessageCircle,
} from 'lucide-react'
import { Navbar } from '@/components/layout/navbar'
import { Footer } from '@/components/layout/footer'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { StarRating } from '@/components/shared/star-rating'
import { BookLessonActions } from '@/components/teacher/book-lesson-actions'
import { getAllTeacherIds, getTeacherById, isTeacherApproved } from '@/services/teachers.service'

interface Props {
  params: Promise<{ id: string }>
  searchParams: Promise<{ bookingForId?: string; bookingForName?: string }>
}

export async function generateStaticParams() {
  const ids = await getAllTeacherIds()
  return ids.map((id) => ({ id }))
}

export default async function TeacherProfilePage({ params, searchParams }: Props) {
  const { id } = await params
  const { bookingForId, bookingForName } = await searchParams
  const teacher = await getTeacherById(id)
  if (!teacher || !isTeacherApproved(teacher)) notFound()
  const bookingFor = bookingForId && bookingForName ? { id: bookingForId, name: bookingForName } : undefined

  const dayLabels = ['Pon', 'Wt', 'Śr', 'Czw', 'Pt', 'Sob', 'Niedz']
  const dayKeys = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

  return (
    <>
      <Navbar />
      <main id="main-content" className="bg-background">
        {/* Profile hero band */}
        <div className="border-b border-border bg-card">
          <div className="mx-auto max-w-7xl px-4 pb-8 pt-6 md:px-8">
            <Link
              href="/marketplace"
              className="mb-5 inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              <ArrowLeft className="h-4 w-4" />
              Powrót do giełdy nauczycieli
            </Link>

            <div className="flex flex-col gap-6 sm:flex-row sm:items-start">
              <Avatar className="h-24 w-24 shrink-0 rounded-2xl text-2xl">
                <AvatarFallback color={teacher.avatarColor} className="rounded-2xl text-2xl">
                  {teacher.initials}
                </AvatarFallback>
              </Avatar>

              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="text-2xl font-bold text-foreground">{teacher.name}</h1>
                  {teacher.verified && (
                    <BadgeCheck className="h-5 w-5 text-primary" aria-label="Zweryfikowany nauczyciel" />
                  )}
                  {teacher.featured && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-accent px-2.5 py-1 text-[11px] font-semibold text-accent-foreground">
                      <Sparkles className="h-3 w-3" aria-hidden="true" />
                      Wyróżniony
                    </span>
                  )}
                </div>
                <p className="mt-1 text-muted-foreground">{teacher.specialty}</p>

                <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-sm text-muted-foreground">
                  <span className="flex items-center gap-1.5">
                    <Star className="h-3.5 w-3.5 fill-primary stroke-none" aria-hidden="true" />
                    <span className="font-semibold text-foreground">{teacher.rating.toFixed(1)}</span>
                    <span>({teacher.reviewCount} opinii)</span>
                  </span>
                  <span className="flex items-center gap-1.5">
                    <MapPin className="h-3.5 w-3.5" aria-hidden="true" />
                    {teacher.location}
                  </span>
                  <span className="flex items-center gap-1.5">
                    <Clock className="h-3.5 w-3.5" aria-hidden="true" />
                    Odpowiada {teacher.responseTime}
                  </span>
                </div>
              </div>

              {/* Price + primary CTA, always visible at top on desktop for immediate visibility */}
              <div className="hidden shrink-0 flex-col items-end gap-2 lg:flex">
                <div className="text-right">
                  <span className="text-2xl font-bold text-foreground">{teacher.hourlyRate} zł</span>
                  <span className="ml-1 text-sm text-muted-foreground">/godz.</span>
                </div>
              </div>
            </div>

            {/* Stats row */}
            <div className="mt-6 grid grid-cols-2 divide-x divide-border border-y border-border sm:grid-cols-4">
              {[
                { icon: Users, value: teacher.students, label: 'Uczniowie' },
                { icon: BookOpen, value: teacher.lessons.toLocaleString('pl-PL'), label: 'Lekcje' },
                { icon: CalendarDays, value: `${teacher.experience} lat`, label: 'Doświadczenie' },
                { icon: Star, value: `${teacher.completionRate}%`, label: 'Ukończenie' },
              ].map(({ icon: Icon, value, label }, i) => (
                <div key={label} className={`flex items-center gap-2.5 px-4 py-3.5 ${i >= 2 ? 'border-t sm:border-t-0' : ''}`}>
                  <Icon className="h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-foreground">{value}</div>
                    <div className="truncate text-[11px] text-muted-foreground">{label}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="mx-auto max-w-7xl px-4 py-8 md:px-8">
          <div className="grid gap-8 lg:grid-cols-3">
            {/* ── Left: main content ── */}
            <div className="flex flex-col gap-6 lg:col-span-2">
              {/* About + Skills combined */}
              <div className="overflow-hidden rounded-2xl border border-border">
                <div className="flex items-center gap-2 bg-muted/40 px-5 py-3.5">
                  <MessageCircle className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                  <h2 className="text-sm font-semibold text-foreground">O nauczycielu</h2>
                </div>
                <div className="flex flex-col gap-5 bg-card px-5 py-5">
                  <p className="text-sm leading-relaxed text-muted-foreground">{teacher.bio}</p>
                  <div className="flex flex-wrap gap-2">
                    {teacher.skills.map((skill) => (
                      <Badge key={skill} variant="secondary">{skill}</Badge>
                    ))}
                  </div>
                </div>
              </div>

              {/* Education */}
              <section className="overflow-hidden rounded-2xl border border-border">
                <div className="flex items-center gap-2 bg-muted/40 px-5 py-3.5">
                  <GraduationCap className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                  <h2 className="text-sm font-semibold text-foreground">Wykształcenie i certyfikaty</h2>
                </div>
                <div className="flex flex-col divide-y divide-border bg-card">
                  {teacher.education.map((edu) => (
                    <div key={edu.degree} className="flex items-center gap-3 px-5 py-3.5">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-accent">
                        <GraduationCap className="h-4 w-4 text-bee-yellow-dark" aria-hidden="true" />
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-foreground">{edu.degree}</p>
                        <p className="text-xs text-muted-foreground">{edu.institution} · {edu.year}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </section>

              {/* Reviews */}
              <section className="overflow-hidden rounded-2xl border border-border">
                <div className="flex items-center gap-2 bg-muted/40 px-5 py-3.5">
                  <Star className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                  <h2 className="min-w-0 flex-1 text-sm font-semibold text-foreground">Opinie uczniów</h2>
                  <div className="flex shrink-0 items-center gap-1.5">
                    <Star className="h-3.5 w-3.5 fill-primary stroke-none" aria-hidden="true" />
                    <span className="text-xs font-semibold text-foreground">{teacher.rating.toFixed(1)}</span>
                    <span className="text-xs text-muted-foreground">({teacher.reviewCount})</span>
                  </div>
                </div>
                {/*
                  States plainly what the number means. Each student holds
                  one opinion per teacher regardless of how many lessons
                  they take, so the count is reviewers — not reviews left
                  after individual lessons, which is what it used to be.
                */}
                <p className="border-b border-border bg-card px-5 py-2 text-[11px] text-muted-foreground">
                  Jedna opinia na ucznia — liczba powyżej to liczba różnych uczniów, którzy ocenili tego nauczyciela.
                </p>
                <div className="flex flex-col divide-y divide-border bg-card">
                  {teacher.reviews.map((review) => (
                    <article key={review.id} className="flex items-start gap-3 px-5 py-4">
                      <Avatar className="h-9 w-9 shrink-0">
                        <AvatarFallback color={review.authorColor} className="text-xs">
                          {review.authorInitials}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <p className="truncate text-sm font-semibold text-foreground">{review.author}</p>
                          <span className="shrink-0 text-xs text-muted-foreground">{review.date}</span>
                        </div>
                        <StarRating rating={review.rating} className="mt-1" />
                        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{review.comment}</p>
                      </div>
                    </article>
                  ))}
                </div>
              </section>
            </div>

            {/* ── Right: booking sidebar ── */}
            <aside className="flex flex-col gap-4">
              <div className="sticky top-20 flex flex-col gap-4">
                {/* Booking card — the primary conversion point, given the strongest visual weight on the page */}
                <div className="rounded-2xl border-2 border-primary/50 bg-card p-6 shadow-sm">
                  <div className="flex items-baseline justify-between">
                    <div>
                      <span className="text-3xl font-bold text-foreground">{teacher.hourlyRate} zł</span>
                      <span className="ml-1 text-sm text-muted-foreground">/godz.</span>
                    </div>
                    <Badge variant="secondary" className="text-xs">
                      {teacher.responseTime}
                    </Badge>
                  </div>

                  <BookLessonActions
                    teacherId={teacher.id}
                    teacherName={teacher.name}
                    teacherInitials={teacher.initials}
                    teacherAvatarColor={teacher.avatarColor}
                    specialty={teacher.specialty}
                    bookingFor={bookingFor}
                  />

                  <div className="mt-5 flex flex-col gap-2 border-t border-border pt-4 text-xs text-muted-foreground">
                    <div className="flex items-center justify-between">
                      <span>Wskaźnik ukończenia</span>
                      <span className="font-semibold text-foreground">{teacher.completionRate}%</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>Czas odpowiedzi</span>
                      <span className="font-semibold text-foreground">{teacher.responseTime}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>Doświadczenie</span>
                      <span className="font-semibold text-foreground">{teacher.experience} lat</span>
                    </div>
                  </div>
                </div>

                {/* Availability + Languages combined */}
                <div className="overflow-hidden rounded-2xl border border-border">
                  <div className="flex items-center gap-2 bg-muted/40 px-5 py-3.5">
                    <CalendarDays className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                    <h3 className="text-sm font-semibold text-foreground">Dostępność</h3>
                  </div>
                  <div className="flex flex-col gap-4 bg-card px-5 py-4">
                    <div className="flex flex-wrap gap-1.5">
                      {dayLabels.map((day, index) => (
                        <span
                          key={day}
                          className={
                            teacher.availability.includes(dayKeys[index])
                              ? 'rounded-lg bg-accent px-3 py-1.5 text-xs font-semibold text-accent-foreground'
                              : 'rounded-lg bg-muted px-3 py-1.5 text-xs text-muted-foreground/40'
                          }
                        >
                          {day}
                        </span>
                      ))}
                    </div>
                    <div className="flex flex-wrap gap-1.5 border-t border-border pt-4">
                      {teacher.languages.map((lang) => (
                        <Badge key={lang} variant="secondary">{lang}</Badge>
                      ))}
                    </div>
                  </div>
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
