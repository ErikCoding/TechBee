import { collection, getDocs } from 'firebase/firestore'
import { testimonialsData } from '@/data/testimonials.data'
import { collections, db, isFirebaseConfigured } from '@/lib/firebase'
import type { Testimonial } from '@/lib/types'

export async function getTestimonials(): Promise<Testimonial[]> {
  if (isFirebaseConfigured && db) {
    const snap = await getDocs(collection(db, collections.testimonials))
    if (!snap.empty) return snap.docs.map((d) => d.data() as Testimonial)
  }
  return testimonialsData
}
