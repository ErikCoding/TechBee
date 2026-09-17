import type { Metadata } from 'next'
import { Navbar } from '@/components/layout/navbar'
import { Footer } from '@/components/layout/footer'
import { MarketplaceClient } from '@/components/marketplace/marketplace-client'
import { filtersFromParams } from '@/components/marketplace/marketplace-filters'
import { getTeachers } from '@/services/teachers.service'
import { getCategories } from '@/services/categories.service'
import { pageMetadata } from '@/lib/seo'

export const metadata: Metadata = pageMetadata({
  title: 'Giełda nauczycieli',
  description:
    'Znajdź zweryfikowanego nauczyciela z dowolnej dziedziny i zarezerwuj indywidualną lekcję online.',
  path: '/marketplace',
})

interface MarketplacePageProps {
  /**
   * `q`, `category`, `bookingForId` and `bookingForName` are the original
   * parameters — every existing link into the marketplace (homepage
   * search, category tiles, the parent "book for this child" flow, the
   * dashboards) keeps working untouched. The rest are new, optional
   * filter parameters added so a filtered view is shareable.
   */
  searchParams: Promise<{
    q?: string
    category?: string
    maxPrice?: string
    minRating?: string
    days?: string
    language?: string
    verified?: string
    sort?: string
    bookingForId?: string
    bookingForName?: string
  }>
}

export default async function MarketplacePage({ searchParams }: MarketplacePageProps) {
  const [teachers, categories, params] = await Promise.all([getTeachers(), getCategories(), searchParams])

  return (
    <>
      <Navbar />
      <main id="main-content" className="bg-background">
        <h1 className="sr-only">Znajdź korepetytora</h1>
        <MarketplaceClient
          teachers={teachers}
          categories={categories}
          initialFilters={filtersFromParams(params)}
          bookingFor={
            params.bookingForId && params.bookingForName
              ? { id: params.bookingForId, name: params.bookingForName }
              : undefined
          }
        />
      </main>
      <Footer />
    </>
  )
}
