export type TeacherPublicStats = {
  lessons: number
  students: number
}

type PublicStatsLesson = {
  status?: string
  studentId?: string | null
}

export function computeTeacherPublicStatsFromLessons(lessons: PublicStatsLesson[]): TeacherPublicStats {
  const completedLessons = lessons.filter((lesson) => lesson.status === 'completed')
  const studentIds = new Set(
    completedLessons
      .map((lesson) => lesson.studentId)
      .filter((studentId): studentId is string => Boolean(studentId)),
  )

  return {
    lessons: completedLessons.length,
    students: studentIds.size,
  }
}
