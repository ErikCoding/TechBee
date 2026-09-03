import type { AdminStats, AdminUserRow } from '@/lib/types'

// Mock data — will be swapped for aggregated Firestore/Cloud Function queries.
export const adminStatsData: AdminStats = {
  totalUsers: 8842,
  totalTeachers: 312,
  totalStudents: 8480,
  activeLessonsToday: 146,
  monthlyRevenue: 412600,
  revenueChange: 12.4,
  newSignupsThisWeek: 284,
  pendingVerifications: 7,
  revenueChart: [
    { month: 'Lut', amount: 268000, platformFee: 40200, teacherAmount: 227800 },
    { month: 'Mar', amount: 301000, platformFee: 45150, teacherAmount: 255850 },
    { month: 'Kwi', amount: 322000, platformFee: 48300, teacherAmount: 273700 },
    { month: 'Maj', amount: 349000, platformFee: 52350, teacherAmount: 296650 },
    { month: 'Cze', amount: 378000, platformFee: 56700, teacherAmount: 321300 },
    { month: 'Lip', amount: 412600, platformFee: 61890, teacherAmount: 350710 },
  ],
  usersByRole: [
    { role: 'Uczniowie', count: 8480, color: '#F4B400' },
    { role: 'Nauczyciele', count: 312, color: '#3B82F6' },
    { role: 'Rodzice', count: 640, color: '#10B981' },
    { role: 'Administratorzy', count: 50, color: '#8B5CF6' },
  ],
}

export const adminUsersData: AdminUserRow[] = [
  { id: 'u1', name: 'Marek Kowalski', initials: 'MK', avatarColor: '#3B82F6', email: 'marek.kowalski@example.com', role: 'teacher', status: 'active', joined: '12 sty 2024', lessons: 1820 },
  { id: 'u2', name: 'Anna Wiśniewska', initials: 'AW', avatarColor: '#10B981', email: 'anna.wisniewska@example.com', role: 'teacher', status: 'active', joined: '3 mar 2024', lessons: 940 },
  { id: 'u3', name: 'Filip Nowicki', initials: 'FN', avatarColor: '#8B5CF6', email: 'filip.nowicki@example.com', role: 'student', status: 'active', joined: '18 lut 2025', lessons: 28 },
  { id: 'u4', name: 'Krzysztof Zieliński', initials: 'KZ', avatarColor: '#8B5CF6', email: 'krzysztof.zielinski@example.com', role: 'teacher', status: 'active', joined: '7 cze 2023', lessons: 1540 },
  { id: 'u5', name: 'Patrycja Szymańska', initials: 'PS', avatarColor: '#14B8A6', email: 'patrycja.szymanska@example.com', role: 'teacher', status: 'pending', joined: '30 lip 2026', lessons: 0 },
  { id: 'u6', name: 'Luiza Ferens', initials: 'LF', avatarColor: '#10B981', email: 'luiza.ferens@example.com', role: 'student', status: 'active', joined: '2 kwi 2025', lessons: 14 },
  { id: 'u7', name: 'Rafał Nowak', initials: 'RN', avatarColor: '#0EA5E9', email: 'rafal.nowak@example.com', role: 'teacher', status: 'suspended', joined: '11 lis 2022', lessons: 620 },
  { id: 'u8', name: 'Klaudia Pietrzak', initials: 'KP', avatarColor: '#EC4899', email: 'klaudia.pietrzak@example.com', role: 'student', status: 'active', joined: '25 maj 2025', lessons: 6 },
  { id: 'u9', name: 'Zespół Runbee', initials: 'TB', avatarColor: '#F4B400', email: 'admin@techbee.pl', role: 'admin', status: 'active', joined: '1 sty 2022', lessons: 0 },
  { id: 'u10', name: 'Tomasz Wójcik', initials: 'TW', avatarColor: '#EC4899', email: 'tomasz.wojcik@example.com', role: 'teacher', status: 'active', joined: '19 wrz 2023', lessons: 1380 },
]
