import 'server-only'

import { adminDb } from '@/lib/firebase-admin'
import { collections } from '@/lib/firebase'
import { getTeachers } from '@/services/teachers.service'
import type { Lesson, Teacher } from '@/lib/types'

export type PublicPlatformStats = {
  approvedTeachers: number
  verifiedTeachers: number
  activeStudents: number
  completedLessons: number
  bookedLessons: number
  liveLessonsNow: number
  avgRating: number
}

function isLiveNow(lesson: Pick<Lesson, 'scheduledStartAt' | 'duration' | 'status'>): boolean {
  if (lesson.status !== 'upcoming' || !lesson.scheduledStartAt) return false
  const now = Date.now()
  return now >= lesson.scheduledStartAt && now <= lesson.scheduledStartAt + (lesson.duration + 15) * 60 * 1000
}

function avgRating(teachers: Teacher[]) {
  const rated = teachers.filter((t) => t.reviewCount > 0 && t.rating > 0)
  if (rated.length === 0) return 0
  return Math.round((rated.reduce((sum, t) => sum + t.rating, 0) / rated.length) * 10) / 10
}

export async function getPublicPlatformStats(): Promise<PublicPlatformStats> {
  if (!adminDb) {
    const teachers = await getTeachers()
    return {
      approvedTeachers: teachers.length,
      verifiedTeachers: teachers.filter((t) => t.verified).length,
      activeStudents: 0,
      completedLessons: teachers.reduce((sum, t) => sum + (t.lessons ?? 0), 0),
      bookedLessons: 0,
      liveLessonsNow: 0,
      avgRating: avgRating(teachers),
    }
  }

  const [teachersSnap, usersSnap, lessonsSnap] = await Promise.all([
    adminDb.collection(collections.teachers).where('status', '==', 'approved').get(),
    adminDb.collection(collections.users).where('role', '==', 'student').get(),
    adminDb.collection(collections.lessons).get(),
  ])

  const teachers = teachersSnap.docs.map((d) => d.data() as Teacher)
  const lessons = lessonsSnap.docs.map((d) => d.data() as Lesson)

  return {
    approvedTeachers: teachers.length,
    verifiedTeachers: teachers.filter((t) => t.verified).length,
    activeStudents: usersSnap.size,
    completedLessons: lessons.filter((l) => l.status === 'completed').length,
    bookedLessons: lessons.filter((l) => l.status === 'pending' || l.status === 'upcoming').length,
    liveLessonsNow: lessons.filter(isLiveNow).length,
    avgRating: avgRating(teachers),
  }
}
