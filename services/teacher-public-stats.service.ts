import 'server-only'

import { adminDb } from '@/lib/firebase-admin'
import { collections } from '@/lib/firebase'
import { computeTeacherPublicStatsFromLessons, type TeacherPublicStats } from '@/lib/teacher-public-stats'
import type { Lesson } from '@/lib/types'

export async function getTeacherPublicStats(teacherId: string): Promise<TeacherPublicStats> {
  if (!adminDb) return { lessons: 0, students: 0 }

  const snap = await adminDb
    .collection(collections.lessons)
    .where('teacherId', '==', teacherId)
    .where('status', '==', 'completed')
    .get()

  return computeTeacherPublicStatsFromLessons(
    snap.docs.map((doc) => doc.data() as Pick<Lesson, 'status' | 'studentId'>),
  )
}
