import { collection, doc, getDoc, getDocs, query, where } from 'firebase/firestore'
import { categoriesData, deprecatedCategoryIds } from '@/data/categories.data'
import { collections, db, isFirebaseConfigured } from '@/lib/firebase'
import { teacherMatchesCategory } from '@/lib/teacher-categories'
import type { Category } from '@/lib/types'

// ─────────────────────────────────────────────────────────────
// Data-access layer for categories. Reads Firestore's `categories`
// collection once it's configured and seeded (see admin panel →
// Ustawienia → "Zasiej dane demo"); falls back to local mock data
// until then.
// ─────────────────────────────────────────────────────────────

const deprecatedCategoryIdSet = new Set(deprecatedCategoryIds)

function sortCategories(categories: Category[]): Category[] {
  return [...categories].sort((a, b) => a.name.localeCompare(b.name, 'pl'))
}

export async function getCategories(): Promise<Category[]> {
  if (isFirebaseConfigured && db) {
    const [snap, teachersSnap] = await Promise.all([
      getDocs(collection(db, collections.categories)),
      getDocs(query(collection(db, collections.teachers), where('status', '==', 'approved'))),
    ])
    const currentIds = new Set(categoriesData.map((c) => c.id))
    const storedExtras = snap.docs
      .map((d) => d.data() as Category)
      .filter((category) => !currentIds.has(category.id) && !deprecatedCategoryIdSet.has(category.id))
    const approvedTeachers = teachersSnap.docs.map((d) => d.data() as { categoryId: string; categoryIds?: string[]; lessons?: number })
    const countFor = (categoryId: string) => ({
      teacherCount: approvedTeachers.filter((t) => teacherMatchesCategory(t, categoryId)).length,
      lessonCount: approvedTeachers.filter((t) => teacherMatchesCategory(t, categoryId)).reduce((sum, t) => sum + (t.lessons ?? 0), 0),
    })
    return sortCategories([...categoriesData, ...storedExtras].map((category) => ({
      ...category,
      ...countFor(category.id),
    })))
  }
  return sortCategories(categoriesData)
}

export async function getCategoryById(id: string): Promise<Category | undefined> {
  if (deprecatedCategoryIdSet.has(id)) return undefined
  const current = categoriesData.find((c) => c.id === id)
  if (current) return current
  if (isFirebaseConfigured && db) {
    const snap = await getDoc(doc(db, collections.categories, id))
    if (snap.exists()) return snap.data() as Category
  }
  return undefined
}
