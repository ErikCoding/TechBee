import { collection, getDocs } from 'firebase/firestore'
import { faqData } from '@/data/faq.data'
import { collections, db, isFirebaseConfigured } from '@/lib/firebase'
import type { FaqItem } from '@/lib/types'

export async function getFaqItems(): Promise<FaqItem[]> {
  if (isFirebaseConfigured && db) {
    const snap = await getDocs(collection(db, collections.faq))
    if (!snap.empty) return snap.docs.map((d) => d.data() as FaqItem)
  }
  return faqData
}
