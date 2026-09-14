import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { Navbar } from '@/components/layout/navbar'
import { Footer } from '@/components/layout/footer'
import { RequireAuth } from '@/components/auth/require-auth'
import { BackButton } from '@/components/shared/back-button'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { TeacherBookingCalendar } from '@/components/teacher/teacher-booking-calendar'
import { getCategories } from '@/services/categories.service'
import { getTeacherById, isTeacherApproved } from '@/services/teachers.service'
import { getTeacherCategoryIds, getTeacherCustomSubjects } from '@/lib/teacher-categories'
import { noIndexMetadata } from '@/lib/seo'

export const metadata: Metadata = noIndexMetadata('Rezerwacja lekcji')

interface Props {
  params: Promise<{ id: string }>
  searchParams: Promise<{ bookingForId?: string; bookingForName?: string }>
}

export default async function BookLessonPage({ params, searchParams }: Props) {
  const { id } = await params
  const { bookingForId, bookingForName } = await searchParams
  const [teacher, categories] = await Promise.all([getTeacherById(id), getCategories()])
  if (!teacher || !isTeacherApproved(teacher)) notFound()
  const categoryMap = new Map(categories.map((category) => [category.id, category.name]))
  const subjects = getTeacherCategoryIds(teacher).map((categoryId) => ({
    id: categoryId,
    name: categoryMap.get(categoryId) ?? categoryId,
  }))
  const customSubjects = getTeacherCustomSubjects(teacher).map((subject) => ({
    id: `custom:${subject}`,
    name: subject,
    custom: true,
  }))
  const bookingSubjects = [...subjects, ...customSubjects]

  return (
    <>
      <Navbar />
      <main id="main-content" className="bg-background">
        <RequireAuth role={['student', 'parent']}>
          <div className="mx-auto max-w-2xl px-4 py-8 md:px-8">
            <BackButton fallbackHref={`/teacher/${teacher.id}`} />
            <div className="flex items-center gap-3 rounded-2xl border border-border bg-card px-5 py-4">
              <Avatar className="h-11 w-11 shrink-0">
                {teacher.photoUrl && <AvatarImage src={teacher.photoUrl} alt="" />}
                <AvatarFallback color={teacher.avatarColor}>{teacher.initials}</AvatarFallback>
              </Avatar>
              <div>
                <h1 className="text-lg font-bold text-foreground sm:text-xl">
                  {bookingForName ? `Zarezerwuj lekcję dla ${bookingForName}` : `Zarezerwuj lekcję z ${teacher.name}`}
                </h1>
                <p className="text-sm text-muted-foreground">
                  {bookingSubjects.length > 1 ? `${bookingSubjects.length} przedmioty do wyboru` : teacher.specialty} · {teacher.hourlyRate} zł/godz.
                </p>
              </div>
            </div>

            <div className="mt-6">
              <TeacherBookingCalendar
                teacher={teacher}
                subjects={bookingSubjects}
                bookingFor={bookingForId && bookingForName ? { id: bookingForId, name: bookingForName } : undefined}
              />
            </div>
          </div>
        </RequireAuth>
      </main>
      <Footer />
    </>
  )
}
