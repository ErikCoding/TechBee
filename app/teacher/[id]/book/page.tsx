import { notFound } from 'next/navigation'
import { Navbar } from '@/components/layout/navbar'
import { Footer } from '@/components/layout/footer'
import { RequireAuth } from '@/components/auth/require-auth'
import { BackButton } from '@/components/shared/back-button'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
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
            <div className="flex items-center gap-3 rounded-2xl border border-border bg-card px-5 py-4">
              <Avatar className="h-11 w-11 shrink-0">
                <AvatarFallback color={teacher.avatarColor}>{teacher.initials}</AvatarFallback>
              </Avatar>
              <div>
                <h1 className="text-lg font-bold text-foreground sm:text-xl">
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
