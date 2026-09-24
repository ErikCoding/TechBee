import 'server-only'

import { createHash } from 'node:crypto'
import { adminDb } from '@/lib/firebase-admin'
import { collections } from '@/lib/firebase'
import {
  evaluateAccountSecurityRateLimit,
  type AccountSecurityRateLimitDecision,
  type AccountSecurityRateLimitState,
} from '@/lib/account-security-rate-limit'

export const RECENT_LOGIN_MAX_AGE_MS = 5 * 60 * 1000
export const PENDING_EMAIL_CHANGE_TTL_MS = 60 * 60 * 1000

export type PendingEmailChange = {
  uid: string
  currentEmail: string
  newEmail: string
  oobCodeHash: string
  createdAt: number
  expiresAt: number
  consumedAt?: number
}

export function hashSensitiveValue(value: string): string {
  return createHash('sha256').update(value).digest('hex')
}

export async function checkAndRecordAccountSecurityAttempt(
  collectionName: string,
  docId: string,
  now: number,
): Promise<AccountSecurityRateLimitDecision> {
  if (!adminDb) {
    throw new Error('Firebase Admin Firestore is not configured.')
  }

  const ref = adminDb.collection(collectionName).doc(docId)
  return adminDb.runTransaction(async (tx) => {
    const snap = await tx.get(ref)
    const state = snap.exists ? (snap.data() as AccountSecurityRateLimitState) : null
    const decision = evaluateAccountSecurityRateLimit(state, now)

    if (!decision.allowed) return decision

    tx.set(ref, {
      attempts: decision.nextAttempts,
      lastSentAt: now,
      updatedAt: now,
    }, { merge: true })

    return decision
  })
}

export async function savePendingEmailChange(input: {
  uid: string
  currentEmail: string
  newEmail: string
  oobCode: string
  now: number
}): Promise<PendingEmailChange> {
  if (!adminDb) {
    throw new Error('Firebase Admin Firestore is not configured.')
  }

  const oobCodeHash = hashSensitiveValue(input.oobCode)
  const pending: PendingEmailChange = {
    uid: input.uid,
    currentEmail: input.currentEmail,
    newEmail: input.newEmail,
    oobCodeHash,
    createdAt: input.now,
    expiresAt: input.now + PENDING_EMAIL_CHANGE_TTL_MS,
  }

  await adminDb.collection(collections.pendingEmailChanges).doc(oobCodeHash).set(pending, { merge: false })
  return pending
}

export async function getPendingEmailChange(oobCode: string, now: number): Promise<PendingEmailChange | null> {
  if (!adminDb) {
    throw new Error('Firebase Admin Firestore is not configured.')
  }

  const oobCodeHash = hashSensitiveValue(oobCode)
  const snap = await adminDb.collection(collections.pendingEmailChanges).doc(oobCodeHash).get()
  if (!snap.exists) return null
  const data = snap.data() as PendingEmailChange
  if (data.consumedAt || data.expiresAt < now) return null
  return data
}

export async function markPendingEmailChangeConsumed(oobCode: string, now: number): Promise<void> {
  if (!adminDb) {
    throw new Error('Firebase Admin Firestore is not configured.')
  }

  const oobCodeHash = hashSensitiveValue(oobCode)
  await adminDb.collection(collections.pendingEmailChanges).doc(oobCodeHash).set({ consumedAt: now }, { merge: true })
}
