import { Navbar } from '@/components/layout/navbar'
import { Footer } from '@/components/layout/footer'
import { RequireAuth } from '@/components/auth/require-auth'
import { BackButton } from '@/components/shared/back-button'
import { TeacherApplicationForm } from '@/components/teacher/teacher-application-form'

export default function TeacherApplyPage() {
  return (
    <>
      <Navbar />
      <main id="main-content" className="bg-background">
        <RequireAuth role="teacher">
          <div className="mx-auto max-w-[1184px] px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
            <BackButton fallbackHref="/dashboard/teacher" />
            <div className="mt-6">
              <TeacherApplicationForm />
            </div>
          </div>
        </RequireAuth>
      </main>
      <Footer />
    </>
  )
}
