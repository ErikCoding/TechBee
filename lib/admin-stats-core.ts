import type { AdminStats } from './types'

const WEEK_MS = 7 * 24 * 60 * 60 * 1000
const MONTH_LABELS_PL = ['Sty', 'Lut', 'Mar', 'Kwi', 'Maj', 'Cze', 'Lip', 'Sie', 'Wrz', 'Paź', 'Lis', 'Gru']

export type AdminStatsUserRow = {
  role?: 'student' | 'teacher' | 'admin' | 'parent'
  createdAt?: number
  /** Oświadczenie z rejestracji (zapisywane od wprowadzenia deklaracji wieku). */
  registrationConsent?: { ageBand?: string }
  /** 'deleted' = tombstone left after permanent account deletion (see account-deletion finalization); never counted as a user. */
  accountStatus?: string
}

export type AdminStatsTeacherRow = {
  status?: 'pending' | 'approved' | 'rejected'
}

const AGE_BAND_ROWS = [
  { band: 'adult', label: '18 lat i więcej', color: '#10B981' },
  { band: 'teen_16_17', label: '16–17 lat (zgoda rodzica)', color: '#F4B400' },
  { band: 'child_under_16', label: 'Poniżej 16 lat (zgoda rodzica)', color: '#EF4444' },
  { band: 'unknown', label: 'Brak deklaracji (starsze konta)', color: '#64748B' },
] as const

export function countStudentAgeBands(users: AdminStatsUserRow[]): NonNullable<AdminStats['studentAgeBands']> {
  const students = users.filter((u) => u.role === 'student' && u.accountStatus !== 'deleted')
  return AGE_BAND_ROWS.map((row) => ({
    ...row,
    count: students.filter((u) => {
      const band = u.registrationConsent?.ageBand
      const known = band === 'adult' || band === 'teen_16_17' || band === 'child_under_16'
      return row.band === 'unknown' ? !known : band === row.band
    }).length,
  }))
}

export function emptyAdminStats(now = new Date()): AdminStats {
  return {
    totalUsers: 0,
    totalTeachers: 0,
    totalStudents: 0,
    activeLessonsToday: 0,
    monthlyRevenue: 0,
    monthlyNetRevenue: null,
    monthlyNetRevenueComplete: false,
    revenueChange: 0,
    newSignupsThisWeek: 0,
    pendingVerifications: 0,
    revenueChart: Array.from({ length: 6 }, (_, i) => {
      const monthDate = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1)
      return { month: MONTH_LABELS_PL[monthDate.getMonth()], amount: 0, platformFee: 0, teacherAmount: 0 }
    }),
    studentAgeBands: AGE_BAND_ROWS.map((row) => ({ ...row, count: 0 })),
    usersByRole: [
      { role: 'Uczniowie', count: 0, color: '#F4B400' },
      { role: 'Nauczyciele', count: 0, color: '#3B82F6' },
      { role: 'Rodzice', count: 0, color: '#10B981' },
      { role: 'Administratorzy', count: 0, color: '#8B5CF6' },
    ],
  }
}

export function buildAdminStatsFromRows(input: {
  users: AdminStatsUserRow[]
  teachers: AdminStatsTeacherRow[]
  revenue: Pick<AdminStats, 'monthlyRevenue' | 'monthlyNetRevenue' | 'monthlyNetRevenueComplete' | 'revenueChange' | 'revenueChart' | 'activeLessonsToday'>
  now?: Date
}): AdminStats {
  const now = input.now ?? new Date()
  // Permanently deleted accounts keep a tombstone doc (with their role) for audit — they are not users.
  const users = input.users.filter((u) => u.accountStatus !== 'deleted')
  const totalStudents = users.filter((u) => u.role === 'student').length
  const totalTeachers = users.filter((u) => u.role === 'teacher').length
  const totalParents = users.filter((u) => u.role === 'parent').length
  const totalUsers = users.length
  const weekAgo = now.getTime() - WEEK_MS
  const newSignupsThisWeek = users.filter((u) => (u.createdAt ?? 0) >= weekAgo).length

  return {
    ...input.revenue,
    totalUsers,
    totalTeachers,
    totalStudents,
    newSignupsThisWeek,
    pendingVerifications: input.teachers.filter((teacher) => teacher.status === 'pending').length,
    studentAgeBands: countStudentAgeBands(users),
    usersByRole: [
      { role: 'Uczniowie', count: totalStudents, color: '#F4B400' },
      { role: 'Nauczyciele', count: totalTeachers, color: '#3B82F6' },
      { role: 'Rodzice', count: totalParents, color: '#10B981' },
      { role: 'Administratorzy', count: totalUsers - totalStudents - totalTeachers - totalParents, color: '#8B5CF6' },
    ],
  }
}
