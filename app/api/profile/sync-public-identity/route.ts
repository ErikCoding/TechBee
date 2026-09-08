import { NextResponse } from 'next/server'
import { adminDb, isAdminConfigured } from '@/lib/firebase-admin'
import { collections } from '@/lib/firebase'
import { verifyCaller } from '@/lib/stripe-server-auth'
import type { ChatParticipant, ReviewItem, UserRole } from '@/lib/types'

type UserProfileDoc = {
  name?: string
  initials?: string
  avatarColor?: string
  photoUrl?: string
  role?: UserRole
}

type TeacherDocWithReviews = {
  reviews?: ReviewItem[]
}

function participantFromProfile(uid: string, profile: UserProfileDoc): ChatParticipant {
  return {
    id: uid,
    name: profile.name ?? 'Użytkownik',
    initials: profile.initials ?? '??',
    avatarColor: profile.avatarColor ?? '#F4B400',
    photoUrl: profile.photoUrl ?? '',
    role: profile.role ?? 'student',
  }
}

function syncReviews(reviews: ReviewItem[] | undefined, uid: string, profile: UserProfileDoc): { reviews: ReviewItem[]; changed: boolean } {
  let changed = false
  const next = (reviews ?? []).map((review) => {
    if (review.authorId !== uid) return review
    const { authorPhotoUrl: _oldPhotoUrl, ...reviewWithoutPhoto } = review
    changed = true
    return {
      ...reviewWithoutPhoto,
      author: profile.name ?? review.author,
      authorInitials: profile.initials ?? review.authorInitials,
      authorColor: profile.avatarColor ?? review.authorColor,
      ...(profile.photoUrl ? { authorPhotoUrl: profile.photoUrl } : {}),
    }
  })
  return { reviews: next, changed }
}

export async function POST(request: Request) {
  if (!isAdminConfigured || !adminDb) {
    return NextResponse.json({ error: 'Synchronizacja profilu wymaga FIREBASE_SERVICE_ACCOUNT_KEY.' }, { status: 503 })
  }

  let body: { idToken?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Nieprawidłowe żądanie.' }, { status: 400 })
  }

  const uid = await verifyCaller(body.idToken)
  if (!uid) return NextResponse.json({ error: 'Musisz być zalogowany.' }, { status: 401 })

  const userSnap = await adminDb.collection(collections.users).doc(uid).get()
  if (!userSnap.exists) return NextResponse.json({ error: 'Nie znaleziono profilu użytkownika.' }, { status: 404 })

  const profile = userSnap.data() as UserProfileDoc
  const participant = participantFromProfile(uid, profile)
  let teacherProfilesUpdated = 0
  let conversationsUpdated = 0
  let teacherReviewDocsUpdated = 0
  let lessonsUpdated = 0

  const ownTeacherRef = adminDb.collection(collections.teachers).doc(uid)
  const [ownTeacherSnap, conversationsSnap, teachersSnap, lessonsSnap] = await Promise.all([
    ownTeacherRef.get(),
    adminDb.collection(collections.conversations).where('participantIds', 'array-contains', uid).get(),
    adminDb.collection(collections.teachers).get(),
    adminDb.collection(collections.lessons).where('teacherId', '==', uid).get(),
  ])

  const writes: Promise<unknown>[] = []

  if (ownTeacherSnap.exists) {
    teacherProfilesUpdated += 1
    writes.push(ownTeacherRef.set({
      name: participant.name,
      initials: participant.initials,
      avatarColor: participant.avatarColor,
      photoUrl: participant.photoUrl,
    }, { merge: true }))
  }

  conversationsSnap.docs.forEach((conversation) => {
    conversationsUpdated += 1
    writes.push(conversation.ref.update({ [`participants.${uid}`]: participant }))
  })

  teachersSnap.docs.forEach((teacherDoc) => {
    const teacher = teacherDoc.data() as TeacherDocWithReviews
    const reviewSync = syncReviews(teacher.reviews, uid, profile)
    if (!reviewSync.changed) return
    teacherReviewDocsUpdated += 1
    writes.push(teacherDoc.ref.update({ reviews: reviewSync.reviews }))
  })

  lessonsSnap.docs.forEach((lessonDoc) => {
    lessonsUpdated += 1
    writes.push(lessonDoc.ref.update({
      teacherName: participant.name,
      teacherInitials: participant.initials,
      teacherColor: participant.avatarColor,
      teacherPhotoUrl: participant.photoUrl,
    }))
  })

  await Promise.all(writes)

  return NextResponse.json({
    ok: true,
    teacherProfilesUpdated,
    conversationsUpdated,
    teacherReviewDocsUpdated,
    lessonsUpdated,
  })
}
