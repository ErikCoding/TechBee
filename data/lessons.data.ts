import type { Lesson, StudentStats, TeacherDashboardData } from '@/lib/types'

// Mock data — will be swapped for Firestore `lessons` queries scoped
// to the signed-in user (student or teacher).
export const studentLessonsData: Lesson[] = [
  { id: 'l1', teacherId: '1', studentId: 'u3', teacherName: 'Marek Kowalski', studentName: 'Filip Nowicki', teacherInitials: 'MK', teacherColor: '#3B82F6', specialty: 'Programowanie PLC', date: 'Jutro', time: '14:00', duration: 60, status: 'upcoming', price: 180, topic: 'Siemens S7-1500 — schemat bloków funkcyjnych' },
  { id: 'l2', teacherId: '4', studentId: 'u3', teacherName: 'Krzysztof Zieliński', studentName: 'Filip Nowicki', teacherInitials: 'KZ', teacherColor: '#8B5CF6', specialty: 'Projektowanie CAD', date: '31 lip', time: '10:00', duration: 90, status: 'pending', price: 225, topic: 'SolidWorks — projektowanie blach' },
  { id: 'l3', teacherId: '1', studentId: 'u3', teacherName: 'Marek Kowalski', studentName: 'Filip Nowicki', teacherInitials: 'MK', teacherColor: '#3B82F6', specialty: 'Programowanie PLC', date: '25 lip', time: '14:00', duration: 60, status: 'completed', price: 180, topic: 'Konfiguracja sieci PROFINET' },
  { id: 'l4', teacherId: '4', studentId: 'u3', teacherName: 'Krzysztof Zieliński', studentName: 'Filip Nowicki', teacherInitials: 'KZ', teacherColor: '#8B5CF6', specialty: 'Projektowanie CAD', date: '22 lip', time: '10:00', duration: 60, status: 'completed', price: 150, topic: 'SolidWorks — konstrukcje spawane' },
  { id: 'l5', teacherId: '5', studentId: 'u3', teacherName: 'Julia Kamińska', studentName: 'Filip Nowicki', teacherInitials: 'JK', teacherColor: '#EF4444', specialty: 'Robotyka przemysłowa', date: '18 lip', time: '16:00', duration: 90, status: 'completed', price: 300, topic: 'KUKA KRL — podstawy programowania trajektorii' },
  { id: 'l6', teacherId: '2', studentId: 'u3', teacherName: 'Anna Wiśniewska', studentName: 'Filip Nowicki', teacherInitials: 'AW', teacherColor: '#10B981', specialty: 'Obróbka CNC', date: '10 lip', time: '09:00', duration: 60, status: 'cancelled', price: 160, topic: 'Frezowanie 5-osiowe — strategie osi pochylenia' },
]

// Same lessons, from the teacher's ("Marek Kowalski", catalog id '1') side —
// only the ones that are actually his (l1, l3) plus a couple more so the
// demo teacher dashboard has both a pending confirmation and a completed
// lesson to show.
export const teacherLessonsData: Lesson[] = [
  { id: 'l1', teacherId: '1', studentId: 'u3', teacherName: 'Marek Kowalski', studentName: 'Filip Nowicki', teacherInitials: 'MK', teacherColor: '#3B82F6', specialty: 'Programowanie PLC', date: 'Jutro', time: '14:00', duration: 60, status: 'upcoming', price: 180, topic: 'Siemens S7-1500 — schemat bloków funkcyjnych' },
  { id: 'tl2', teacherId: '1', studentId: 'u-rodrigo', teacherName: 'Marek Kowalski', studentName: 'Rodrigo M.', teacherInitials: 'MK', teacherColor: '#3B82F6', specialty: 'Programowanie PLC', date: '3 sie', time: '11:00', duration: 60, status: 'pending', price: 180, topic: 'Allen-Bradley — wprowadzenie do Studio 5000' },
  { id: 'l3', teacherId: '1', studentId: 'u3', teacherName: 'Marek Kowalski', studentName: 'Filip Nowicki', teacherInitials: 'MK', teacherColor: '#3B82F6', specialty: 'Programowanie PLC', date: '25 lip', time: '14:00', duration: 60, status: 'completed', price: 180, topic: 'Konfiguracja sieci PROFINET' },
]

export const studentStatsData: StudentStats = {
  totalLessons: 28,
  hoursLearned: 34,
  teachersWorkedWith: 4,
  certificatesEarned: 2,
  currentStreak: 7,
  beePoints: 2840,
  techCoins: 1200,
  progressByCategory: [
    { category: 'Programowanie PLC', progress: 68, color: '#3B82F6' },
    { category: 'Projektowanie CAD', progress: 52, color: '#8B5CF6' },
    { category: 'Robotyka przemysłowa', progress: 30, color: '#EF4444' },
    { category: 'Obróbka CNC', progress: 15, color: '#10B981' },
  ],
}

export const teacherDashboardDataMock: TeacherDashboardData = {
  name: 'Marek Kowalski',
  initials: 'MK',
  avatarColor: '#3B82F6',
  specialty: 'Programowanie PLC',
  rating: 4.9,
  reviewCount: 312,
  monthlyEarnings: 8640,
  totalEarnings: 94200,
  studentsThisMonth: 18,
  lessonsThisMonth: 48,
  completionRate: 99,
  responseRate: 100,
  earningsChart: [
    { month: 'Lut', amount: 6200 },
    { month: 'Mar', amount: 7100 },
    { month: 'Kwi', amount: 7800 },
    { month: 'Maj', amount: 6900 },
    { month: 'Cze', amount: 8200 },
    { month: 'Lip', amount: 8640 },
  ],
}
