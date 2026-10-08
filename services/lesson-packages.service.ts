import { collection, doc, getDoc, getDocs, query, where } from 'firebase/firestore'
import { auth, collections, db, isFirebaseConfigured } from '@/lib/firebase'
import type { LessonBookingInput, LessonPackage } from '@/lib/types'

async function getIdToken(): Promise<string | undefined> {
  return auth?.currentUser?.getIdToken().catch(() => undefined)
}

async function postJson<T>(path: string, body: Record<string, unknown>): Promise<T> {
  const idToken = await getIdToken()
  const res = await fetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...body, idToken }),
  })
  const data = await res.json().catch(() => ({}) as Record<string, unknown>)
  if (!res.ok) {
    throw new Error(typeof data.error === 'string' ? data.error : 'Coś poszło nie tak. Spróbuj ponownie.')
  }
  return data as T
}

export async function getStudentLessonPackagesForTeacher(studentId: string, teacherId: string): Promise<LessonPackage[]> {
  if (!isFirebaseConfigured || !db) return []
  const snap = await getDocs(query(
    collection(db, collections.lessonPackages),
    where('studentId', '==', studentId),
  ))
  return snap.docs
    .map((doc) => ({ id: doc.id, ...doc.data() }) as LessonPackage)
    .filter((pkg) => pkg.teacherId === teacherId && pkg.status === 'active' && pkg.remainingCredits > 0)
    .sort(compareLessonPackagesForUse)
}

export async function getStudentLessonPackages(studentId: string): Promise<LessonPackage[]> {
  if (!isFirebaseConfigured || !db) return []
  const snap = await getDocs(query(
    collection(db, collections.lessonPackages),
    where('studentId', '==', studentId),
  ))
  return snap.docs
    .map((doc) => ({ id: doc.id, ...doc.data() }) as LessonPackage)
    .sort(compareLessonPackagesForDisplay)
}

export async function getLessonPackage(packageId: string): Promise<LessonPackage | null> {
  if (!isFirebaseConfigured || !db) return null
  const snap = await getDoc(doc(db, collections.lessonPackages, packageId))
  if (!snap.exists()) return null
  return { id: snap.id, ...snap.data() } as LessonPackage
}

function compareLessonPackagesForDisplay(a: LessonPackage, b: LessonPackage): number {
  const statusRank = (pkg: LessonPackage) => pkg.status === 'active' ? 0 : pkg.status === 'exhausted' ? 1 : 2
  const statusDiff = statusRank(a) - statusRank(b)
  if (statusDiff !== 0) return statusDiff
  return (b.createdAt ?? 0) - (a.createdAt ?? 0)
}

function compareLessonPackagesForUse(a: LessonPackage, b: LessonPackage): number {
  const createdDiff = (a.createdAt ?? 0) - (b.createdAt ?? 0)
  if (createdDiff !== 0) return createdDiff
  return a.id.localeCompare(b.id)
}

export async function bookLessonWithPackageCredit(input: Omit<LessonBookingInput, 'price' | 'lessonKind'> & {
  packageId: string
  occurrenceCount?: number
  bookingRequestId?: string
}): Promise<{ lessonId: string; lessonIds?: string[]; recurringSeriesId?: string }> {
  return postJson('/api/lesson-packages/book', input)
}

export async function completePackageLessonCredit(lessonId: string): Promise<void> {
  await postJson(`/api/lesson-packages/lessons/${lessonId}/complete`, {})
}

export async function returnPackageLessonCredit(lessonId: string): Promise<void> {
  await postJson(`/api/lesson-packages/lessons/${lessonId}/cancel`, {})
}
