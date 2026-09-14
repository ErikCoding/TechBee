import { collection, deleteDoc, deleteField, doc, getDoc, getDocs, limit, onSnapshot, query, runTransaction, setDoc, updateDoc, where } from 'firebase/firestore'
import { teachersData } from '@/data/teachers.data'
import { collections, db, isFirebaseConfigured } from '@/lib/firebase'
import { getTeacherCategoryIds, normalizeTeacherCategoryIds, normalizeTeacherCustomSubjects, teacherMatchesCategory } from '@/lib/teacher-categories'
import { createNotification } from '@/services/notifications.service'
import type { ReviewItem, Teacher, TeacherApplicationInput, TeacherProfileSnapshot } from '@/lib/types'

// ─────────────────────────────────────────────────────────────
// Data-access layer for teachers.
//
// Public listings (marketplace, featured, by category) only ever
// show `status: 'approved'` teachers — a real teacher account
// applies via `submitTeacherApplication`, starts out 'pending', and
// only appears on the giełda once an admin approves it (see
// components/admin/admin-verifications-panel.tsx). Legacy/demo
// entries with no `status` field are treated as approved.
//
// Firestore mode: uses `teachers/{authUserId}` as the doc id, so a
// teacher's catalog id and their real Firebase Auth uid are the
// same thing — which also means bookings/messages made against a
// real applied teacher carry their real uid as `teacherId`.
// ─────────────────────────────────────────────────────────────

export function isTeacherApproved(t: Teacher): boolean {
  return (t.status ?? 'approved') === 'approved' && getTeacherCategoryIds(t).length > 0
}

export interface SubmitReviewInput {
  teacherId: string
  /** The reviewing student's user id — the other half of the uniqueness key. */
  authorId: string
  author: string
  authorInitials: string
  authorColor: string
  authorPhotoUrl?: string
  rating: number
  comment: string
}

type TeacherPublicIdentity = {
  id: string
  name: string
  initials: string
  avatarColor: string
  photoUrl?: string
}

// ─────────────────────────────────────────────────────────────
// One review per (student, teacher).
//
// Reviews were previously appended on every completed lesson, so a
// student taking ten lessons with the same teacher produced ten
// independent reviews, ten entries in `reviewCount`, and ten votes in an
// average that is supposed to represent distinct opinions.
//
// The fix is a deterministic id derived from the relationship itself,
// rather than from the moment of writing. Re-submitting therefore
// targets the same array slot and replaces it, which makes the write
// idempotent no matter how many times it runs.
// ─────────────────────────────────────────────────────────────

/** The stable identity of one student's review of one teacher. */
export function buildReviewId(teacherId: string, authorId: string): string {
  return `rev_${teacherId}__${authorId}`
}

/**
 * Replaces this author's existing review if there is one, otherwise
 * prepends the new one. Matches on `authorId` first and falls back to
 * the deterministic id, so a review written by an older client — which
 * had the id but not yet the field — is still recognised as the same
 * person's.
 *
 * Legacy reviews with neither are left completely alone: they can't be
 * attributed to a user, so silently folding them into somebody's current
 * opinion would be a guess.
 */
function upsertReview(existing: ReviewItem[], incoming: ReviewItem): ReviewItem[] {
  const index = existing.findIndex(
    (r) => (incoming.authorId && r.authorId === incoming.authorId) || r.id === incoming.id,
  )
  if (index === -1) return [incoming, ...existing]
  const previous = existing[index]
  const next = [...existing]
  next[index] = {
    ...incoming,
    // An edit keeps the original submission time and records when it changed.
    createdAt: previous.createdAt ?? incoming.createdAt,
    updatedAt: Date.now(),
  }
  return next
}

/**
 * `reviewCount` is the number of distinct reviewers, not the number of
 * review documents — that's the whole point of the change. Once
 * duplicates are prevented the two numbers agree, but any duplicate
 * rows already sitting in the database (see the migration note on
 * submitTeacherReview) would otherwise keep inflating the total, so the
 * count is derived defensively.
 */
function aggregateReviews(reviews: ReviewItem[]): { rating: number; reviewCount: number } {
  const byReviewer = new Map<string, ReviewItem>()
  for (const review of reviews) {
    // Legacy rows without an author keep their own slot, keyed by review id.
    const key = review.authorId ?? `anon:${review.id}`
    const seen = byReviewer.get(key)
    // If duplicates exist, the most recently touched one wins.
    if (!seen || (review.updatedAt ?? review.createdAt ?? 0) > (seen.updatedAt ?? seen.createdAt ?? 0)) {
      byReviewer.set(key, review)
    }
  }
  const unique = [...byReviewer.values()]
  const reviewCount = unique.length
  if (reviewCount === 0) return { rating: 0, reviewCount: 0 }
  const rating = Math.round((unique.reduce((sum, r) => sum + r.rating, 0) / reviewCount) * 10) / 10
  return { rating, reviewCount }
}

function buildReviewItem(input: SubmitReviewInput): ReviewItem {
  return {
    id: buildReviewId(input.teacherId, input.authorId),
    authorId: input.authorId,
    author: input.author,
    authorInitials: input.authorInitials,
    authorColor: input.authorColor,
    ...(input.authorPhotoUrl ? { authorPhotoUrl: input.authorPhotoUrl } : {}),
    rating: input.rating,
    date: new Date().toLocaleDateString('pl-PL', { day: 'numeric', month: 'short', year: 'numeric' }),
    comment: input.comment,
    createdAt: Date.now(),
  }
}

function syncReviewsWithPublicIdentity(reviews: ReviewItem[], profile: TeacherPublicIdentity): { reviews: ReviewItem[]; changed: boolean } {
  let changed = false
  const next = reviews.map((review) => {
    if (review.authorId !== profile.id) return review
    const { authorPhotoUrl: _oldPhotoUrl, ...reviewWithoutPhoto } = review
    changed = true
    return {
      ...reviewWithoutPhoto,
      author: profile.name,
      authorInitials: profile.initials,
      authorColor: profile.avatarColor,
      ...(profile.photoUrl ? { authorPhotoUrl: profile.photoUrl } : {}),
    }
  })
  return { reviews: next, changed }
}

function snapshotTeacherProfile(teacher: Teacher): TeacherProfileSnapshot {
  return {
    name: teacher.name,
    initials: teacher.initials,
    avatarColor: teacher.avatarColor,
    ...(teacher.photoUrl ? { photoUrl: teacher.photoUrl } : {}),
    specialty: teacher.specialty,
    categoryId: teacher.categoryId,
    categoryIds: getTeacherCategoryIds(teacher),
    customSubjects: normalizeTeacherCustomSubjects(teacher.customSubjects),
    hourlyRate: teacher.hourlyRate,
    location: teacher.location,
    experience: teacher.experience,
    bio: teacher.bio,
    shortBio: teacher.shortBio,
    skills: teacher.skills,
    languages: teacher.languages,
    availability: teacher.availability,
    ...(teacher.availabilityStart ? { availabilityStart: teacher.availabilityStart } : {}),
    ...(teacher.availabilityEnd ? { availabilityEnd: teacher.availabilityEnd } : {}),
    featured: teacher.featured,
    responseTime: teacher.responseTime,
    completionRate: teacher.completionRate,
  }
}

function restoreProfileFromSnapshot(teacher: Teacher, previous: TeacherProfileSnapshot): Teacher {
  const { photoUrl: _oldPhotoUrl, previousProfile: _oldPreviousProfile, verificationKind: _oldVerificationKind, ...withoutDraftMeta } = teacher
  return {
    ...withoutDraftMeta,
    ...previous,
    ...(previous.photoUrl ? { photoUrl: previous.photoUrl } : {}),
    status: 'approved',
    verified: true,
  }
}

const APPLICATIONS_KEY = 'techbee.teachers.applications'

function isBrowser() {
  return typeof window !== 'undefined'
}

function readApplicationsMock(): Teacher[] {
  if (!isBrowser()) return []
  try {
    return JSON.parse(window.localStorage.getItem(APPLICATIONS_KEY) ?? '[]') as Teacher[]
  } catch {
    return []
  }
}

function writeApplicationsMock(list: Teacher[]) {
  if (!isBrowser()) return
  window.localStorage.setItem(APPLICATIONS_KEY, JSON.stringify(list))
}

function buildTeacherFromApplication(
  input: TeacherApplicationInput,
  authUser: { id: string; name: string; initials: string; avatarColor: string; photoUrl?: string },
  existing?: Teacher,
): Teacher {
  const photoUrl = 'photoUrl' in input
    ? input.photoUrl?.trim()
    : authUser.photoUrl ?? existing?.photoUrl
  const previousProfile = existing?.previousProfile
    ?? (existing && (existing.status ?? 'approved') === 'approved' ? snapshotTeacherProfile(existing) : undefined)
  const selectedCategoryIds = normalizeTeacherCategoryIds(input.categoryId, input.categoryIds)
  const primaryCategoryId = selectedCategoryIds.includes(input.categoryId)
    ? input.categoryId
    : selectedCategoryIds[0] ?? input.categoryId
  const customSubjects = normalizeTeacherCustomSubjects(input.customSubjects)

  return {
    id: authUser.id,
    name: authUser.name,
    initials: authUser.initials,
    avatarColor: authUser.avatarColor,
    ...(photoUrl ? { photoUrl } : {}),
    specialty: input.specialty,
    categoryId: primaryCategoryId,
    categoryIds: selectedCategoryIds,
    customSubjects,
    rating: existing?.rating ?? 0,
    reviewCount: existing?.reviewCount ?? 0,
    hourlyRate: input.hourlyRate,
    location: input.location,
    experience: input.experience,
    students: existing?.students ?? 0,
    lessons: existing?.lessons ?? 0,
    bio: input.bio,
    shortBio: input.shortBio,
    skills: input.skills,
    languages: input.languages,
    education: existing?.education ?? [],
    reviews: existing?.reviews ?? [],
    availability: input.availability,
    availabilityStart: input.availabilityStart,
    availabilityEnd: input.availabilityEnd,
    verified: false,
    featured: existing?.featured ?? false,
    responseTime: existing?.responseTime ?? '< 24 godz.',
    completionRate: existing?.completionRate ?? 100,
    status: 'pending',
    authUserId: authUser.id,
    submittedAt: Date.now(),
    verificationKind: previousProfile ? 'profile_update' : 'new_profile',
    ...(previousProfile ? { previousProfile } : {}),
  }
}

// ── Mock (localStorage) ──────────────────────────────────────

async function allTeachersMock(): Promise<Teacher[]> {
  return [...teachersData, ...readApplicationsMock()].filter(isTeacherApproved).map(applyReviewOverridesMock)
}

function submitApplicationMock(authUser: { id: string; name: string; initials: string; avatarColor: string; photoUrl?: string }, input: TeacherApplicationInput): Teacher {
  const list = readApplicationsMock()
  const existing = list.find((t) => t.authUserId === authUser.id)
  const teacher = buildTeacherFromApplication(input, authUser, existing)
  const next = existing ? list.map((t) => (t.authUserId === authUser.id ? teacher : t)) : [teacher, ...list]
  writeApplicationsMock(next)
  return teacher
}

function getApplicationForUserMock(authUserId: string): Teacher | undefined {
  return readApplicationsMock().find((t) => t.authUserId === authUserId)
    ?? teachersData.find((t) => t.authUserId === authUserId)
}

function getApplicationsMock(status: Teacher['status']): Teacher[] {
  return readApplicationsMock().filter((t) => t.status === status)
}

function reviewApplicationMock(id: string, decision: 'approved' | 'rejected') {
  const list = readApplicationsMock()
  writeApplicationsMock(
    list.map((t) => {
      if (t.id !== id) return t
      if (decision === 'approved') {
        const { previousProfile: _previousProfile, verificationKind: _verificationKind, ...approved } = t
        return { ...approved, status: 'approved', verified: true }
      }
      if (t.previousProfile) return restoreProfileFromSnapshot(t, t.previousProfile)
      return { ...t, status: 'rejected', verified: t.verified }
    }),
  )
}

// Static demo teachers aren't persisted anywhere mutable in mock mode, so
// featured-toggle/delete below only really take effect on real applications
// (i.e. once Firebase is configured, these act on real Firestore docs).
function allTeachersForAdminMock(): Teacher[] {
  return [...teachersData, ...readApplicationsMock()]
}

function setFeaturedMock(id: string, featured: boolean) {
  writeApplicationsMock(readApplicationsMock().map((t) => (t.id === id ? { ...t, featured } : t)))
}

function deleteTeacherMock(id: string) {
  writeApplicationsMock(readApplicationsMock().filter((t) => t.id !== id))
}

function syncTeacherPublicIdentityMock(profile: TeacherPublicIdentity): void {
  const list = readApplicationsMock()
  let changed = false
  const next = list.map((teacher) => {
    const reviewSync = syncReviewsWithPublicIdentity(teacher.reviews ?? [], profile)
    const isOwnTeacherProfile = teacher.authUserId === profile.id || teacher.id === profile.id
    if (!isOwnTeacherProfile && !reviewSync.changed) return teacher
    changed = true
    const identityPatch = isOwnTeacherProfile
      ? {
          name: profile.name,
          initials: profile.initials,
          avatarColor: profile.avatarColor,
          ...(profile.photoUrl ? { photoUrl: profile.photoUrl } : { photoUrl: undefined }),
        }
      : {}
    return {
      ...teacher,
      ...identityPatch,
      reviews: reviewSync.reviews,
    }
  })
  if (changed) writeApplicationsMock(next)
  if (!isBrowser()) return
  for (let i = 0; i < window.localStorage.length; i += 1) {
    const key = window.localStorage.key(i)
    if (!key?.startsWith('techbee.teachers.reviews.')) continue
    try {
      const stored = JSON.parse(window.localStorage.getItem(key) ?? '[]') as ReviewItem[]
      const reviewSync = syncReviewsWithPublicIdentity(stored, profile)
      if (reviewSync.changed) window.localStorage.setItem(key, JSON.stringify(reviewSync.reviews))
    } catch {
      // Ignore one malformed local override instead of blocking profile save.
    }
  }
}

// Static demo teachers (teachersData) aren't backed by any mutable store, so
// reviews added against them (or against a real application) are kept in
// their own small per-teacher key and merged in at read time — this lets
// rating/reviewCount stay real and moving in mock mode too, not just when
// Firebase is configured.
function reviewOverridesKey(teacherId: string) {
  return `techbee.teachers.reviews.${teacherId}`
}

function readReviewOverridesMock(teacherId: string): ReviewItem[] {
  if (!isBrowser()) return []
  try {
    return JSON.parse(window.localStorage.getItem(reviewOverridesKey(teacherId)) ?? '[]') as ReviewItem[]
  } catch {
    return []
  }
}

function applyReviewOverridesMock(teacher: Teacher): Teacher {
  const overrides = readReviewOverridesMock(teacher.id)
  if (overrides.length === 0) return teacher
  const reviews = [...overrides, ...teacher.reviews]
  return { ...teacher, reviews, ...aggregateReviews(reviews) }
}

function submitReviewMock(input: SubmitReviewInput): void {
  if (!isBrowser()) return
  const key = reviewOverridesKey(input.teacherId)
  const existing = readReviewOverridesMock(input.teacherId)
  window.localStorage.setItem(key, JSON.stringify(upsertReview(existing, buildReviewItem(input))))
}

/** This student's current review of this teacher in mock mode, if they've written one. */
function findReviewMock(teacherId: string, authorId: string): ReviewItem | undefined {
  const id = buildReviewId(teacherId, authorId)
  return readReviewOverridesMock(teacherId).find((r) => r.authorId === authorId || r.id === id)
}

// ── Firebase ──────────────────────────────────────────────────

async function allTeachersFirebase(): Promise<Teacher[]> {
  if (!db) return []
  const snap = await getDocs(query(collection(db, collections.teachers), where('status', '==', 'approved')))
  return snap.docs.map((d) => d.data() as Teacher).filter(isTeacherApproved)
}

function subscribeTeachersFirebase(callback: (teachers: Teacher[]) => void): () => void {
  if (!db) {
    callback([])
    return () => {}
  }
  return onSnapshot(query(collection(db, collections.teachers), where('status', '==', 'approved')), (snap) => {
    callback(snap.docs.map((d) => d.data() as Teacher).filter(isTeacherApproved))
  })
}

async function submitApplicationFirebase(
  authUser: { id: string; name: string; initials: string; avatarColor: string; photoUrl?: string },
  input: TeacherApplicationInput,
): Promise<Teacher> {
  if (!db) throw new Error('Firebase nie jest skonfigurowane.')
  const ref = doc(db, collections.teachers, authUser.id)
  const existingSnap = await getDoc(ref)
  const existing = existingSnap.exists() ? (existingSnap.data() as Teacher) : undefined
  const teacher = buildTeacherFromApplication(input, authUser, existing)
  // Merge keeps server-owned fields such as `stripe` intact. A full
  // overwrite would try to remove them and Firestore rules correctly block
  // that when a teacher resubmits a profile/rate change from the client.
  await setDoc(ref, teacher, { merge: true })
  return teacher
}

async function getApplicationForUserFirebase(authUserId: string): Promise<Teacher | undefined> {
  if (!db) return undefined
  const snap = await getDoc(doc(db, collections.teachers, authUserId))
  return snap.exists() ? (snap.data() as Teacher) : undefined
}

async function getApplicationsFirebase(status: Teacher['status']): Promise<Teacher[]> {
  if (!db) return []
  const snap = await getDocs(query(collection(db, collections.teachers), where('status', '==', status)))
  return snap.docs.map((d) => d.data() as Teacher)
}

async function reviewApplicationFirebase(id: string, decision: 'approved' | 'rejected'): Promise<void> {
  if (!db) return
  const ref = doc(db, collections.teachers, id)
  const snap = await getDoc(ref)
  const teacher = snap.exists() ? (snap.data() as Teacher) : undefined
  if (decision === 'approved') {
    await updateDoc(ref, {
      status: 'approved',
      verified: true,
      previousProfile: deleteField(),
      verificationKind: deleteField(),
    })
  } else if (teacher?.previousProfile) {
    await updateDoc(ref, {
      ...restoreProfileFromSnapshot(teacher, teacher.previousProfile),
      photoUrl: teacher.previousProfile.photoUrl ?? deleteField(),
      previousProfile: deleteField(),
      verificationKind: deleteField(),
    })
  } else {
    await updateDoc(ref, {
      status: 'rejected',
      previousProfile: deleteField(),
      verificationKind: deleteField(),
    })
  }
  // `id` is the applicant's own Firestore doc id, which is their real auth uid.
  createNotification({
    userId: id,
    type: 'system',
    title: decision === 'approved' ? 'Zgłoszenie zaakceptowane!' : 'Zgłoszenie odrzucone',
    description: decision === 'approved'
      ? 'Twój profil nauczyciela został zweryfikowany i jest teraz widoczny w giełdzie.'
      : teacher?.previousProfile
        ? 'Zmiana profilu została odrzucona. Poprzednia zatwierdzona wersja profilu pozostaje aktywna.'
        : 'Twoje zgłoszenie zostało odrzucone. Popraw dane w panelu i wyślij je ponownie.',
  })
}

async function allTeachersForAdminFirebase(): Promise<Teacher[]> {
  if (!db) return []
  const snap = await getDocs(collection(db, collections.teachers))
  return snap.docs.map((d) => d.data() as Teacher)
}

async function setFeaturedFirebase(id: string, featured: boolean) {
  if (!db) return
  await updateDoc(doc(db, collections.teachers, id), { featured })
}

async function deleteTeacherFirebase(id: string) {
  if (!db) return
  await deleteDoc(doc(db, collections.teachers, id))
}

async function syncTeacherPublicIdentityFirebase(profile: TeacherPublicIdentity): Promise<void> {
  if (!db) return
  const ownRef = doc(db, collections.teachers, profile.id)
  const [ownSnap, teachersSnap] = await Promise.all([
    getDoc(ownRef),
    getDocs(collection(db, collections.teachers)),
  ])
  const writes: Promise<void>[] = []
  if (ownSnap.exists()) {
    writes.push(updateDoc(ownRef, {
      name: profile.name,
      initials: profile.initials,
      avatarColor: profile.avatarColor,
      photoUrl: profile.photoUrl ?? '',
    }))
  }
  for (const teacherDoc of teachersSnap.docs) {
    const teacher = teacherDoc.data() as Teacher
    const reviewSync = syncReviewsWithPublicIdentity(teacher.reviews ?? [], profile)
    if (reviewSync.changed) {
      writes.push(updateDoc(teacherDoc.ref, { reviews: reviewSync.reviews }))
    }
  }
  await Promise.all(writes)
}

/**
 * Upserts this student's single review of this teacher and recomputes
 * rating/reviewCount from the full list.
 *
 * Runs inside a Firestore transaction. The average has to be derived
 * from every review, so this is unavoidably read-modify-write; doing it
 * transactionally is what stops two concurrent submissions (a double
 * click, two tabs, a retry after a flaky response) from each reading the
 * pre-write array and one of them clobbering the other — which under the
 * old append-based code produced exactly the duplicate rows this change
 * is meant to eliminate. Firestore retries the callback on contention,
 * and because `upsertReview` keys on the deterministic review id, a
 * replayed write is idempotent rather than additive.
 *
 * `firestore.rules` allows any signed-in user to update a teacher doc as
 * long as only these three fields change (see the `teachers/{teacherId}`
 * update rule), which is what lets a *student* write a review onto a
 * *teacher's* profile doc.
 */
async function submitReviewFirebase(input: SubmitReviewInput): Promise<void> {
  if (!db) return
  const database = db
  const ref = doc(database, collections.teachers, input.teacherId)

  await runTransaction(database, async (tx) => {
    const snap = await tx.get(ref)
    if (!snap.exists()) return
    const teacher = snap.data() as Teacher
    const reviews = upsertReview(teacher.reviews ?? [], buildReviewItem(input))
    tx.update(ref, { reviews, ...aggregateReviews(reviews) })
  })
}

/** This student's current review of this teacher in Firebase mode, if they've written one. */
async function findReviewFirebase(teacherId: string, authorId: string): Promise<ReviewItem | undefined> {
  if (!db) return undefined
  const snap = await getDoc(doc(db, collections.teachers, teacherId))
  if (!snap.exists()) return undefined
  const teacher = snap.data() as Teacher
  const id = buildReviewId(teacherId, authorId)
  return (teacher.reviews ?? []).find((r) => r.authorId === authorId || r.id === id)
}

// ── Public API ────────────────────────────────────────────────

export async function getTeachers(): Promise<Teacher[]> {
  return isFirebaseConfigured ? allTeachersFirebase() : allTeachersMock()
}

/** Live approved-teacher list for client views such as the marketplace. */
export function subscribeTeachers(callback: (teachers: Teacher[]) => void): () => void {
  if (isFirebaseConfigured) return subscribeTeachersFirebase(callback)
  let cancelled = false
  getTeachers().then((teachers) => {
    if (!cancelled) callback(teachers)
  })
  return () => { cancelled = true }
}

export async function getTeacherById(id: string): Promise<Teacher | undefined> {
  if (isFirebaseConfigured && db) {
    try {
      const snap = await getDoc(doc(db, collections.teachers, id))
      if (snap.exists()) return snap.data() as Teacher
    } catch {
      // Permission denied (e.g. a pending/rejected application viewed by
      // someone who isn't the applicant or an admin) — treat like "not found".
    }
    return undefined
  }
  const found = [...teachersData, ...readApplicationsMock()].find((t) => t.id === id)
  return found ? applyReviewOverridesMock(found) : undefined
}

export async function getFeaturedTeachers(): Promise<Teacher[]> {
  if (isFirebaseConfigured && db) {
    const snap = await getDocs(query(collection(db, collections.teachers), where('status', '==', 'approved'), where('featured', '==', true), limit(3)))
    return snap.docs.map((d) => d.data() as Teacher).filter(isTeacherApproved)
  }
  return (await getTeachers()).filter((t) => t.featured)
}

export async function getTeachersByCategory(categoryId: string): Promise<Teacher[]> {
  return (await getTeachers()).filter((t) => teacherMatchesCategory(t, categoryId))
}

export async function getTeacherReviews(id: string): Promise<ReviewItem[]> {
  const teacher = await getTeacherById(id)
  return teacher?.reviews ?? []
}

export async function getAllTeacherIds(): Promise<string[]> {
  if (isFirebaseConfigured && db) {
    const snap = await getDocs(query(collection(db, collections.teachers), where('status', '==', 'approved')))
    return snap.docs
      .filter((d) => isTeacherApproved(d.data() as Teacher))
      .map((d) => d.id)
  }
  return teachersData.filter(isTeacherApproved).map((t) => t.id)
}

/** The signed-in teacher's own application/profile, whatever its status — used to render their dashboard banner. */
export async function getTeacherApplication(authUserId: string): Promise<Teacher | undefined> {
  return isFirebaseConfigured ? getApplicationForUserFirebase(authUserId) : getApplicationForUserMock(authUserId)
}

/** Creates or re-submits a teacher's application. Always resets status to 'pending' for admin review. */
export async function submitTeacherApplication(
  authUser: { id: string; name: string; initials: string; avatarColor: string; photoUrl?: string },
  input: TeacherApplicationInput,
): Promise<Teacher> {
  return isFirebaseConfigured ? submitApplicationFirebase(authUser, input) : submitApplicationMock(authUser, input)
}

/** Admin-only: every application currently awaiting review. */
export async function getPendingTeacherApplications(): Promise<Teacher[]> {
  return isFirebaseConfigured ? getApplicationsFirebase('pending') : getApplicationsMock('pending')
}

/** Admin-only: approve (→ visible on the giełda, verified badge) or reject an application. Works on already-approved teachers too (i.e. can revoke). */
export async function reviewTeacherApplication(id: string, decision: 'approved' | 'rejected'): Promise<void> {
  return isFirebaseConfigured ? reviewApplicationFirebase(id, decision) : reviewApplicationMock(id, decision)
}

/** Admin-only: every teacher profile regardless of status — the full "manage the giełda" view. */
export async function getAllTeachersForAdmin(): Promise<Teacher[]> {
  return isFirebaseConfigured ? allTeachersForAdminFirebase() : allTeachersForAdminMock()
}

/** Admin-only: pin/unpin a teacher as "featured" on the landing page. */
export async function setTeacherFeatured(id: string, featured: boolean): Promise<void> {
  return isFirebaseConfigured ? setFeaturedFirebase(id, featured) : setFeaturedMock(id, featured)
}

/** Admin-only: permanently remove a teacher profile from the giełda. */
export async function deleteTeacherProfile(id: string): Promise<void> {
  return isFirebaseConfigured ? deleteTeacherFirebase(id) : deleteTeacherMock(id)
}

/** Updates only identity fields that are safe to publish immediately, without putting the teacher's professional profile back into verification. */
export async function syncTeacherPublicIdentity(profile: TeacherPublicIdentity): Promise<void> {
  return isFirebaseConfigured ? syncTeacherPublicIdentityFirebase(profile) : syncTeacherPublicIdentityMock(profile)
}

/**
 * A student creates or updates their single review of a teacher.
 *
 * Calling this twice for the same (student, teacher) pair updates the
 * existing review rather than adding a second one — see `upsertReview`.
 * Eligibility (the student must actually have completed a lesson with
 * this teacher) is enforced one level up, in
 * `submitTeacherReviewForStudent` in lessons.service.ts, which is the
 * only caller the UI uses.
 *
 * MIGRATION NOTE — existing data is deliberately left untouched. Any
 * duplicate reviews already written by the old append-based code keep
 * their original `rev-<timestamp>` ids and have no `authorId`, so they
 * cannot be attributed to a user and are neither merged nor deleted
 * here. `aggregateReviews` stops them inflating `reviewCount` beyond one
 * entry per identifiable reviewer, but each legacy row still counts as
 * its own anonymous reviewer. Collapsing them properly needs a one-off
 * backfill (match `author` display name to a user id, keep the newest
 * per pair, recompute rating/reviewCount) run before production — that
 * is a data migration, not something this write path should attempt
 * silently.
 */
export async function submitTeacherReview(input: SubmitReviewInput): Promise<void> {
  if (isFirebaseConfigured) {
    await submitReviewFirebase(input)
  } else {
    submitReviewMock(input)
  }
}

/** This student's existing review of this teacher, or undefined if they haven't written one. */
export async function getStudentReviewForTeacher(
  teacherId: string,
  authorId: string,
): Promise<ReviewItem | undefined> {
  return isFirebaseConfigured ? findReviewFirebase(teacherId, authorId) : findReviewMock(teacherId, authorId)
}

/**
 * Which of these teachers this student has already reviewed.
 *
 * Lets a dashboard ask once for the whole list instead of probing per
 * lesson, so the UI can prompt for a review a single time per teacher —
 * rather than after every completed lesson, which is what made the old
 * per-lesson model feel like nagging.
 */
export async function getReviewedTeacherIds(authorId: string, teacherIds: string[]): Promise<Set<string>> {
  const unique = [...new Set(teacherIds)]
  const results = await Promise.all(
    unique.map(async (teacherId) => ((await getStudentReviewForTeacher(teacherId, authorId)) ? teacherId : null)),
  )
  return new Set(results.filter((id): id is string => id !== null))
}
