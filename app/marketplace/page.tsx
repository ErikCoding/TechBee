import { Navbar } from '@/components/layout/navbar'
import { Footer } from '@/components/layout/footer'
import { MarketplaceClient } from '@/components/marketplace/marketplace-client'
import { getTeachers } from '@/services/teachers.service'
import { getCategories } from '@/services/categories.service'

interface MarketplacePageProps {
  searchParams: Promise<{ q?: string; category?: string; bookingForId?: string; bookingForName?: string }>
}

export default async function MarketplacePage({ searchParams }: MarketplacePageProps) {
  const [teachers, categories, params] = await Promise.all([
    getTeachers(),
    getCategories(),
    searchParams,
  ])

  return (
    <>
      <Navbar />
      <main id="main-content">
        <MarketplaceClient
          teachers={teachers}
          categories={categories}
          initialQuery={params.q ?? ''}
          initialCategory={params.category}
          bookingFor={params.bookingForId && params.bookingForName ? { id: params.bookingForId, name: params.bookingForName } : undefined}
        />
      </main>
      <Footer />
    </>
  )
}
