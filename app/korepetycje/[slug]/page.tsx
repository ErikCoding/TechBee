import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { Navbar } from '@/components/layout/navbar'
import { Footer } from '@/components/layout/footer'
import { TeacherCard } from '@/components/shared/teacher-card'
import { Button } from '@/components/ui/button'
import { getCategoryById } from '@/services/categories.service'
import { getTeachersByCategory } from '@/services/teachers.service'
import { absoluteUrl, noIndexMetadata, pageMetadata } from '@/lib/seo'
import { getSubjectPageBySlug, subjectPages } from '@/lib/subject-pages'

export const dynamic = 'force-dynamic'

type Props = {
  params: Promise<{ slug: string }>
}

export function generateStaticParams() {
  return subjectPages.map((page) => ({ slug: page.slug }))
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const subject = getSubjectPageBySlug(slug)
  if (!subject) return noIndexMetadata('Nie znaleziono przedmiotu')

  return pageMetadata({
    title: subject.title,
    description: subject.description,
    path: `/korepetycje/${subject.slug}`,
  })
}

function jsonLd(data: unknown): string {
  return JSON.stringify(data).replace(/</g, '\\u003c')
}

function teacherCountLabel(count: number): string {
  if (count === 0) return 'Nauczyciele pojawią się wkrótce'
  if (count === 1) return '1 dostępny nauczyciel'
  return `${count} dostępnych nauczycieli`
}

export default async function SubjectTutoringPage({ params }: Props) {
  const { slug } = await params
  const subject = getSubjectPageBySlug(slug)
  if (!subject) notFound()

  const [category, teachers] = await Promise.all([
    getCategoryById(subject.categoryId),
    getTeachersByCategory(subject.categoryId),
  ])

  const categoryName = category?.name ?? subject.name

  const pageUrl = absoluteUrl(`/korepetycje/${subject.slug}`)
  const structuredData = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    '@id': `${pageUrl}#breadcrumb`,
    itemListElement: [
      {
        '@type': 'ListItem',
        position: 1,
        name: 'Runbee',
        item: absoluteUrl('/'),
      },
      {
        '@type': 'ListItem',
        position: 2,
        name: 'Korepetycje',
        item: absoluteUrl('/marketplace'),
      },
      {
        '@type': 'ListItem',
        position: 3,
        name: subject.name,
        item: pageUrl,
      },
    ],
  }

  return (
    <>
      <Navbar />
      <main id="main-content" className="bg-background">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: jsonLd(structuredData) }}
        />

        <section className="border-b border-border bg-card">
          <div className="mx-auto max-w-7xl px-4 py-8 md:px-8 md:py-10">
            <Link
              href="/marketplace"
              className="mb-5 inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              <ArrowLeft className="h-4 w-4" aria-hidden="true" />
              Zobacz wszystkich korepetytorów
            </Link>

            <div className="max-w-3xl">
              <p className="text-sm font-medium text-primary">{categoryName}</p>
              <h1 className="mt-2 text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
                {subject.h1}
              </h1>
              <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted-foreground sm:text-base">
                {subject.lead}
              </p>
              <p className="mt-4 text-sm font-semibold text-foreground">
                {teacherCountLabel(teachers.length)}
              </p>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-4 py-8 md:px-8">
          <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <h2 className="text-base font-semibold text-foreground">
              Nauczyciele z kategorii {categoryName.toLowerCase()}
            </h2>
            <Link href="/marketplace">
              <Button variant="outline" size="sm">
                Zobacz wszystkich korepetytorów
              </Button>
            </Link>
          </div>

          {teachers.length > 0 ? (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {teachers.map((teacher, index) => (
                <div
                  key={teacher.id}
                  className="min-w-0 animate-fade-in-up"
                  style={{ animationDelay: `${Math.min(index, 8) * 40}ms` }}
                >
                  <TeacherCard teacher={teacher} featured={teacher.featured} className="h-full" />
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-lg border border-dashed border-border bg-card px-5 py-6">
              <p className="text-sm font-medium text-foreground">
                Aktualnie kompletujemy nauczycieli w tej kategorii.
              </p>
              <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
                Strona pozostaje dostępna, a gdy pojawią się publiczni korepetytorzy, ich profile
                zostaną pokazane tutaj automatycznie. Możesz też sprawdzić pozostałe dostępne
                korepetycje online na Runbee.
              </p>
            </div>
          )}
        </section>
      </main>
      <Footer />
    </>
  )
}
