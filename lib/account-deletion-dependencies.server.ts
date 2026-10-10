import 'server-only'

import { adminDb } from '@/lib/firebase-admin'
import { collections } from '@/lib/firebase'
import type { AccountDeletionDependencySummary } from '@/lib/account-deletion-core'
import type { UserRole } from '@/lib/types'

type CountResult = {
  count: number
  error?: string
}

async function safeCount(label: string, query: FirebaseFirestore.Query): Promise<CountResult> {
  try {
    const snap = await query.limit(50).get()
    return { count: snap.size }
  } catch {
    return { count: 0, error: label }
  }
}

async function safeGet(label: string, ref: FirebaseFirestore.DocumentReference): Promise<{ snap: FirebaseFirestore.DocumentSnapshot | null; error?: string }> {
  try {
    return { snap: await ref.get() }
  } catch {
    return { snap: null, error: label }
  }
}

function errorsFrom(results: Array<{ error?: string } | null | undefined>): string[] {
  return results.map((result) => result?.error).filter((error): error is string => Boolean(error))
}

export async function buildAccountDeletionDependencySummary(uid: string, role: UserRole): Promise<AccountDeletionDependencySummary> {
  if (!adminDb) throw new Error('Firebase Admin Firestore is not configured.')
  const database = adminDb
  const activeStatuses = ['pending', 'upcoming']
  const [studentLessons, teacherLessons, payerLessons, studentDisputes, teacherDisputes, payerDisputes] = await Promise.all([
    safeCount('active student lessons', database.collection(collections.lessons).where('studentId', '==', uid).where('status', 'in', activeStatuses)),
    safeCount('active teacher lessons', database.collection(collections.lessons).where('teacherId', '==', uid).where('status', 'in', activeStatuses)),
    safeCount('active payer lessons', database.collection(collections.lessons).where('payerId', '==', uid).where('status', 'in', activeStatuses)),
    safeCount('open student disputes', database.collection(collections.lessons).where('studentId', '==', uid).where('dispute.status', '==', 'open')),
    safeCount('open teacher disputes', database.collection(collections.lessons).where('teacherId', '==', uid).where('dispute.status', '==', 'open')),
    safeCount('open payer disputes', database.collection(collections.lessons).where('payerId', '==', uid).where('dispute.status', '==', 'open')),
  ])

  let activePackages = 0
  let packageError: string | undefined
  try {
    const packagesSnap = await database
      .collection(collections.lessonPackages)
      .where('studentId', '==', uid)
      .where('status', 'in', ['active', 'refund_review'])
      .limit(50)
      .get()
    activePackages = packagesSnap.docs.filter((doc) => {
      const data = doc.data()
      return Number(data.remainingCredits ?? 0) > 0
        || Number(data.reservedCredits ?? 0) > 0
        || data.status === 'refund_review'
    }).length
  } catch {
    packageError = 'active lesson packages'
  }

  const [pendingReports, pendingPayouts, studentLinkCodes, parentUsedCodes, conversations] = await Promise.all([
    safeCount('pending teacher reports', database.collection(collections.lessons).where('teacherId', '==', uid).where('status', '==', 'completed').where('paymentReleased', '==', false)),
    role === 'teacher'
      ? safeCount('pending teacher payouts', database.collection(collections.payouts).where('teacherId', '==', uid).where('status', 'in', ['pending', 'in_transit']))
      : Promise.resolve({ count: 0, error: undefined }),
    safeCount('student link codes', database.collection(collections.linkCodes).where('studentId', '==', uid)),
    safeCount('parent link codes', database.collection(collections.linkCodes).where('usedByParentId', '==', uid)),
    safeCount('conversations', database.collection(collections.conversations).where('participantIds', 'array-contains', uid)),
  ])

  const userResult = await safeGet('user profile', database.collection(collections.users).doc(uid))
  const userData = userResult.snap?.data()
  const linkedStudentIds = Array.isArray(userData?.linkedStudentIds) ? userData.linkedStudentIds.length : 0
  const linkedParentIds = Array.isArray(userData?.linkedParentIds) ? userData.linkedParentIds.length : 0
  const teacherResult = role === 'teacher' ? await safeGet('teacher profile', database.collection(collections.teachers).doc(uid)) : { snap: null }
  const teacherData = teacherResult.snap?.data()
  const scanErrors = errorsFrom([
    studentLessons,
    teacherLessons,
    payerLessons,
    studentDisputes,
    teacherDisputes,
    payerDisputes,
    pendingReports,
    pendingPayouts,
    studentLinkCodes,
    parentUsedCodes,
    conversations,
    userResult,
    teacherResult,
    { error: packageError },
  ])

  return {
    activeLessons: studentLessons.count + teacherLessons.count + payerLessons.count,
    activePackages,
    pendingReports: pendingReports.count,
    pendingPayouts: pendingPayouts.count,
    openDisputes: studentDisputes.count + teacherDisputes.count + payerDisputes.count,
    familyLinks: studentLinkCodes.count + parentUsedCodes.count + linkedStudentIds + linkedParentIds,
    publicTeacherProfile: Boolean(teacherResult.snap?.exists),
    conversations: conversations.count,
    stripeConnectReviewRequired: Boolean(teacherData?.stripe?.accountId),
    paymentRecordsReviewRequired: false,
    scanComplete: scanErrors.length === 0,
    ...(scanErrors.length > 0 ? { scanErrors } : {}),
  }
}
