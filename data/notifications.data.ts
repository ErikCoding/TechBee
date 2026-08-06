import type { Notification } from '@/lib/types'

// Mock data — will be swapped for Firestore `notifications/{uid}` subcollection,
// eventually pushed live via Firebase Cloud Messaging / Firestore listeners.
export const notificationsData: Notification[] = [
  { id: 'n1', type: 'lesson', title: 'Lekcja jutro o 14:00', description: 'Marek Kowalski — Siemens S7-1500, bloki funkcyjne.', date: '2 godz. temu', read: false },
  { id: 'n2', type: 'payment', title: 'Płatność zaksięgowana', description: 'Doładowanie portfela: +500 zł przez BLIK.', date: '1 dzień temu', read: false },
  { id: 'n3', type: 'beepoints', title: 'Zdobyto 250 BeePoints', description: 'Bonus za tygodniową serię nauki (7 dni).', date: '2 dni temu', read: false },
  { id: 'n4', type: 'review', title: 'Nowa odpowiedź na Twoją opinię', description: 'Krzysztof Zieliński odpowiedział na Twoją opinię.', date: '3 dni temu', read: true },
  { id: 'n5', type: 'lesson', title: 'Lekcja odwołana', description: 'Anna Wiśniewska musiała odwołać lekcję 10 lip — środki zostały zwrócone.', date: '5 dni temu', read: true },
  { id: 'n6', type: 'system', title: 'Zaktualizowano regulamin', description: 'Odśwież się z nowymi zasadami dotyczącymi anulowania lekcji.', date: '1 tydzień temu', read: true },
]
