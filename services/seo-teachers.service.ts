import 'server-only'

import { collections } from '@/lib/firebase'
import { adminDb, isAdminConfigured } from '@/lib/firebase-admin'
import type { Teacher } from '@/lib/types'
import { getTeachers, isTeacherApproved } from '@/services/teachers.service'

function withDocumentId(docId: string, data: FirebaseFirestore.DocumentData): Teacher {
  const teacher = data as Teacher
  return {
    ...teacher,
    id: teacher.id || docId,
  }
}

export async function getPublicTeachersForSitemap(): Promise<Teacher[]> {
  if (!isAdminConfigured || !adminDb) {
    return getTeachers()
  }

  const snap = await adminDb.collection(collections.teachers).get()
  return snap.docs
    .map((doc) => withDocumentId(doc.id, doc.data()))
    .filter(isTeacherApproved)
}
