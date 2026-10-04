import { collection, getDocs, query, where } from 'firebase/firestore'
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
