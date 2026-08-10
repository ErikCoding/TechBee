import { notFound } from 'next/navigation'
import { Navbar } from '@/components/layout/navbar'
import { Footer } from '@/components/layout/footer'
import { RequireAuth } from '@/components/auth/require-auth'
import { BackButton } from '@/components/shared/back-button'
import { TeacherBookingCalendar } from '@/components/teacher/teacher-booking-calendar'
import { getTeacherById, isTeacherApproved } from '@/services/teachers.service'

interface Props {
  params: Promise<{ id: string }>
  searchParams: Promise<{ bookingForId?: string; bookingForName?: string }>
}

export default async function BookLessonPage({ params, searchParams }: Props) {
  const { id } = await params
  const { bookingForId, bookingForName } = await searchParams
  const teacher = await getTeacherById(id)
  if (!teacher || !isTeacherApproved(teacher)) notFound()

  return (
    <>
      <Navbar />
      <main id="main-content" className="bg-background">
        <RequireAuth role={['student', 'parent']}>
          <div className="mx-auto max-w-2xl px-4 py-8 md:px-8">
            <BackButton fallbackHref={`/teacher/${teacher.id}`} />
            <div className="flex items-center gap-3">
              <div
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-sm font-bold text-white"
                style={{ backgroundColor: teacher.avatarColor }}
                aria-hidden="true"
              >
                {teacher.initials}
              </div>
              <div>
                <h1 className="text-xl font-bold text-foreground">
                  {bookingForName ? `Zarezerwuj lekcję dla ${bookingForName}` : `Zarezerwuj lekcję z ${teacher.name}`}
                </h1>
                <p className="text-sm text-muted-foreground">{teacher.specialty} · {teacher.hourlyRate} zł/godz.</p>
              </div>
            </div>

            <div className="mt-6">
              <TeacherBookingCalendar teacher={teacher} bookingFor={bookingForId && bookingForName ? { id: bookingForId, name: bookingForName } : undefined} />
            </div>
          </div>
        </RequireAuth>
      </main>
      <Footer />
    </>
  )
}
