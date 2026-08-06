import { notFound } from 'next/navigation'
import Link from 'next/link'
import {
  Star, MapPin, Clock, BadgeCheck, Users, BookOpen,
  CalendarDays, GraduationCap, ArrowLeft
} from 'lucide-react'
import { Navbar } from '@/components/layout/navbar'
import { Footer } from '@/components/layout/footer'
import { Badge } from '@/components/ui/badge'
import { StarRating } from '@/components/shared/star-rating'
import { BookLessonActions } from '@/components/teacher/book-lesson-actions'
import { getAllTeacherIds, getTeacherById, isTeacherApproved } from '@/services/teachers.service'

interface Props {
  params: Promise<{ id: string }>
}

export async function generateStaticParams() {
  const ids = await getAllTeacherIds()
  return ids.map((id) => ({ id }))
}

export default async function TeacherProfilePage({ params }: Props) {
  const { id } = await params
  const teacher = await getTeacherById(id)
  if (!teacher || !isTeacherApproved(teacher)) notFound()

  return (
    <>
      <Navbar />
      <main id="main-content" className="bg-background">
        <div className="mx-auto max-w-7xl px-4 py-8 md:px-8">
          {/* Back */}
          <Link
            href="/marketplace"
            className="mb-6 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Powrót do giełdy nauczycieli
          </Link>

          <div className="grid gap-8 lg:grid-cols-3">
            {/* ── Left: main content ── */}
            <div className="flex flex-col gap-8 lg:col-span-2">
              {/* Profile header */}
              <div className="rounded-2xl border border-border bg-card p-6 animate-fade-in-up">
                <div className="flex flex-col gap-5 sm:flex-row sm:items-start">
                  <div
                    className="flex h-20 w-20 shrink-0 items-center justify-center rounded-2xl text-2xl font-bold text-white shadow-sm"
                    style={{ backgroundColor: teacher.avatarColor }}
                    aria-hidden="true"
                  >
                    {teacher.initials}
                  </div>
                  <div className="flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h1 className="text-2xl font-bold text-foreground">{teacher.name}</h1>
                      {teacher.verified && (
                        <BadgeCheck className="h-5 w-5 text-[#F4B400]" aria-label="Zweryfikowany nauczyciel" />
                      )}
                      {teacher.featured && (
                        <Badge className="bg-[#F4B400] text-[#0A0A0A] text-[11px]">
                          Wyróżniony
                        </Badge>
                      )}
                    </div>
                    <p className="mt-0.5 text-muted-foreground">{teacher.specialty}</p>

                    <div className="mt-3 flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
                      <span className="flex items-center gap-1.5">
                        <Star className="h-3.5 w-3.5 fill-[#F4B400] stroke-none" aria-hidden="true" />
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

                    {/* Stats row */}
                    <div className="mt-4 flex flex-wrap gap-5">
                      {[
                        { icon: Users, value: teacher.students, label: 'Uczniowie' },
                        { icon: BookOpen, value: teacher.lessons.toLocaleString('pl-PL'), label: 'Lekcje' },
                        { icon: CalendarDays, value: `${teacher.experience} lat`, label: 'Doświadczenie' },
                        { icon: Star, value: `${teacher.completionRate}%`, label: 'Ukończenie' },
                      ].map(({ icon: Icon, value, label }) => (
                        <div key={label} className="flex items-center gap-2">
                          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-muted">
                            <Icon className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
                          </div>
                          <div>
                            <div className="text-sm font-semibold text-foreground">{value}</div>
                            <div className="text-[11px] text-muted-foreground">{label}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* About */}
              <div className="rounded-2xl border border-border bg-card p-6 animate-fade-in-up" style={{ animationDelay: '60ms' }}>
                <h2 className="font-semibold text-foreground">O nauczycielu</h2>
                <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{teacher.bio}</p>
              </div>

              {/* Skills */}
              <div className="rounded-2xl border border-border bg-card p-6 animate-fade-in-up" style={{ animationDelay: '100ms' }}>
                <h2 className="font-semibold text-foreground">Umiejętności i technologie</h2>
                <div className="mt-3 flex flex-wrap gap-2">
                  {teacher.skills.map((skill) => (
                    <Badge key={skill} variant="secondary">{skill}</Badge>
                  ))}
                </div>
              </div>

              {/* Education */}
              <div className="rounded-2xl border border-border bg-card p-6 animate-fade-in-up" style={{ animationDelay: '140ms' }}>
                <h2 className="font-semibold text-foreground">Wykształcenie i certyfikaty</h2>
                <div className="mt-4 flex flex-col gap-4">
                  {teacher.education.map((edu) => (
                    <div key={edu.degree} className="flex gap-3">
                      <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#FEF3C7] dark:bg-[#3B2800]">
                        <GraduationCap className="h-4 w-4 text-[#B45309] dark:text-[#FBBF24]" aria-hidden="true" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-foreground">{edu.degree}</p>
                        <p className="text-xs text-muted-foreground">{edu.institution} · {edu.year}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Reviews */}
              <div className="rounded-2xl border border-border bg-card p-6 animate-fade-in-up" style={{ animationDelay: '180ms' }}>
                <div className="flex items-center justify-between">
                  <h2 className="font-semibold text-foreground">Opinie uczniów</h2>
                  <div className="flex items-center gap-1.5">
                    <Star className="h-4 w-4 fill-[#F4B400] stroke-none" aria-hidden="true" />
                    <span className="font-semibold text-foreground">{teacher.rating.toFixed(1)}</span>
                    <span className="text-sm text-muted-foreground">({teacher.reviewCount})</span>
                  </div>
                </div>
                <div className="mt-5 flex flex-col gap-5">
                  {teacher.reviews.map((review) => (
                    <article key={review.id} className="border-b border-border pb-5 last:border-0 last:pb-0">
                      <div className="flex items-start gap-3">
                        <div
                          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white"
                          style={{ backgroundColor: review.authorColor }}
                          aria-hidden="true"
                        >
                          {review.authorInitials}
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center justify-between gap-2">
                            <p className="text-sm font-semibold text-foreground">{review.author}</p>
                            <span className="text-xs text-muted-foreground">{review.date}</span>
                          </div>
                          <StarRating rating={review.rating} className="mt-1" />
                          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{review.comment}</p>
                        </div>
                      </div>
                    </article>
                  ))}
                </div>
              </div>
            </div>

            {/* ── Right: booking sidebar ── */}
            <aside className="flex flex-col gap-4">
              <div className="sticky top-20 flex flex-col gap-4">
                {/* Booking card */}
                <div className="rounded-2xl border border-border bg-card p-6 shadow-sm animate-fade-in-up" style={{ animationDelay: '100ms' }}>
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
                  />

                  <div className="mt-5 flex flex-col gap-2 text-xs text-muted-foreground">
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

                {/* Availability */}
                <div className="rounded-2xl border border-border bg-card p-5 animate-fade-in-up" style={{ animationDelay: '140ms' }}>
                  <h3 className="text-sm font-semibold text-foreground">Dostępność</h3>
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {['Pon', 'Wt', 'Śr', 'Czw', 'Pt', 'Sob', 'Niedz'].map((day, index) => (
                      <span
                        key={day}
                        className={
                          teacher.availability.includes(['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'][index])
                            ? 'rounded-lg bg-[#FEF3C7] px-3 py-1.5 text-xs font-semibold text-[#78350F] dark:bg-[#3B2800] dark:text-[#FBBF24]'
                            : 'rounded-lg bg-muted px-3 py-1.5 text-xs text-muted-foreground/40'
                        }
                      >
                        {day}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Languages */}
                <div className="rounded-2xl border border-border bg-card p-5 animate-fade-in-up" style={{ animationDelay: '180ms' }}>
                  <h3 className="text-sm font-semibold text-foreground">Języki</h3>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {teacher.languages.map((lang) => (
                      <Badge key={lang} variant="secondary">{lang}</Badge>
                    ))}
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
