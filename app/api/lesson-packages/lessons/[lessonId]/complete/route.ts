import { NextResponse } from 'next/server'
import { adminDb, isAdminConfigured } from '@/lib/firebase-admin'
import { verifyCaller } from '@/lib/stripe-server-auth'
import { collections } from '@/lib/firebase'
import { canCompletePackageLessonCredit } from '@/lib/lesson-package-actions-core'
import { completePackageLessonCredit } from '@/lib/lesson-package-credits.server'
import type { Lesson } from '@/lib/types'

export const runtime = 'nodejs'

export async function POST(request: Request, { params }: { params: Promise<{ lessonId: string }> }) {
  if (!isAdminConfigured || !adminDb) return NextResponse.json({ error: 'Zaufane zapisy Firestore nie są skonfigurowane.' }, { status: 503 })
  const { lessonId } = await params
  const body = await request.json().catch(() => ({}) as { idToken?: string })
  const uid = await verifyCaller(body.idToken)
  if (!uid) return NextResponse.json({ error: 'Musisz być zalogowany.' }, { status: 401 })

  const lessonSnap = await adminDb.collection(collections.lessons).doc(lessonId).get()
  if (!lessonSnap.exists) return NextResponse.json({ error: 'Nie znaleziono lekcji.' }, { status: 404 })
  const lesson = lessonSnap.data() as Lesson
  const allowed = canCompletePackageLessonCredit(lesson, uid)
  if (!allowed.ok) return NextResponse.json({ error: allowed.error }, { status: allowed.status })

  const result = await completePackageLessonCredit(lessonId)
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status })
  return NextResponse.json({ ok: true, alreadyApplied: result.alreadyApplied })
}
