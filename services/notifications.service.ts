import { notificationsData } from '@/data/notifications.data'
import type { Notification } from '@/lib/types'

// ─────────────────────────────────────────────────────────────
// Data-access layer for notifications. Firebase version will likely
// combine a Firestore `notifications/{uid}` subcollection with
// realtime `onSnapshot` for live badges, plus FCM for push delivery.
// ─────────────────────────────────────────────────────────────

export async function getNotifications(_userId?: string): Promise<Notification[]> {
  // TODO(firebase): const snap = await getDocs(query(collection(db, 'notifications', userId, 'items'), orderBy('date', 'desc')))
  return notificationsData
}

export async function getUnreadNotificationsCount(_userId?: string): Promise<number> {
  return notificationsData.filter((n) => !n.read).length
}
