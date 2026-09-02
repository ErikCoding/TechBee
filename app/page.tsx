import { Navbar } from '@/components/layout/navbar'
import { Footer } from '@/components/layout/footer'
import { HeroSection } from '@/components/landing/hero-section'
import { HowItWorksSection } from '@/components/landing/how-it-works-section'
import { TeachersPreviewSection } from '@/components/landing/teachers-preview-section'
import { BenefitsSection } from '@/components/landing/benefits-section'
import { ProductExperienceSection } from '@/components/landing/product-experience-section'
import { CtaSection } from '@/components/landing/cta-section'

/**
 * Homepage composition.
 *
 * Six content sections between the shared navbar and footer, each one a
 * single idea, each inside the same `max-w-7xl` container the
 * marketplace and dashboards use:
 *
 *   hero          what this is + one search action
 *   experience    what the platform does around the lesson
 *   how it works  find → book → learn, as a left-rail timeline
 *   teachers      real cards from the real catalogue
 *   benefits      four real advantages
 *   cta           one closing action
 *
 * The homepage runs in the existing page-scoped dark treatment. Shared
 * UI still reads normal tokens (`--background`, `--card`, `--border`,
 * ...), and the redesign stays within that black Runbee style.
 */
export default function HomePage() {
  return (
    <>
      <div className="dark">
        <Navbar />
        <main id="main-content">
          <HeroSection />
          <ProductExperienceSection />
          <HowItWorksSection />
          <TeachersPreviewSection />
          <BenefitsSection />
          <CtaSection />
        </main>
      </div>
      <Footer />
    </>
  )
}
