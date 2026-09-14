import { NextResponse } from 'next/server'
import { FieldValue } from 'firebase-admin/firestore'
import { adminDb, isAdminConfigured } from '@/lib/firebase-admin'
import { collections } from '@/lib/firebase'
import { getVerifiedUserRole, verifyCaller } from '@/lib/stripe-server-auth'
import type { StudentLinkCode } from '@/lib/types'

interface RedeemLinkCodeBody {
  idToken?: string
  code?: string
}

export async function POST(request: Request) {
  if (!isAdminConfigured || !adminDb) {
    return NextResponse.json({ error: 'Zaufane zapisy Firestore nie są skonfigurowane.' }, { status: 503 })
  }

  let body: RedeemLinkCodeBody
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Nieprawidłowe żądanie.' }, { status: 400 })
  }

  const parentId = await verifyCaller(body.idToken)
  if (!parentId) return NextResponse.json({ error: 'Musisz być zalogowany.' }, { status: 401 })

  const role = await getVerifiedUserRole(parentId)
  if (role !== 'parent') {
    return NextResponse.json({ error: 'Kod może wykorzystać tylko konto rodzica.' }, { status: 403 })
  }

  const code = body.code?.trim().toUpperCase()
  if (!code) return NextResponse.json({ error: 'Wpisz kod.' }, { status: 400 })

  try {
    const result = await adminDb.runTransaction(async (tx) => {
      const codeRef = adminDb!.collection(collections.linkCodes).doc(code)
      const codeSnap = await tx.get(codeRef)
      if (!codeSnap.exists) throw new Error('Nieprawidłowy kod.')

      const entry = codeSnap.data() as StudentLinkCode
      if (entry.usedByParentId) throw new Error('Ten kod został już wykorzystany.')
      if (entry.expiresAt < Date.now()) throw new Error('Ten kod wygasł - poproś ucznia o nowy.')
      if (entry.studentId === parentId) throw new Error('Nie możesz połączyć konta z samym sobą.')

      const studentRef = adminDb!.collection(collections.users).doc(entry.studentId)
      const studentSnap = await tx.get(studentRef)
      if (!studentSnap.exists) throw new Error('Nie znaleziono konta ucznia.')

      tx.update(codeRef, { usedByParentId: parentId, usedAt: Date.now() })
      tx.update(adminDb!.collection(collections.users).doc(parentId), {
        linkedStudentIds: FieldValue.arrayUnion(entry.studentId),
      })
      tx.update(studentRef, {
        linkedParentIds: FieldValue.arrayUnion(parentId),
      })

      return { studentId: entry.studentId, studentName: entry.studentName }
    })

    return NextResponse.json({ ok: true, ...result })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Nie udało się wykorzystać kodu.'
    return NextResponse.json({ ok: false, error: message }, { status: 400 })
  }
}
