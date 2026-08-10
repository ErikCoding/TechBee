// ─────────────────────────────────────────────────────────────
// TechBee — shared domain types
// Single source of truth for shapes used across data/, services/
// and UI components. Kept framework-agnostic on purpose so the
// same types will work once services/ start reading from
// Firestore instead of local mock data.
// ─────────────────────────────────────────────────────────────

export type UserRole = 'student' | 'teacher' | 'admin' | 'parent'

/** Roles a visitor can pick at /register — admin accounts are provisioned separately, not self-served. */
export type PublicUserRole = 'student' | 'teacher' | 'parent'

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
 * Lifecycle: `pending` (booked, escrow charge already held from the
 * payer's wallet — see holdLessonPayment in wallet.service.ts —
 * awaiting teacher confirmation) → `upcoming` (teacher confirmed) →
 * `completed` (call ended — the teacher still owes a report at this
 * point; payment stays held until the report is confirmed, see
 * LessonReport below) or `cancelled` (teacher rejected the booking,
 * or approved a cancel request — held funds are refunded).
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

/** The tutor's required last step after a lesson — submitting one starts the 24h confirmation window that ultimately releases the held payment (see Lesson.confirmingPartyId below). */
export type LessonReport = {
  topic: string
  progressRating: number
  engagementRating: number
  homework?: string
  tutorNote?: string
  nextTopic?: string
}

export type LessonDisputeReason = 'tutor_no_show' | 'not_as_described' | 'quality_issue' | 'other'

/** Raised instead of confirming a report — parks the lesson's held payment until an admin resolves it. */
export type LessonDispute = {
  reason: LessonDisputeReason
  note: string
  raisedBy: 'student' | 'parent'
  raisedByUserId: string
  raisedAt: number
  status: 'open' | 'resolved_teacher' | 'resolved_payer'
  resolutionNote?: string
  resolvedAt?: number
  resolvedByAdminId?: string
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

  // ── Escrow / report / confirmation (parent-account model) ──
  /** Who is financially responsible for this lesson — usually the student, but a linked parent can book/pay on the student's behalf instead. Defaults to the student when absent (legacy lessons booked before this existed). */
  payerId?: string
  payerRole?: 'student' | 'parent'
  /** Firestore walletTransactions doc id of the held (pending) charge — lets the exact hold be finalized or refunded later without searching. */
  holdTransactionId?: string
  /** True once the held payment has actually moved to the teacher — on report confirmation, 24h auto-confirmation, or a dispute resolved in the teacher's favor. */
  paymentReleased?: boolean
  report?: LessonReport
  reportSubmittedAt?: number
  /** Whoever has confirmation authority for this lesson's report — the student's linked parent if one existed at the moment the report was submitted, otherwise the student themselves (see services/family-link.service.ts). Frozen at report-submission time so a parent linking later doesn't retroactively change who was responsible. */
  confirmingPartyId?: string
  confirmingPartyRole?: 'student' | 'parent'
  reportConfirmedAt?: number
  dispute?: LessonDispute
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
  role: UserRole
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
  /** Who's actually paying — omit for a student booking themselves; pass the parent's identity when a linked parent books/pays on the student's behalf (see components/parent/book-for-student-button.tsx). */
  payer?: { id: string; role: 'student' | 'parent' }
}

/** A short-lived, single-use code a student generates so a parent can link their own account as a supervising guardian (see services/family-link.service.ts). */
export type StudentLinkCode = {
  code: string
  studentId: string
  studentName: string
  createdAt: number
  expiresAt: number
  usedByParentId?: string
  usedAt?: number
}

/** One linked student's summary, shown on the parent dashboard. */
export type LinkedStudentSummary = {
  id: string
  name: string
  initials: string
  avatarColor: string
  walletBalance: number
  upcomingLessonsCount: number
  pendingConfirmationsCount: number
}
