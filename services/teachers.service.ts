import { collection, deleteDoc, doc, getDoc, getDocs, query, setDoc, updateDoc, where } from 'firebase/firestore'
import { teachersData } from '@/data/teachers.data'
import { collections, db, isFirebaseConfigured } from '@/lib/firebase'
import { createNotification } from '@/services/notifications.service'
import type { ReviewItem, Teacher, TeacherApplicationInput } from '@/lib/types'

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
  return (t.status ?? 'approved') === 'approved'
}

export interface SubmitReviewInput {
  teacherId: string
  author: string
  authorInitials: string
  authorColor: string
  rating: number
  comment: string
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
  authUser: { id: string; name: string; initials: string; avatarColor: string },
  existing?: Teacher,
): Teacher {
  return {
    id: authUser.id,
    name: authUser.name,
    initials: authUser.initials,
    avatarColor: authUser.avatarColor,
    specialty: input.specialty,
    categoryId: input.categoryId,
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
    featured: false,
    responseTime: existing?.responseTime ?? '< 24 godz.',
    completionRate: existing?.completionRate ?? 100,
    status: 'pending',
    authUserId: authUser.id,
    submittedAt: Date.now(),
  }
}

// ── Mock (localStorage) ──────────────────────────────────────

async function allTeachersMock(): Promise<Teacher[]> {
  return [...teachersData, ...readApplicationsMock()].filter(isTeacherApproved).map(applyReviewOverridesMock)
}

function submitApplicationMock(authUser: { id: string; name: string; initials: string; avatarColor: string }, input: TeacherApplicationInput): Teacher {
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
    list.map((t) => (t.id === id ? { ...t, status: decision, verified: decision === 'approved' ? true : t.verified } : t)),
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
  const reviewCount = reviews.length
  const rating = Math.round((reviews.reduce((sum, r) => sum + r.rating, 0) / reviewCount) * 10) / 10
  return { ...teacher, reviews, reviewCount, rating }
}

function submitReviewMock(input: SubmitReviewInput): void {
  if (!isBrowser()) return
  const review: ReviewItem = {
    id: `rev-${Date.now()}`,
    author: input.author,
    authorInitials: input.authorInitials,
    authorColor: input.authorColor,
    rating: input.rating,
    date: new Date().toLocaleDateString('pl-PL', { day: 'numeric', month: 'short', year: 'numeric' }),
    comment: input.comment,
  }
  const key = reviewOverridesKey(input.teacherId)
  const existing = readReviewOverridesMock(input.teacherId)
  window.localStorage.setItem(key, JSON.stringify([review, ...existing]))
}

// ── Firebase ──────────────────────────────────────────────────

async function allTeachersFirebase(): Promise<Teacher[]> {
  if (!db) return teachersData.filter(isTeacherApproved)
  const snap = await getDocs(collection(db, collections.teachers))
  if (!snap.empty) return snap.docs.map((d) => d.data() as Teacher).filter(isTeacherApproved)
  return teachersData.filter(isTeacherApproved)
}

async function submitApplicationFirebase(
  authUser: { id: string; name: string; initials: string; avatarColor: string },
  input: TeacherApplicationInput,
): Promise<Teacher> {
  if (!db) throw new Error('Firebase nie jest skonfigurowane.')
  const ref = doc(db, collections.teachers, authUser.id)
  const existingSnap = await getDoc(ref)
  const existing = existingSnap.exists() ? (existingSnap.data() as Teacher) : undefined
  const teacher = buildTeacherFromApplication(input, authUser, existing)
  await setDoc(ref, teacher)
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
  await updateDoc(doc(db, collections.teachers, id), decision === 'approved' ? { status: 'approved', verified: true } : { status: 'rejected' })
  // `id` is the applicant's own Firestore doc id, which is their real auth uid.
  createNotification({
    userId: id,
    type: 'system',
    title: decision === 'approved' ? 'Zgłoszenie zaakceptowane!' : 'Zgłoszenie odrzucone',
    description: decision === 'approved'
      ? 'Twój profil nauczyciela został zweryfikowany i jest teraz widoczny w giełdzie.'
      : 'Twoje zgłoszenie zostało odrzucone. Popraw dane w panelu i wyślij je ponownie.',
  })
}

async function allTeachersForAdminFirebase(): Promise<Teacher[]> {
  if (!db) return teachersData
  const snap = await getDocs(collection(db, collections.teachers))
  if (!snap.empty) return snap.docs.map((d) => d.data() as Teacher)
  return teachersData
}

async function setFeaturedFirebase(id: string, featured: boolean) {
  if (!db) return
  await updateDoc(doc(db, collections.teachers, id), { featured })
}

async function deleteTeacherFirebase(id: string) {
  if (!db) return
  await deleteDoc(doc(db, collections.teachers, id))
}

/**
 * Appends a review and recomputes rating/reviewCount from scratch —
 * read-modify-write rather than an atomic increment, since the average
 * has to be derived from the full review list. `firestore.rules` allows
 * any signed-in user to update a teacher doc as long as only these three
 * fields change (see the `teachers/{teacherId}` update rule), which is
 * what lets a *student* write a review onto a *teacher's* profile doc.
 */
async function submitReviewFirebase(input: SubmitReviewInput): Promise<void> {
  if (!db) return
  const ref = doc(db, collections.teachers, input.teacherId)
  const snap = await getDoc(ref)
  if (!snap.exists()) return
  const teacher = snap.data() as Teacher
  const review: ReviewItem = {
    id: `rev-${Date.now()}`,
    author: input.author,
    authorInitials: input.authorInitials,
    authorColor: input.authorColor,
    rating: input.rating,
    date: new Date().toLocaleDateString('pl-PL', { day: 'numeric', month: 'short', year: 'numeric' }),
    comment: input.comment,
  }
  const reviews = [review, ...(teacher.reviews ?? [])]
  const reviewCount = reviews.length
  const rating = Math.round((reviews.reduce((sum, r) => sum + r.rating, 0) / reviewCount) * 10) / 10
  await updateDoc(ref, { reviews, rating, reviewCount })
}

// ── Public API ────────────────────────────────────────────────

export async function getTeachers(): Promise<Teacher[]> {
  return isFirebaseConfigured ? allTeachersFirebase() : allTeachersMock()
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
  return (await getTeachers()).filter((t) => t.featured)
}

export async function getTeachersByCategory(categoryId: string): Promise<Teacher[]> {
  return (await getTeachers()).filter((t) => t.categoryId === categoryId)
}

export async function getTeacherReviews(id: string): Promise<ReviewItem[]> {
  const teacher = await getTeacherById(id)
  return teacher?.reviews ?? []
}

export async function getAllTeacherIds(): Promise<string[]> {
  return teachersData.map((t) => t.id)
}

/** The signed-in teacher's own application/profile, whatever its status — used to render their dashboard banner. */
export async function getTeacherApplication(authUserId: string): Promise<Teacher | undefined> {
  return isFirebaseConfigured ? getApplicationForUserFirebase(authUserId) : getApplicationForUserMock(authUserId)
}

/** Creates or re-submits a teacher's application. Always resets status to 'pending' for admin review. */
export async function submitTeacherApplication(
  authUser: { id: string; name: string; initials: string; avatarColor: string },
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

/** A student rates/reviews a teacher after a completed lesson — appends a real review and recomputes rating/reviewCount. See submitLessonReview in lessons.service.ts, which also marks the lesson as reviewed so the prompt doesn't show twice. */
export async function submitTeacherReview(input: SubmitReviewInput): Promise<void> {
  if (isFirebaseConfigured) {
    await submitReviewFirebase(input)
  } else {
    submitReviewMock(input)
  }
}
