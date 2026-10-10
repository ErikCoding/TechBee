export type ChatReportCardInput = {
  lessonId: string
  teacherName: string
  studentName: string
  topic: string
  price: number
  progressRating: number
  engagementRating: number
  homework?: string
  tutorNote?: string
  nextTopic?: string
  status: 'pending'
  confirmingPartyId: string
  managerIds: string[]
}

const str = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : '')
const rating = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? Math.min(5, Math.max(1, Math.round(v))) : 0)

/**
 * Normalises a report card sent by the teacher's browser. Identity/price
 * fields are NOT trusted here: the endpoint overwrites them from the real
 * lesson document. Status is always forced to "pending" — later status
 * changes go through the existing participant/admin update path.
 */
export function sanitizeChatReportCard(value: unknown): ChatReportCardInput | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined
  const v = value as Record<string, unknown>
  const lessonId = str(v.lessonId, 200)
  const topic = str(v.topic, 300)
  const confirmingPartyId = str(v.confirmingPartyId, 200)
  const progressRating = rating(v.progressRating)
  const engagementRating = rating(v.engagementRating)
  if (!lessonId || !topic || !confirmingPartyId || !progressRating || !engagementRating) return undefined
  const managerIds = Array.isArray(v.managerIds)
    ? [...new Set(v.managerIds.filter((id): id is string => typeof id === 'string' && id.length > 0 && id.length <= 200))].slice(0, 6)
    : []
  const homework = str(v.homework, 2000)
  const tutorNote = str(v.tutorNote, 4000)
  const nextTopic = str(v.nextTopic, 500)
  return {
    lessonId,
    teacherName: str(v.teacherName, 200),
    studentName: str(v.studentName, 200),
    topic,
    price: typeof v.price === 'number' && Number.isFinite(v.price) ? v.price : 0,
    progressRating,
    engagementRating,
    ...(homework ? { homework } : {}),
    ...(tutorNote ? { tutorNote } : {}),
    ...(nextTopic ? { nextTopic } : {}),
    status: 'pending',
    confirmingPartyId,
    managerIds: managerIds.length ? managerIds : [confirmingPartyId],
  }
}

/** Who may post a report card into a conversation: the lesson's own teacher, into a thread that also contains the student or the confirming party. */
export function canPostReportCard(input: {
  uid: string
  lesson: { teacherId?: unknown; studentId?: unknown; status?: unknown }
  conversationParticipantIds: string[]
  confirmingPartyId: string
}): boolean {
  const { lesson } = input
  if (lesson.teacherId !== input.uid || lesson.status !== 'completed') return false
  if (!input.conversationParticipantIds.includes(input.uid)) return false
  return input.conversationParticipantIds.includes(String(lesson.studentId ?? ''))
    || input.conversationParticipantIds.includes(input.confirmingPartyId)
}
