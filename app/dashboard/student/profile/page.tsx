import { Navbar } from '@/components/layout/navbar'
import { Footer } from '@/components/layout/footer'
import { RequireAuth } from '@/components/auth/require-auth'
import { BackButton } from '@/components/shared/back-button'
import { UserProfileForm } from '@/components/profile/user-profile-form'

export default function StudentProfilePage() {
  return (
    <>
      <Navbar />
      <main id="main-content" className="bg-background">
        <RequireAuth role="student">
          <div className="mx-auto max-w-2xl px-4 py-8 md:px-8">
            <BackButton fallbackHref="/dashboard/student" />
            <h1 className="text-2xl font-bold text-foreground">Profil ucznia</h1>
            <p className="mt-0.5 text-muted-foreground">
              Zaktualizuj podstawowe dane i zdjęcie widoczne w panelu oraz rozmowach.
            </p>
            <div className="mt-6">
              <UserProfileForm />
            </div>
          </div>
        </RequireAuth>
      </main>
      <Footer />
    </>
  )
}
