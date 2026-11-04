import type { Metadata } from 'next'
import { Navbar } from '@/components/layout/navbar'
import { Footer } from '@/components/layout/footer'
import { ReportProblemForm } from '@/components/support/report-problem-form'
import { noIndexMetadata } from '@/lib/seo'

export const metadata: Metadata = noIndexMetadata('Zgłoś problem')

type SearchParams = Promise<{ typ?: string; id?: string; nazwa?: string }>

export default async function ReportProblemPage({ searchParams }: { searchParams: SearchParams }) {
  const { typ, id, nazwa } = await searchParams
  const kind = typ === 'profile' || typ === 'lesson' ? typ : undefined
  return (
    <>
      <Navbar />
      <main id="main-content" className="bg-background">
        <div className="mx-auto max-w-xl px-4 py-14 md:py-20">
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Zgłoś problem</h1>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            Napisz, co Cię niepokoi: profil, lekcja, treść albo zachowanie. Każde zgłoszenie czyta człowiek. Zasady ochrony dzieci opisujemy w{' '}
            <a href="/ochrona-maloletnich" className="text-foreground underline underline-offset-4 hover:text-primary">standardach ochrony małoletnich</a>.
          </p>
          <div className="mt-8">
            <ReportProblemForm targetKind={kind} targetId={id?.slice(0, 100)} targetName={nazwa?.slice(0, 80)} />
          </div>
        </div>
      </main>
      <Footer />
    </>
  )
}
