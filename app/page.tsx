import { Navbar } from '@/components/layout/navbar'
import { Footer } from '@/components/layout/footer'
import { HeroSection } from '@/components/landing/hero-section'
import { StatsSection } from '@/components/landing/stats-section'
import { CategoriesSection } from '@/components/landing/categories-section'
import { FeaturedTeachersSection } from '@/components/landing/featured-teachers-section'
import { HowItWorksSection } from '@/components/landing/how-it-works-section'
import { ForTeachersSection } from '@/components/landing/for-teachers-section'
import { TestimonialsSection } from '@/components/landing/testimonials-section'
import { FaqSection } from '@/components/landing/faq-section'
import { CtaSection } from '@/components/landing/cta-section'
import { getFaqItems } from '@/services/faq.service'

export default async function HomePage() {
  const faqItems = await getFaqItems()

  return (
    <>
      <Navbar />
      <main id="main-content">
        <HeroSection />
        <StatsSection />
        <CategoriesSection />
        <FeaturedTeachersSection />
        <HowItWorksSection />
        <ForTeachersSection />
        <TestimonialsSection />
        <FaqSection items={faqItems} />
        <CtaSection />
      </main>
      <Footer />
    </>
  )
}
