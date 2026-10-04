import type { AdminStats } from './types'

const WEEK_MS = 7 * 24 * 60 * 60 * 1000
const MONTH_LABELS_PL = ['Sty', 'Lut', 'Mar', 'Kwi', 'Maj', 'Cze', 'Lip', 'Sie', 'Wrz', 'Paź', 'Lis', 'Gru']

export type AdminStatsUserRow = {
  role?: 'student' | 'teacher' | 'admin' | 'parent'
  createdAt?: number
}

export type AdminStatsTeacherRow = {
  status?: 'pending' | 'approved' | 'rejected'
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
  const totalStudents = input.users.filter((u) => u.role === 'student').length
  const totalTeachers = input.users.filter((u) => u.role === 'teacher').length
  const totalParents = input.users.filter((u) => u.role === 'parent').length
  const totalUsers = input.users.length
  const weekAgo = now.getTime() - WEEK_MS
  const newSignupsThisWeek = input.users.filter((u) => (u.createdAt ?? 0) >= weekAgo).length

  return {
    ...input.revenue,
    totalUsers,
    totalTeachers,
    totalStudents,
    newSignupsThisWeek,
    pendingVerifications: input.teachers.filter((teacher) => teacher.status === 'pending').length,
    usersByRole: [
      { role: 'Uczniowie', count: totalStudents, color: '#F4B400' },
      { role: 'Nauczyciele', count: totalTeachers, color: '#3B82F6' },
      { role: 'Rodzice', count: totalParents, color: '#10B981' },
      { role: 'Administratorzy', count: totalUsers - totalStudents - totalTeachers - totalParents, color: '#8B5CF6' },
    ],
  }
}
