import { addDoc, collection, doc, getDocs, query, updateDoc, where } from 'firebase/firestore'
import { notificationsData } from '@/data/notifications.data'
import { collections, db, isFirebaseConfigured } from '@/lib/firebase'
import { formatChatTime } from '@/lib/utils'
import type { Notification, NotificationType } from '@/lib/types'

// ─────────────────────────────────────────────────────────────
// Data-access layer for notifications.
//
// Real notifications are written by other services when something
// notification-worthy happens for a *different* user than whoever's
// currently signed in — a student booking a lesson notifies the
// teacher, an admin approving/rejecting an application notifies the
// applicant (see createBookingFirebase in lessons.service.ts and
// reviewApplicationFirebase in teachers.service.ts). `read`/`date`
// are only known here at read time — the `date` label is computed
// from `createdAt` the same way chat timestamps are.
// ─────────────────────────────────────────────────────────────

export interface CreateNotificationInput {
  userId: string
  type: NotificationType
  title: string
  description: string
}

async function createNotificationFirebase(input: CreateNotificationInput): Promise<void> {
  if (!db) return
  await addDoc(collection(db, collections.notifications), {
    userId: input.userId,
    type: input.type,
    title: input.title,
    description: input.description,
    read: false,
    createdAt: Date.now(),
  })
}

/** Best-effort — a failed notification write should never block the action that triggered it (booking a lesson, reviewing an application). */
export async function createNotification(input: CreateNotificationInput): Promise<void> {
  if (!isFirebaseConfigured) return
  try {
    await createNotificationFirebase(input)
  } catch {
    // ignore — notifications are a nice-to-have, not critical path
  }
}

async function getNotificationsFirebase(userId?: string): Promise<Notification[]> {
  // No userId (SSR, before the real signed-in user is known) → empty, not
  // the old demo dataset. Showing fake "Marek Kowalski" notifications for a
  // moment before the real (possibly genuinely empty) list replaces them
  // was exactly the "zapychacze" (filler) the notifications panel used to
  // flash on every load.
  if (!db || !userId) return []
  // No `orderBy` here on purpose, same reason as walletTransactions below —
  // `where(userId) + orderBy(createdAt)` needs a composite index Firestore
  // doesn't create automatically, which made every notification read throw
  // ("query requires an index") until someone manually created one. Sorting
  // the small per-user result set in JS avoids that entirely.
  const snap = await getDocs(query(collection(db, collections.notifications), where('userId', '==', userId)))
  return snap.docs
    .map((d) => {
      const data = d.data() as { type: NotificationType; title: string; description: string; read: boolean; createdAt: number }
      return {
        id: d.id,
        type: data.type,
        title: data.title,
        description: data.description,
        date: formatChatTime(data.createdAt),
        read: data.read,
        _createdAt: data.createdAt,
      }
    })
    .sort((a, b) => b._createdAt - a._createdAt)
    .map(({ _createdAt, ...n }) => n satisfies Notification)
}

export async function getNotifications(userId?: string): Promise<Notification[]> {
  return isFirebaseConfigured ? getNotificationsFirebase(userId) : (userId ? [] : notificationsData)
}

export async function getUnreadNotificationsCount(userId?: string): Promise<number> {
  const list = await getNotifications(userId)
  return list.filter((n) => !n.read).length
}

export async function markNotificationRead(id: string): Promise<void> {
  if (!isFirebaseConfigured || !db) return
  try {
    await updateDoc(doc(db, collections.notifications, id), { read: true })
  } catch {
    // ignore
  }
}
