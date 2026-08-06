import { doc, writeBatch } from 'firebase/firestore'
import { categoriesData } from '@/data/categories.data'
import { teachersData } from '@/data/teachers.data'
import { testimonialsData } from '@/data/testimonials.data'
import { faqData } from '@/data/faq.data'
import { collections, db, isFirebaseConfigured } from '@/lib/firebase'

// ─────────────────────────────────────────────────────────────
// One-off seeding: pushes the platform's static demo catalog
// (categories, teachers, testimonials, FAQ) into Firestore so a
// freshly connected project isn't empty. Uses the already
// authenticated client SDK — no service-account key needed — so
// it's exposed as a button in the admin panel rather than a script.
// Safe to run more than once: every document uses a stable id, so
// re-running just overwrites with the same content.
// ─────────────────────────────────────────────────────────────

export interface SeedResult {
  collection: string
  count: number
}

export async function seedFirestoreDemoData(): Promise<SeedResult[]> {
  if (!isFirebaseConfigured || !db) {
    throw new Error('Firebase nie jest skonfigurowane — uzupełnij .env.local, aby zasiać dane.')
  }

  const results: SeedResult[] = []
  const batch = writeBatch(db)

  for (const category of categoriesData) {
    batch.set(doc(db, collections.categories, category.id), category)
  }
  results.push({ collection: collections.categories, count: categoriesData.length })

  for (const teacher of teachersData) {
    batch.set(doc(db, collections.teachers, teacher.id), teacher)
  }
  results.push({ collection: collections.teachers, count: teachersData.length })

  for (const testimonial of testimonialsData) {
    batch.set(doc(db, collections.testimonials, testimonial.id), testimonial)
  }
  results.push({ collection: collections.testimonials, count: testimonialsData.length })

  faqData.forEach((item, i) => {
    batch.set(doc(db!, collections.faq, `faq-${i}`), item)
  })
  results.push({ collection: collections.faq, count: faqData.length })

  await batch.commit()
  return results
}
