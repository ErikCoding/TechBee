import 'server-only'

import { adminDb } from '@/lib/firebase-admin'
import { collections } from '@/lib/firebase'
import { evaluateEmailVerificationRateLimit, type EmailVerificationRateLimitDecision, type EmailVerificationRateLimitState } from '@/lib/email-verification-rate-limit'

export async function checkAndRecordEmailVerificationAttempt(uid: string, now: number): Promise<EmailVerificationRateLimitDecision> {
  if (!adminDb) {
    throw new Error('Firebase Admin Firestore is not configured.')
  }

  const ref = adminDb.collection(collections.emailVerificationRateLimits).doc(uid)
  return adminDb.runTransaction(async (tx) => {
    const snap = await tx.get(ref)
    const state = snap.exists ? (snap.data() as EmailVerificationRateLimitState) : null
    const decision = evaluateEmailVerificationRateLimit(state, now)

    if (!decision.allowed) return decision

    tx.set(ref, {
      uid,
      attempts: decision.nextAttempts,
      lastSentAt: now,
      updatedAt: now,
    }, { merge: true })

    return decision
  })
}
