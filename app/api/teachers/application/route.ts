import { NextResponse } from 'next/server'
import { FieldValue } from 'firebase-admin/firestore'
import { adminDb } from '@/lib/firebase-admin'
import { verifyCaller } from '@/lib/stripe-server-auth'
import { buildTeacherFromApplication, validateTeacherApplicationInput } from '@/lib/teacher-application-core'
import type { Teacher } from '@/lib/types'

export async function POST(request: Request) {
  if (!adminDb) return NextResponse.json({ error: 'Zapis zgłoszeń jest chwilowo niedostępny.' }, { status: 503 })
  const body = await request.json().catch(() => null)
  const uid = await verifyCaller(typeof body?.idToken === 'string' ? body.idToken : undefined)
  if (!uid) return NextResponse.json({ error: 'Zaloguj się ponownie.' }, { status: 401 })
  let input
  try { input = validateTeacherApplicationInput(body?.input) } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Nieprawidłowe zgłoszenie.' }, { status: 400 })
  }
  try {
    const database = adminDb
    const teacher = await database.runTransaction(async (tx) => {
      const userRef = database.collection('users').doc(uid)
      const ref = database.collection('teachers').doc(uid)
      const [userSnap, existingSnap] = await Promise.all([tx.get(userRef), tx.get(ref)])
      const user = userSnap.data()
      if (user?.role !== 'teacher' || ['deactivated', 'deleted'].includes(user?.accountStatus)) throw new Error('Brak uprawnień do zgłoszenia.')
      const teacher = buildTeacherFromApplication(input, {
        id: uid, name: user.name, initials: user.initials ?? '', avatarColor: user.avatarColor ?? '#F4B400', photoUrl: user.photoUrl,
      }, existingSnap.exists ? existingSnap.data() as Teacher : undefined)
      tx.set(ref, {
        ...teacher,
        availabilityHours: teacher.availabilityHours ?? FieldValue.delete(),
        trialLessonDuration: teacher.trialLessonEnabled ? teacher.trialLessonDuration : FieldValue.delete(),
        trialLessonPriceGrosze: teacher.trialLessonEnabled ? teacher.trialLessonPriceGrosze : FieldValue.delete(),
      }, { merge: true })
      return teacher
    })
    return NextResponse.json({ teacher })
  } catch {
    return NextResponse.json({ error: 'Nie udało się zapisać zgłoszenia. Sprawdź uprawnienia i spróbuj ponownie.' }, { status: 409 })
  }
}
