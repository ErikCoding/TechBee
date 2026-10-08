import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import { Navbar } from '@/components/layout/navbar'
import { Footer } from '@/components/layout/footer'
import { RequireAuth } from '@/components/auth/require-auth'
import { BookingFlowProvider } from '@/components/booking/booking-flow-provider'
import { BookingShell } from '@/components/booking/booking-shell'
import { getCategories } from '@/services/categories.service'
import { getTeacherById, isTeacherApproved } from '@/services/teachers.service'
import { getTeacherCategoryIds, getTeacherCustomSubjects } from '@/lib/teacher-categories'
import { noIndexMetadata } from '@/lib/seo'

export const metadata: Metadata = noIndexMetadata('Rezerwacja lekcji')
// Per-request teacher data; the old single /book page was dynamic through
// searchParams, this layout has none, so say so explicitly.
export const dynamic = 'force-dynamic'

export default async function BookLayout({ children, params }: { children: ReactNode; params: Promise<{ id: string }> }) {
  const { id } = await params
  const [teacher, categories] = await Promise.all([getTeacherById(id), getCategories()])
  if (!teacher || !isTeacherApproved(teacher)) notFound()
  const categoryMap = new Map(categories.map((category) => [category.id, category.name]))
  const subjects = [
    ...getTeacherCategoryIds(teacher).map((categoryId) => ({ id: categoryId, name: categoryMap.get(categoryId) ?? categoryId })),
    ...getTeacherCustomSubjects(teacher).map((subject) => ({ id: `custom:${subject}`, name: subject, custom: true })),
  ]

  return (
    <>
      <Navbar />
      <main id="main-content" className="bg-background">
        <RequireAuth role={['student', 'parent']}>
          <BookingFlowProvider teacher={teacher} subjects={subjects}>
            <BookingShell>{children}</BookingShell>
          </BookingFlowProvider>
        </RequireAuth>
      </main>
      <Footer />
    </>
  )
}
