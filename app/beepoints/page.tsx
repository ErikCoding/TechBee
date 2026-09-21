import type { Metadata } from 'next'
import { Award, Bell, Sparkles } from 'lucide-react'
import { Navbar } from '@/components/layout/navbar'
import { Footer } from '@/components/layout/footer'
import { Badge } from '@/components/ui/badge'
import { RequireAuth } from '@/components/auth/require-auth'
import { BackButton } from '@/components/shared/back-button'
import { noIndexMetadata } from '@/lib/seo'

export const metadata: Metadata = noIndexMetadata('BeePoints')

export default function BeePointsPage() {
  return (
    <>
      <Navbar />
      <main id="main-content" className="bg-background">
        <RequireAuth>
          <div className="mx-auto max-w-4xl px-4 py-8 md:px-8">
            <BackButton />
            <h1 className="text-2xl font-bold text-foreground">BeePoints</h1>
            <p className="mt-0.5 text-muted-foreground">
              Program punktów i nagród dla uczniów Runbee
            </p>

            <section className="animate-fade-in-up mt-6 overflow-hidden rounded-2xl border border-border bg-card">
              <div className="border-b border-border bg-muted/30 px-5 py-4">
                <Badge variant="secondary" className="gap-1.5">
                  <Bell className="h-3.5 w-3.5" aria-hidden="true" />
                  W przygotowaniu
                </Badge>
              </div>
              <div className="grid gap-6 p-6 md:grid-cols-[minmax(0,1fr)_220px] md:items-center">
                <div>
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-accent text-accent-foreground">
                    <Award className="h-6 w-6" aria-hidden="true" />
                  </div>
                  <h2 className="mt-5 text-xl font-semibold text-foreground">
                    BeePoints nie są jeszcze aktywne
                  </h2>
                  <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
                    Pracujemy nad systemem punktów, poziomów i nagród. Na razie punkty nie są naliczane, nie można ich wymieniać i nie wpływają na płatności ani rezerwacje.
                  </p>
                  <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted-foreground">
                    Gdy program wystartuje, pokażemy tutaj saldo, historię zdobywania punktów oraz jasne zasady korzystania z nagród.
                  </p>
                </div>

                <div className="rounded-xl border border-border bg-background/70 p-4">
                  <Sparkles className="h-5 w-5 text-primary" aria-hidden="true" />
                  <p className="mt-3 text-sm font-semibold text-foreground">Co będzie później?</p>
                  <ul className="mt-3 flex flex-col gap-2 text-xs leading-relaxed text-muted-foreground">
                    <li>punkty za ukończone lekcje</li>
                    <li>poziomy aktywności ucznia</li>
                    <li>nagrody i zniżki po uruchomieniu programu</li>
                  </ul>
                </div>
              </div>
            </section>
          </div>
        </RequireAuth>
      </main>
      <Footer />
    </>
  )
}
