// ─────────────────────────────────────────────────────────────
// TechBee — shared domain types
// Single source of truth for shapes used across data/, services/
// and UI components. Kept framework-agnostic on purpose so the
// same types will work once services/ start reading from
// Firestore instead of local mock data.
// ─────────────────────────────────────────────────────────────

export type UserRole = 'student' | 'teacher' | 'admin'

/** Roles a visitor can pick at /register — admin accounts are provisioned separately, not self-served. */
export type PublicUserRole = 'student' | 'teacher'

export type AuthUser = {
  id: string
  name: string
  firstName: string
  email: string
  role: UserRole
  initials: string
  avatarColor: string
}

export type Category = {
  id: string
  name: string
  icon: string
  description: string
  teacherCount: number
  lessonCount: number
  colorClass: string
}

export type ReviewItem = {
  id: string
  author: string
  authorInitials: string
  authorColor: string
  rating: number
  date: string
  comment: string
}

export type Teacher = {
  id: string
  name: string
  initials: string
  avatarColor: string
  specialty: string
  categoryId: string
  rating: number
  reviewCount: number
  hourlyRate: number
  location: string
  experience: number
  students: number
  lessons: number
  bio: string
  shortBio: string
  skills: string[]
  languages: string[]
  education: { degree: string; institution: string; year: number }[]
  reviews: ReviewItem[]
  availability: string[]
  /** Daily working-hours window (e.g. "09:00"–"17:00") the booking calendar generates real time slots from. Optional so legacy demo teachers without it fall back to a default range. */
  availabilityStart?: string
  availabilityEnd?: string
  verified: boolean
  featured: boolean
  responseTime: string
  completionRate: number
  /** Missing/undefined = treated as 'approved' (covers the original static demo catalog). Real applications start at 'pending'. */
  status?: 'pending' | 'approved' | 'rejected'
  /** Firebase Auth uid of the teacher who submitted this profile — set for real applications, absent on legacy demo entries. */
  authUserId?: string
  submittedAt?: number
}

/** Fields a teacher fills in on the "become a teacher" application form — everything else on Teacher is derived/admin-controlled. */
export type TeacherApplicationInput = {
  categoryId: string
  specialty: string
  hourlyRate: number
  location: string
  experience: number
  shortBio: string
  bio: string
  skills: string[]
  languages: string[]
  availability: string[]
  availabilityStart: string
  availabilityEnd: string
}

export type Testimonial = {
  id: string
  name: string
  role: string
  initials: string
  avatarColor: string
  rating: number
  comment: string
  teacherName: string
  specialty: string
}

export type FaqItem = {
  question: string
  answer: string
}

/**
 * Lifecycle: `pending` (booked, awaiting teacher confirmation) →
 * `upcoming` (teacher confirmed) → `completed` (call ended — this is
 * when payment actually moves from student to teacher, see
 * services/wallet.service.ts transferLessonPayment) or `cancelled`
 * (teacher rejected the booking, or approved a cancel request).
 */
export type LessonStatus = 'pending' | 'upcoming' | 'completed' | 'cancelled'

/** A student- or teacher-initiated request to cancel or reschedule an already-confirmed lesson — sits on the lesson until the *other* party accepts/rejects it via a real notification. */
export type LessonChangeRequest = {
  type: 'cancel' | 'reschedule'
  requestedBy: 'student' | 'teacher'
  newDate?: string
  newTime?: string
  note?: string
}

export type Lesson = {
  id: string
  teacherId: string
  studentId: string
  teacherName: string
  studentName: string
  teacherInitials: string
  teacherColor: string
  specialty: string
  date: string
  time: string
  duration: number
  status: LessonStatus
  price: number
  topic: string
  pendingChange?: LessonChangeRequest
  /** Real timestamps (unlike `date`/`time`, which are display-only strings) — what monthly earnings/lesson-count stats actually filter on. */
  createdAt?: number
  completedAt?: number
  /** Set once the student has left a review for this completed lesson — hides the "Oceń lekcję" prompt afterwards. */
  reviewed?: boolean
}

export type StudentStats = {
  totalLessons: number
  hoursLearned: number
  teachersWorkedWith: number
  certificatesEarned: number
  currentStreak: number
  beePoints: number
  techCoins: number
  progressByCategory: { category: string; progress: number; color: string }[]
}

/** Rating/earnings summary shown on the teacher dashboard header + sidebar. The lesson list itself is fetched separately (see getTeacherLessons) since it's real per-teacher Firestore data, not part of this demo/rating bundle. */
export type TeacherDashboardData = {
  name: string
  initials: string
  avatarColor: string
  specialty: string
  rating: number
  reviewCount: number
  monthlyEarnings: number
  totalEarnings: number
  studentsThisMonth: number
  lessonsThisMonth: number
  completionRate: number
  responseRate: number
  earningsChart: { month: string; amount: number }[]
}

export type Transaction = {
  id: string
  type: 'credit' | 'debit' | 'refund'
  description: string
  amount: number
  date: string
  status: 'completed' | 'pending' | 'failed'
}

export type WalletStats = {
  balance: number
  pending: number
  totalSpent: number
  totalTopups: number
}

export type BeePointsEvent = {
  id: string
  description: string
  points: number
  date: string
  type: 'earned' | 'redeemed'
}

export type BeePointsTier = {
  name: string
  icon: string
  minPoints: number
  maxPoints: number
  colorClass: string
  badgeClass: string
  benefits: string[]
}

export type BeePointsRule = {
  icon: string
  title: string
  points: string
  description: string
}

export type BeePointsStats = {
  currentPoints: number
  lifetimePoints: number
  currentTier: string
  nextTier: string
  pointsToNextTier: number
}

export type NotificationType = 'lesson' | 'payment' | 'review' | 'system' | 'beepoints'

export type Notification = {
  id: string
  type: NotificationType
  title: string
  description: string
  date: string
  read: boolean
}

export type AdminStats = {
  totalUsers: number
  totalTeachers: number
  totalStudents: number
  activeLessonsToday: number
  monthlyRevenue: number
  revenueChange: number
  newSignupsThisWeek: number
  pendingVerifications: number
  revenueChart: { month: string; amount: number }[]
  usersByRole: { role: string; count: number; color: string }[]
}

export type AdminUserRow = {
  id: string
  name: string
  initials: string
  avatarColor: string
  email: string
  role: 'student' | 'teacher' | 'admin'
  status: 'active' | 'pending' | 'suspended'
  joined: string
  lessons: number
}

/** Minimal identity of one side of a conversation — enough to render an avatar/name without a extra lookup. */
export type ChatParticipant = {
  id: string
  name: string
  initials: string
  avatarColor: string
  role: UserRole
  specialty?: string
}

export type ChatMessage = {
  id: string
  senderId: string
  text: string
  time: string
  createdAt: number
  attachment?: { name: string; size: string; kind: 'pdf' | 'image' | 'zip' | 'doc' }
}

/** A conversation summary from the current viewer's perspective — `participant` is always "the other person". */
export type ChatConversation = {
  id: string
  participant: ChatParticipant
  lastMessage: string
  lastMessageTime: string
  lastMessageAt: number
  unread: number
}

export type LessonBookingInput = {
  teacherId: string
  teacherName: string
  teacherInitials: string
  teacherColor: string
  specialty: string
  studentId: string
  studentName: string
  date: string
  time: string
  duration: number
  price: number
  topic: string
}
