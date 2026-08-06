import { collection, doc, getDoc, getDocs } from 'firebase/firestore'
import { categoriesData } from '@/data/categories.data'
import { collections, db, isFirebaseConfigured } from '@/lib/firebase'
import type { Category } from '@/lib/types'

// ─────────────────────────────────────────────────────────────
// Data-access layer for categories. Reads Firestore's `categories`
// collection once it's configured and seeded (see admin panel →
// Ustawienia → "Zasiej dane demo"); falls back to local mock data
// until then.
// ─────────────────────────────────────────────────────────────

export async function getCategories(): Promise<Category[]> {
  if (isFirebaseConfigured && db) {
    const snap = await getDocs(collection(db, collections.categories))
    if (!snap.empty) return snap.docs.map((d) => d.data() as Category)
  }
  return categoriesData
}

export async function getCategoryById(id: string): Promise<Category | undefined> {
  if (isFirebaseConfigured && db) {
    const snap = await getDoc(doc(db, collections.categories, id))
    if (snap.exists()) return snap.data() as Category
  }
  return categoriesData.find((c) => c.id === id)
}
