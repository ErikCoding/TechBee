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
          <div className="mx-auto max-w-4xl px-4 py-8 md:px-8">
            <BackButton fallbackHref="/dashboard/teacher" />
            <h1 className="text-2xl font-bold text-foreground">Profil nauczyciela</h1>
            <p className="mt-0.5 text-muted-foreground">
              Uzupełnij dane, aby po weryfikacji przez administratora pojawić się w giełdzie nauczycieli Runbee.
            </p>
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
