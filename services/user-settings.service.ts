import { doc, getDoc, updateDoc } from 'firebase/firestore'
import { auth, collections, db, isFirebaseConfigured } from '@/lib/firebase'
import {
  canUpdateOwnNotificationPreferences,
  emailNotificationFieldPath,
  normalizeNotificationPreferences,
  setEmailNotificationPreference,
  type EmailNotificationType,
  type NotificationPreferences,
} from '@/lib/notification-preferences'

const MOCK_PREFS_KEY = 'techbee.notificationPreferences'

function readMockPrefs(userId: string): NotificationPreferences {
  if (typeof window === 'undefined') return normalizeNotificationPreferences(null)
  try {
    const all = JSON.parse(window.localStorage.getItem(MOCK_PREFS_KEY) ?? '{}') as Record<string, unknown>
    return normalizeNotificationPreferences(all[userId])
  } catch {
    return normalizeNotificationPreferences(null)
  }
}

function writeMockPrefs(userId: string, preferences: NotificationPreferences) {
  if (typeof window === 'undefined') return
  let all: Record<string, unknown> = {}
  try {
    all = JSON.parse(window.localStorage.getItem(MOCK_PREFS_KEY) ?? '{}') as Record<string, unknown>
  } catch {
    all = {}
  }
  all[userId] = preferences
  window.localStorage.setItem(MOCK_PREFS_KEY, JSON.stringify(all))
}

export async function getUserNotificationPreferences(userId: string): Promise<NotificationPreferences> {
  if (!isFirebaseConfigured || !db) return readMockPrefs(userId)
  const snap = await getDoc(doc(db, collections.users, userId))
  return normalizeNotificationPreferences(snap.data()?.notificationPreferences)
}

export async function setUserEmailNotificationPreference(userId: string, type: EmailNotificationType, enabled: boolean): Promise<NotificationPreferences> {
  const callerUid = isFirebaseConfigured ? auth?.currentUser?.uid : userId
  if (!canUpdateOwnNotificationPreferences(callerUid, userId)) {
    throw new Error('Nie możesz zmieniać ustawień innego użytkownika.')
  }

  const current = await getUserNotificationPreferences(userId)
  const next = setEmailNotificationPreference(current, type, enabled)

  if (!isFirebaseConfigured || !db) {
    writeMockPrefs(userId, next)
    return next
  }

  await updateDoc(doc(db, collections.users, userId), {
    [emailNotificationFieldPath(type)]: enabled,
  })
  return next
}
