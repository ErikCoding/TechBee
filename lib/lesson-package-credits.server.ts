import 'server-only'
import { adminDb, isAdminConfigured } from '@/lib/firebase-admin'
import { collections } from '@/lib/firebase'
import { completeReservedPackageCredit, returnReservedPackageCredit } from '@/lib/lesson-packages-core'
import type { Lesson, LessonPackage } from '@/lib/types'

export type PackageCreditUpdateResult =
  | { ok: true; alreadyApplied: boolean }
  | { ok: false; status: number; error: string }

export async function completePackageLessonCredit(lessonId: string, now = Date.now()): Promise<PackageCreditUpdateResult> {
  if (!isAdminConfigured || !adminDb) {
    return { ok: false, status: 503, error: 'Zaufane zapisy Firestore nie są skonfigurowane.' }
  }
  const database = adminDb
  const lessonRef = database.collection(collections.lessons).doc(lessonId)

  return database.runTransaction(async (tx): Promise<PackageCreditUpdateResult> => {
    const lessonSnap = await tx.get(lessonRef)
    if (!lessonSnap.exists) return { ok: false, status: 404, error: 'Nie znaleziono lekcji.' }
    const lesson = { id: lessonSnap.id, ...lessonSnap.data() } as Lesson
    if (lesson.paymentSource !== 'package' || !lesson.packageId) return { ok: false, status: 400, error: 'Ta lekcja nie korzysta z pakietu.' }
    if (lesson.packageCreditState === 'used') return { ok: true, alreadyApplied: true }
    if (lesson.packageCreditState !== 'reserved') return { ok: false, status: 409, error: 'Kredyt tej lekcji nie jest w stanie reserved.' }
    if (lesson.status === 'cancelled') return { ok: false, status: 409, error: 'Anulowanej lekcji nie można oznaczyć jako odbytej.' }

    const packageRef = database.collection(collections.lessonPackages).doc(lesson.packageId)
    const packageSnap = await tx.get(packageRef)
    if (!packageSnap.exists) return { ok: false, status: 404, error: 'Nie znaleziono pakietu lekcji.' }
    const pkg = { id: packageSnap.id, ...packageSnap.data() } as LessonPackage
    const nextPackage = completeReservedPackageCredit(pkg, lesson.packageCreditState)

    tx.update(packageRef, {
      reservedCredits: nextPackage.reservedCredits,
      usedCredits: nextPackage.usedCredits,
      status: nextPackage.status,
      updatedAt: now,
    })
    tx.update(lessonRef, {
      status: 'completed',
      completedAt: lesson.completedAt ?? now,
      packageCreditState: 'used',
    })
    return { ok: true, alreadyApplied: false }
  })
}

export async function returnPackageLessonCredit(lessonId: string, now = Date.now()): Promise<PackageCreditUpdateResult> {
  if (!isAdminConfigured || !adminDb) {
    return { ok: false, status: 503, error: 'Zaufane zapisy Firestore nie są skonfigurowane.' }
  }
  const database = adminDb
  const lessonRef = database.collection(collections.lessons).doc(lessonId)

  return database.runTransaction(async (tx): Promise<PackageCreditUpdateResult> => {
    const lessonSnap = await tx.get(lessonRef)
    if (!lessonSnap.exists) return { ok: false, status: 404, error: 'Nie znaleziono lekcji.' }
    const lesson = { id: lessonSnap.id, ...lessonSnap.data() } as Lesson
    if (lesson.paymentSource !== 'package' || !lesson.packageId) return { ok: false, status: 400, error: 'Ta lekcja nie korzysta z pakietu.' }
    if (lesson.packageCreditState === 'returned') return { ok: true, alreadyApplied: true }
    if (lesson.packageCreditState !== 'reserved') return { ok: false, status: 409, error: 'Tego kredytu nie można już zwrócić automatycznie.' }
    if (lesson.status === 'completed' || lesson.stripeTransferId || lesson.paymentReleased) {
      return { ok: false, status: 409, error: 'Odbytej lub rozliczonej lekcji z pakietu nie można zwrócić do pakietu.' }
    }

    const packageRef = database.collection(collections.lessonPackages).doc(lesson.packageId)
    const packageSnap = await tx.get(packageRef)
    if (!packageSnap.exists) return { ok: false, status: 404, error: 'Nie znaleziono pakietu lekcji.' }
    const pkg = { id: packageSnap.id, ...packageSnap.data() } as LessonPackage
    const nextPackage = returnReservedPackageCredit(pkg, lesson.packageCreditState)

    tx.update(packageRef, {
      remainingCredits: nextPackage.remainingCredits,
      reservedCredits: nextPackage.reservedCredits,
      status: nextPackage.status,
      updatedAt: now,
    })
    tx.update(lessonRef, {
      status: 'cancelled',
      pendingChange: null,
      packageCreditState: 'returned',
    })
    return { ok: true, alreadyApplied: false }
  })
}
