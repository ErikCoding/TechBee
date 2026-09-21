import { NextResponse } from 'next/server'
import { FieldValue, type UpdateData } from 'firebase-admin/firestore'
import { adminDb } from '@/lib/firebase-admin'
import { collections } from '@/lib/firebase'
import { requireAdminRequest } from '@/lib/admin-api-auth'
import {
  applyFoundingTeacherAwardInTransaction,
  recordFoundingTeacherAwardAudit,
} from '@/lib/founding-teacher-program'
import { FOUNDING_TEACHER_CONFIG_DOC_ID, normalizeFoundingTeacherConfig } from '@/lib/founding-teacher-core'
import { normalizeLessonDurations } from '@/lib/lesson-durations'
import type { Teacher, TeacherProfileSnapshot } from '@/lib/types'

export const runtime = 'nodejs'

function restorePatch(previous: TeacherProfileSnapshot): UpdateData<Teacher> {
  return {
    ...previous,
    lessonDurations: normalizeLessonDurations(previous.lessonDurations),
    photoUrl: previous.photoUrl ?? FieldValue.delete(),
    availabilityHours: previous.availabilityHours ?? FieldValue.delete(),
    status: 'approved',
    verified: true,
    previousProfile: FieldValue.delete(),
    verificationKind: FieldValue.delete(),
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ teacherId: string }> },
) {
  const body = await request.json().catch(() => ({}) as { idToken?: string; decision?: 'approved' | 'rejected' })
  const admin = await requireAdminRequest(body.idToken, 'weryfikacjami nauczycieli')
  if (admin instanceof NextResponse) return admin
  const { teacherId } = await params
  const decision = body.decision
  if (decision !== 'approved' && decision !== 'rejected') {
    return NextResponse.json({ error: 'Nieprawidłowa decyzja.' }, { status: 400 })
  }

  const now = Date.now()
  const teacherRef = adminDb!.collection(collections.teachers).doc(teacherId)
  const configRef = adminDb!.collection(collections.platformSettings).doc(FOUNDING_TEACHER_CONFIG_DOC_ID)

  let result: {
    notification: { title: string; description: string }
    awarded: { number: number; promotion: NonNullable<Teacher['foundingTeacherPromotion']>; name: string } | null
  }
  try {
    result = await adminDb!.runTransaction(async (tx) => {
    const [teacherSnap, configSnap] = await Promise.all([
      tx.get(teacherRef),
      tx.get(configRef),
    ])
    if (!teacherSnap.exists) throw new Error('Nie znaleziono zgłoszenia nauczyciela.')
    const teacher = { ...(teacherSnap.data() as Teacher), id: teacherSnap.id }
    let notification: { title: string; description: string }
    let awarded: { number: number; promotion: NonNullable<Teacher['foundingTeacherPromotion']>; name: string } | null = null

    if (decision === 'approved') {
      const approvedAt = typeof (teacher as Teacher & { approvedAt?: unknown }).approvedAt === 'number'
        ? (teacher as Teacher & { approvedAt: number }).approvedAt
        : now
      tx.update(teacherRef, {
        status: 'approved',
        verified: true,
        approvedAt,
        previousProfile: FieldValue.delete(),
        verificationKind: FieldValue.delete(),
      })
      const config = normalizeFoundingTeacherConfig(configSnap.exists ? configSnap.data() : null)
      const result = applyFoundingTeacherAwardInTransaction({
        tx,
        teacherRef,
        teacher: { ...teacher, status: 'approved' } as Teacher & { approvedAt?: number },
        config,
        adminId: admin.uid,
        now,
      })
      if (result) {
        awarded = { number: result.number, promotion: result.promotion, name: teacher.name }
      }
      notification = {
        title: 'Zgłoszenie zaakceptowane!',
        description: 'Twój profil nauczyciela został zweryfikowany i jest teraz widoczny w giełdzie.',
      }
    } else if (teacher.previousProfile) {
      tx.update(teacherRef, restorePatch(teacher.previousProfile))
      notification = {
        title: 'Zgłoszenie odrzucone',
        description: 'Zmiana profilu została odrzucona. Poprzednia zatwierdzona wersja profilu pozostaje aktywna.',
      }
    } else {
      tx.update(teacherRef, {
        status: 'rejected',
        previousProfile: FieldValue.delete(),
        verificationKind: FieldValue.delete(),
      })
      notification = {
        title: 'Zgłoszenie odrzucone',
        description: 'Twoje zgłoszenie zostało odrzucone. Popraw dane w panelu i wyślij je ponownie.',
      }
    }
    return { notification, awarded }
    })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Nie udało się zapisać decyzji.' }, { status: 400 })
  }

  const writes: Promise<unknown>[] = []
  writes.push(adminDb!.collection(collections.notifications).add({
    userId: teacherId,
    type: 'system',
    title: result.notification.title,
    description: result.notification.description,
    date: new Date(now).toLocaleDateString('pl-PL', { day: 'numeric', month: 'short', year: 'numeric' }),
    read: false,
    createdAt: now,
  }))
  if (result.awarded) {
    writes.push(recordFoundingTeacherAwardAudit({
      adminId: admin.uid,
      teacherId,
      teacherName: result.awarded.name,
      number: result.awarded.number,
      promotion: result.awarded.promotion,
    }))
  }
  await Promise.all(writes)

  return NextResponse.json({ ok: true, awarded: result.awarded })
}
