import { NextResponse } from 'next/server'
import { adminDb } from '@/lib/firebase-admin'
import { collections } from '@/lib/firebase'
import type { BookedLessonSlot, Lesson } from '@/lib/types'

interface Props {
  params: Promise<{ teacherId: string }>
}

export async function GET(_request: Request, { params }: Props) {
  const { teacherId } = await params
  if (!teacherId) return NextResponse.json({ slots: [] })
  if (!adminDb) return NextResponse.json({ slots: [] })

  const teacherSnap = await adminDb.collection(collections.teachers).doc(teacherId).get()
  const teacher = teacherSnap.data() as { status?: string } | undefined
  if (!teacher || (teacher.status && teacher.status !== 'approved')) {
    return NextResponse.json({ slots: [] })
  }

  const snap = await adminDb
    .collection(collections.lessons)
    .where('teacherId', '==', teacherId)
    .where('status', 'in', ['pending', 'upcoming'])
    .get()

  const slots: BookedLessonSlot[] = snap.docs.map((doc) => {
    const lesson = doc.data() as Lesson
    return {
      id: doc.id,
      date: lesson.date,
      dateIso: lesson.dateIso,
      time: lesson.time,
      scheduledStartAt: lesson.scheduledStartAt,
      duration: lesson.duration,
      status: lesson.status,
    }
  })

  return NextResponse.json({ slots })
}

