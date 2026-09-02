import { Navbar } from '@/components/layout/navbar'
import { Footer } from '@/components/layout/footer'

interface LegalPageProps {
  title: string
  updated: string
  intro?: string
  children: React.ReactNode
}

/**
 * Shared layout for /terms, /privacy, /cookies — consistent typography
 * without pulling in a markdown/typography plugin. Content is written
 * as plain JSX sections (see each page for the actual legal copy).
 */
export function LegalPage({ title, updated, intro, children }: LegalPageProps) {
  return (
    <>
      <Navbar />
      <main id="main-content" className="bg-background">
        <div className="mx-auto max-w-3xl px-4 py-14 md:px-8 md:py-20">
          <p className="text-sm font-semibold text-primary uppercase tracking-wide">Dokument prawny</p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight text-foreground md:text-4xl">{title}</h1>
          <p className="mt-2 text-sm text-muted-foreground">Ostatnia aktualizacja: {updated}</p>
          {intro && <p className="mt-5 text-sm leading-relaxed text-muted-foreground">{intro}</p>}
          <div className="mt-10 flex flex-col gap-8 [&_h2]:text-lg [&_h2]:font-semibold [&_h2]:text-foreground [&_p]:text-sm [&_p]:leading-relaxed [&_p]:text-muted-foreground [&_li]:text-sm [&_li]:leading-relaxed [&_li]:text-muted-foreground [&_ol]:list-decimal [&_ol]:pl-5 [&_ol]:flex [&_ol]:flex-col [&_ol]:gap-1.5 [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:flex [&_ul]:flex-col [&_ul]:gap-1.5 [&_section]:flex [&_section]:flex-col [&_section]:gap-2">
            {children}
          </div>
        </div>
      </main>
      <Footer />
    </>
  )
}
