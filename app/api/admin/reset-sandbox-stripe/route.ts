import { NextResponse } from 'next/server'
import { adminDb, isAdminConfigured } from '@/lib/firebase-admin'
import { collections } from '@/lib/firebase'
import { verifyCaller, getVerifiedUserRole } from '@/lib/stripe-server-auth'
import type { Lesson } from '@/lib/types'

// ─────────────────────────────────────────────────────────────
// Admin-only "clear sandbox Stripe activity" button (see
// components/admin/admin-sandbox-reset-panel.tsx) — separate from the
// broader "reset activity data" button (app/api/admin/reset-activity),
// which wipes everything including real messages. This one only
// removes lessons booked with Stripe *test-mode* keys (see the
// Lesson.livemode doc comment in lib/types.ts and
// app/api/admin/platform-wallet/route.ts, which already filters the
// same way for display) — so a teacher/admin doing local `npm run dev`
// testing against the Stripe sandbox can clear that noise out without
// touching a single real, live booking or any chat/message history.
//
// Also removes the matching `lessonSlotLocks` docs (keyed by
// teacherId+dateIso+time, but each one stores the `lessonId` it
// belongs to) so a cleared sandbox booking doesn't leave a phantom
// "this slot is taken" lock behind.
// ─────────────────────────────────────────────────────────────

export const runtime = 'nodejs'

const BATCH_LIMIT = 450

export async function POST(request: Request) {
  if (!isAdminConfigured) {
    return NextResponse.json({ error: 'Zaufane zapisy Firestore nie są skonfigurowane.' }, { status: 503 })
  }

  let body: { idToken?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Nieprawidłowe żądanie.' }, { status: 400 })
  }

  const uid = await verifyCaller(body.idToken)
  if (!uid) return NextResponse.json({ error: 'Musisz być zalogowany.' }, { status: 401 })
  const role = await getVerifiedUserRole(uid)
  if (role !== 'admin') return NextResponse.json({ error: 'Tylko administrator może to zrobić.' }, { status: 403 })

  try {
    const lessonsSnap = await adminDb!.collection(collections.lessons).get()
    const sandboxLessonDocs = lessonsSnap.docs.filter((d) => !(d.data() as Omit<Lesson, 'id'>).livemode)
    const sandboxLessonIds = new Set(sandboxLessonDocs.map((d) => d.id))

    const locksSnap = await adminDb!.collection(collections.lessonSlotLocks).get()
    const sandboxLockDocs = locksSnap.docs.filter((d) => sandboxLessonIds.has(d.data().lessonId))

    const allRefs = [...sandboxLessonDocs.map((d) => d.ref), ...sandboxLockDocs.map((d) => d.ref)]
    for (let i = 0; i < allRefs.length; i += BATCH_LIMIT) {
      const batch = adminDb!.batch()
      for (const ref of allRefs.slice(i, i + BATCH_LIMIT)) batch.delete(ref)
      await batch.commit()
    }

    return NextResponse.json({
      deletedLessons: sandboxLessonDocs.length,
      deletedSlotLocks: sandboxLockDocs.length,
    })
  } catch (err) {
    console.error('[admin/reset-sandbox-stripe] Failed:', err)
    return NextResponse.json({ error: 'Nie udało się wyczyścić danych sandboxa.' }, { status: 500 })
  }
}
