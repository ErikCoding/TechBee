import 'server-only'

import { FieldPath, FieldValue } from 'firebase-admin/firestore'
import { getStorage } from 'firebase-admin/storage'
import { adminApp, adminDb } from '@/lib/firebase-admin'
import { getAdminAuth } from '@/lib/firebase-admin-auth'
import { collections } from '@/lib/firebase'
import { sendTransactionalEmail, textToEmailParagraphs } from '@/lib/email/transactional-email.server'
import {
  accountDeletionStatusEmailText,
  anonymizeReviewItem,
  anonymizedChatParticipant,
  DELETED_USER_NAME,
  deletedUserTombstone,
  isAnonymizedChatParticipant,
  lessonAnonymizationPatch,
  type AccountFinalizationStep,
} from '@/lib/account-deletion-core'
import type { UserRole } from '@/lib/types'

/**
 * Irreversible part of account deletion. Each step is idempotent (running it
 * again on already-processed data changes nothing) so a run that failed in the
 * middle can be resumed from the persisted `completedSteps`.
 *
 * What is NOT touched, by design: lessons / packages / payouts / payment
 * snapshots / Stripe events (only the deleted user's display name is replaced
 * on lessons), Stripe objects (nothing here calls Stripe), other users' data.
 */
export type FinalizationContext = {
  uid: string
  role: UserRole
  requestId: string
  adminId: string
  now: number
}

const PAGE = 300

function database() {
  if (!adminDb) throw new Error('Firebase Admin Firestore is not configured.')
  return adminDb
}

/** Pages through a query ordered by document id; `handle` may mutate documents without breaking the cursor. */
async function forEachPage(
  query: FirebaseFirestore.Query,
  handle: (docs: FirebaseFirestore.QueryDocumentSnapshot[]) => Promise<void>,
): Promise<void> {
  let last: FirebaseFirestore.QueryDocumentSnapshot | undefined
  for (let guard = 0; guard < 1000; guard += 1) {
    let page = query.orderBy(FieldPath.documentId()).limit(PAGE)
    if (last) page = page.startAfter(last)
    const snap = await page.get()
    if (snap.empty) return
    await handle(snap.docs)
    last = snap.docs[snap.docs.length - 1]
    if (snap.size < PAGE) return
  }
  throw new Error('Pagination guard exceeded.')
}

async function deleteAll(query: FirebaseFirestore.Query): Promise<void> {
  const db = database()
  await forEachPage(query, async (docs) => {
    const batch = db.batch()
    for (const doc of docs) batch.delete(doc.ref)
    await batch.commit()
  })
}

async function deleteDocIfExists(ref: FirebaseFirestore.DocumentReference): Promise<void> {
  await ref.delete()
}

function bucket() {
  const name = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET
  if (!adminApp || !name) throw new Error('Firebase Storage bucket is not configured.')
  return getStorage(adminApp).bucket(name)
}

async function deleteStoragePrefix(prefix: string): Promise<void> {
  // `deleteFiles` resolves when there is nothing under the prefix.
  await bucket().deleteFiles({ prefix, force: true })
}

async function deleteStorageFile(path: string): Promise<void> {
  await bucket().file(path).delete({ ignoreNotFound: true })
}

function ownedAttachmentPath(uid: string, path: unknown): string | null {
  // Only files inside the user's own folder are ever removed on their behalf.
  return typeof path === 'string' && path.startsWith(`chat-attachments/${uid}/`) && !path.includes('..') ? path : null
}

// ── Steps ─────────────────────────────────────────────────────

async function closeAccess(ctx: FinalizationContext) {
  const db = database()
  const auth = await getAdminAuth()
  if (!auth) throw new Error('Firebase Auth Admin API is not configured.')
  try {
    await auth.updateUserDisabled(ctx.uid, true)
  } catch (error) {
    // Already deleted in an earlier run → nothing to disable.
    if ((error as { code?: string })?.code !== 'auth/user-not-found') throw error
  }
  const userRef = db.collection(collections.users).doc(ctx.uid)
  const snap = await userRef.get()
  if (snap.exists && snap.data()?.accountStatus !== 'deleted') {
    await userRef.set({
      accountStatus: 'deactivated',
      deactivatedAt: snap.data()?.deactivatedAt ?? ctx.now,
      deactivatedBy: snap.data()?.deactivatedBy ?? ctx.adminId,
      accountDeletionRequestId: ctx.requestId,
      updatedAt: ctx.now,
    }, { merge: true })
  }
}

async function removeNotifications(ctx: FinalizationContext) {
  await deleteAll(database().collection(collections.notifications).where('userId', '==', ctx.uid))
}

async function removePointsAndWallet(ctx: FinalizationContext) {
  const db = database()
  await deleteAll(db.collection(collections.beepointsEvents).where('userId', '==', ctx.uid))
  await deleteDocIfExists(db.collection(collections.beepoints).doc(ctx.uid))
  await deleteDocIfExists(db.collection(collections.wallets).doc(ctx.uid))
}

async function removeFamilyLinks(ctx: FinalizationContext) {
  const db = database()
  await deleteAll(db.collection(collections.linkCodes).where('studentId', '==', ctx.uid))
  await deleteAll(db.collection(collections.linkCodes).where('usedByParentId', '==', ctx.uid))
  for (const field of ['linkedParentIds', 'linkedStudentIds'] as const) {
    await forEachPage(db.collection(collections.users).where(field, 'array-contains', ctx.uid), async (docs) => {
      const batch = db.batch()
      for (const doc of docs) batch.update(doc.ref, { [field]: FieldValue.arrayRemove(ctx.uid) })
      await batch.commit()
    })
  }
}

async function anonymizeChats(ctx: FinalizationContext) {
  const db = database()
  await forEachPage(db.collection(collections.conversations).where('participantIds', 'array-contains', ctx.uid), async (conversations) => {
    for (const conversation of conversations) {
      const data = conversation.data()
      const update: Record<string, unknown> = {}
      const participants = data.participants as Record<string, Record<string, unknown>> | undefined
      if (!isAnonymizedChatParticipant(participants?.[ctx.uid])) {
        update[`participants.${ctx.uid}`] = anonymizedChatParticipant(participants?.[ctx.uid], ctx.uid)
      }

      let lastMessageRemoved = false
      await forEachPage(conversation.ref.collection('items').where('senderId', '==', ctx.uid), async (items) => {
        for (const item of items) {
          const message = item.data()
          // Report cards are lesson records for the other party and for settlement — they stay.
          if (message.reportCard) continue
          const attachment = message.attachment as { storagePath?: unknown } | undefined
          const path = ownedAttachmentPath(ctx.uid, attachment?.storagePath)
          if (path) await deleteStorageFile(path)
          const hasContent = Boolean(message.text) || Boolean(message.attachment)
          if (!hasContent && message.contentRemoved === true) continue
          await item.ref.update({ text: '', attachment: FieldValue.delete(), contentRemoved: true })
          if (typeof data.lastMessageAt === 'number' && message.createdAt === data.lastMessageAt) lastMessageRemoved = true
        }
      })
      if (lastMessageRemoved) update.lastMessage = ''
      if (Object.keys(update).length > 0) await conversation.ref.update(update as FirebaseFirestore.UpdateData<FirebaseFirestore.DocumentData>)
    }
  })
}

async function anonymizeReviews(ctx: FinalizationContext) {
  const db = database()
  const teacherIds = new Set<string>()
  for (const field of ['studentId', 'payerId'] as const) {
    await forEachPage(db.collection(collections.lessons).where(field, '==', ctx.uid), async (docs) => {
      for (const doc of docs) {
        const teacherId = doc.data().teacherId
        if (typeof teacherId === 'string' && teacherId !== ctx.uid) teacherIds.add(teacherId)
      }
    })
  }
  for (const teacherId of teacherIds) {
    const ref = db.collection(collections.teachers).doc(teacherId)
    await db.runTransaction(async (tx) => {
      const snap = await tx.get(ref)
      const reviews = snap.data()?.reviews
      if (!Array.isArray(reviews)) return
      let changed = false
      const next = reviews.map((review) => {
        const anonymized = review && typeof review === 'object' ? anonymizeReviewItem(review as Record<string, unknown>, ctx.uid) : null
        if (!anonymized) return review
        changed = true
        return anonymized
      })
      if (changed) tx.update(ref, { reviews: next })
    })
  }
}

async function anonymizeRetainedRecords(ctx: FinalizationContext) {
  const db = database()
  for (const field of ['studentId', 'teacherId', 'payerId'] as const) {
    await forEachPage(db.collection(collections.lessons).where(field, '==', ctx.uid), async (docs) => {
      const batch = db.batch()
      let writes = 0
      for (const doc of docs) {
        const patch = lessonAnonymizationPatch(doc.data(), ctx.uid)
        if (!patch) continue
        const resolved = Object.fromEntries(Object.entries(patch).map(([key, value]) => [key, value === null ? FieldValue.delete() : value]))
        batch.update(doc.ref, resolved as FirebaseFirestore.UpdateData<FirebaseFirestore.DocumentData>)
        writes += 1
      }
      if (writes > 0) await batch.commit()
    })
  }
  // Package records keep their financial snapshots; only the display names go.
  for (const field of ['studentId', 'payerId'] as const) {
    await forEachPage(db.collection(collections.lessonPackages).where(field, '==', ctx.uid), async (docs) => {
      const batch = db.batch()
      let writes = 0
      for (const doc of docs) {
        const data = doc.data()
        const patch: Record<string, unknown> = {}
        if (data.studentId === ctx.uid && typeof data.studentName === 'string' && data.studentName !== DELETED_USER_NAME) patch.studentName = DELETED_USER_NAME
        if (Object.keys(patch).length === 0) continue
        batch.update(doc.ref, patch as FirebaseFirestore.UpdateData<FirebaseFirestore.DocumentData>)
        writes += 1
      }
      if (writes > 0) await batch.commit()
    })
  }
}

async function removeStorage(ctx: FinalizationContext) {
  await deleteStoragePrefix(`profile-photos/${ctx.uid}/`)
  await deleteStoragePrefix(`chat-attachments/${ctx.uid}/`)
}

async function removeTeacherProfile(ctx: FinalizationContext) {
  const db = database()
  const ref = db.collection(collections.teachers).doc(ctx.uid)
  const snap = await ref.get()
  if (!snap.exists) return
  // Stripe's own records stay in Stripe; keep only the account id so the
  // payouts of this teacher can still be reconciled with it.
  const stripeAccountId = (snap.data()?.stripe as { accountId?: unknown } | undefined)?.accountId
  if (typeof stripeAccountId === 'string' && stripeAccountId) {
    await db.collection(collections.accountDeletionRequests).doc(ctx.requestId).set({
      retained: { stripeAccountId },
    }, { merge: true })
  }
  await ref.delete()
}

async function removeEmailRecords(ctx: FinalizationContext) {
  const db = database()
  await deleteAll(db.collection(collections.emailEvents).where('recipientUid', '==', ctx.uid))
  await deleteAll(db.collection(collections.pendingEmailChanges).where('uid', '==', ctx.uid))
  for (const name of [
    collections.accountDeletionRateLimits,
    collections.emailVerificationRateLimits,
    collections.passwordResetRateLimits,
    collections.emailChangeRateLimits,
  ]) {
    await deleteDocIfExists(db.collection(name).doc(ctx.uid))
  }
}

/** One last courtesy mail, sent from memory right before the address is erased. Never blocks the deletion. */
async function notifyUser(ctx: FinalizationContext) {
  const snap = await database().collection(collections.users).doc(ctx.uid).get()
  const email = snap.exists && snap.data()?.accountStatus !== 'deleted' ? snap.data()?.email : undefined
  if (typeof email !== 'string' || !email) return
  const text = accountDeletionStatusEmailText('completed')
  try {
    await sendTransactionalEmail({
      to: email,
      subject: text.subject,
      title: text.title,
      preheader: text.subject,
      contentHtml: textToEmailParagraphs(text.body),
      text: text.body,
      secondaryText: 'Jeśli masz pytania, skontaktuj się z Runbee: kontakt@runbee.pl.',
      idempotencyKey: `runbee-account-deletion-${ctx.requestId}-completed`,
    })
  } catch (error) {
    console.error('[account-deletion] Final notification failed', { requestId: ctx.requestId, message: error instanceof Error ? error.message : 'Unknown error' })
  }
}

async function writeTombstone(ctx: FinalizationContext) {
  const ref = database().collection(collections.users).doc(ctx.uid)
  // Subcollections (if any ever existed) go first; then the profile is replaced, not merged.
  for (const sub of await ref.listCollections()) await database().recursiveDelete(sub)
  await ref.set(deletedUserTombstone({ role: ctx.role, now: ctx.now, requestId: ctx.requestId }))
}

async function removeAuthUser(ctx: FinalizationContext) {
  const auth = await getAdminAuth()
  if (!auth) throw new Error('Firebase Auth Admin API is not configured.')
  await auth.deleteUser(ctx.uid)
}

const STEP_RUNNERS: Record<AccountFinalizationStep, (ctx: FinalizationContext) => Promise<void>> = {
  close_access: closeAccess,
  notifications: removeNotifications,
  points_and_wallet: removePointsAndWallet,
  family_links: removeFamilyLinks,
  chat: anonymizeChats,
  reviews: anonymizeReviews,
  retained_records: anonymizeRetainedRecords,
  storage: removeStorage,
  teacher_profile: removeTeacherProfile,
  email_records: removeEmailRecords,
  notify_user: notifyUser,
  user_tombstone: writeTombstone,
  auth_user: removeAuthUser,
}

export async function runAccountFinalizationStep(step: AccountFinalizationStep, ctx: FinalizationContext): Promise<void> {
  await STEP_RUNNERS[step](ctx)
}
