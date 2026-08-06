import type { Lesson, StudentStats, TeacherDashboardData } from '@/lib/types'

// Mock data — will be swapped for Firestore `lessons` queries scoped
// to the signed-in user (student or teacher).
export const studentLessonsData: Lesson[] = [
  { id: 'l1', teacherName: 'Marek Kowalski', teacherInitials: 'MK', teacherColor: '#3B82F6', specialty: 'Programowanie PLC', date: 'Jutro', time: '14:00', duration: 60, status: 'upcoming', price: 180, topic: 'Siemens S7-1500 — schemat bloków funkcyjnych' },
  { id: 'l2', teacherName: 'Krzysztof Zieliński', teacherInitials: 'KZ', teacherColor: '#8B5CF6', specialty: 'Projektowanie CAD', date: '31 lip', time: '10:00', duration: 90, status: 'upcoming', price: 225, topic: 'SolidWorks — projektowanie blach' },
  { id: 'l3', teacherName: 'Marek Kowalski', teacherInitials: 'MK', teacherColor: '#3B82F6', specialty: 'Programowanie PLC', date: '25 lip', time: '14:00', duration: 60, status: 'completed', price: 180, topic: 'Konfiguracja sieci PROFINET' },
  { id: 'l4', teacherName: 'Krzysztof Zieliński', teacherInitials: 'KZ', teacherColor: '#8B5CF6', specialty: 'Projektowanie CAD', date: '22 lip', time: '10:00', duration: 60, status: 'completed', price: 150, topic: 'SolidWorks — konstrukcje spawane' },
  { id: 'l5', teacherName: 'Julia Kamińska', teacherInitials: 'JK', teacherColor: '#EF4444', specialty: 'Robotyka przemysłowa', date: '18 lip', time: '16:00', duration: 90, status: 'completed', price: 300, topic: 'KUKA KRL — podstawy programowania trajektorii' },
  { id: 'l6', teacherName: 'Anna Wiśniewska', teacherInitials: 'AW', teacherColor: '#10B981', specialty: 'Obróbka CNC', date: '10 lip', time: '09:00', duration: 60, status: 'cancelled', price: 160, topic: 'Frezowanie 5-osiowe — strategie osi pochylenia' },
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
  upcomingLessons: [
    { id: 'ul1', studentName: 'Filip N.', topic: 'Bloki funkcyjne S7-1500', date: 'Jutro', time: '14:00', duration: 60, price: 180 },
    { id: 'ul2', studentName: 'Luiza F.', topic: 'Safety PLC — podstawy SIL 2', date: '31 lip', time: '10:00', duration: 90, price: 270 },
    { id: 'ul3', studentName: 'Andrzej K.', topic: 'TIA Portal — integracja HMI', date: '1 sie', time: '15:00', duration: 60, price: 180 },
  ],
  pendingRequests: [
    { id: 'pr1', studentName: 'Rodrigo M.', topic: 'Allen-Bradley — wprowadzenie do Studio 5000', requestedDate: '3 sie', price: 180 },
    { id: 'pr2', studentName: 'Sara T.', topic: 'Łączność PLC ze SCADA', requestedDate: '5 sie', price: 180 },
  ],
  earningsChart: [
    { month: 'Lut', amount: 6200 },
    { month: 'Mar', amount: 7100 },
    { month: 'Kwi', amount: 7800 },
    { month: 'Maj', amount: 6900 },
    { month: 'Cze', amount: 8200 },
    { month: 'Lip', amount: 8640 },
  ],
}
