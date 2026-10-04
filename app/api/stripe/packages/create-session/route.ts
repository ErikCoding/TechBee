import { NextResponse } from 'next/server'
import { stripe } from '@/lib/stripe'
import { adminDb } from '@/lib/firebase-admin'
import { requireStripeBackend, verifyCaller } from '@/lib/stripe-server-auth'
import { getOrigin } from '@/lib/request-origin'
import { splitPayment, toGrosze, STRIPE_CURRENCY } from '@/lib/stripe-config'
import { getPlatformPaymentSettings } from '@/lib/platform-payment-settings'
import { resolveEffectiveCommission } from '@/lib/founding-teacher-core'
import { collections } from '@/lib/firebase'
import { categoriesData } from '@/data/categories.data'
import { getTeacherCategoryIds, getTeacherCustomSubjects } from '@/lib/teacher-categories'
import { LESSON_DURATION_OPTIONS, normalizeLessonDurations } from '@/lib/lesson-durations'
import { calculateLessonPackageTerms, normalizeLessonPackageSize, packageSubjectKey, teacherOffersLessonPackageSize } from '@/lib/lesson-packages-core'
import type { AvailabilityHours, FoundingTeacherPromotion } from '@/lib/types'

export const runtime = 'nodejs'

const ALLOWED_DURATIONS: number[] = LESSON_DURATION_OPTIONS.map((option) => option.minutes)
const METADATA_MAX_LENGTH = 480

function safeMetaText(value: string): string {
  return value.length > METADATA_MAX_LENGTH ? value.slice(0, METADATA_MAX_LENGTH) : value
}

function safeMetaPhotoUrl(url: string | undefined): string {
  if (!url || url.length > METADATA_MAX_LENGTH) return ''
  return url
}

interface PackageCheckoutRequestBody {
  idToken?: string
  teacherId?: string
  packageSize?: number
  duration?: number
  subjectCategoryId?: string
  specialty?: string
  studentId?: string
  studentName?: string
  payer?: { id: string; role: 'student' | 'parent' }
}

export async function POST(request: Request) {
  const backendError = requireStripeBackend()
  if (backendError) return backendError

  let body: PackageCheckoutRequestBody
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Nieprawidłowe żądanie.' }, { status: 400 })
  }

  const { teacherId, duration, subjectCategoryId, specialty, studentId, studentName, payer } = body
  const packageSize = normalizeLessonPackageSize(body.packageSize)
  if (!teacherId || !duration || !studentId || !studentName || !packageSize) {
    return NextResponse.json({ error: 'Brak wymaganych danych pakietu.' }, { status: 400 })
  }
  if (!ALLOWED_DURATIONS.includes(duration)) {
    return NextResponse.json({ error: 'Nieprawidłowa długość lekcji.' }, { status: 400 })
  }

  const uid = await verifyCaller(body.idToken)
  if (!uid) return NextResponse.json({ error: 'Musisz być zalogowany.' }, { status: 401 })

  const payerId = payer?.id ?? studentId
  const payerRole = payer?.role ?? 'student'
  if (payerRole !== 'student' && payerRole !== 'parent') {
    return NextResponse.json({ error: 'Nieprawidłowy typ płatnika.' }, { status: 400 })
  }
  if (uid !== payerId) {
    return NextResponse.json({ error: 'Nie możesz opłacić pakietu w imieniu innej osoby.' }, { status: 403 })
  }

  const [payerSnap, studentSnap, teacherSnap] = await Promise.all([
    adminDb!.collection(collections.users).doc(uid).get(),
    adminDb!.collection(collections.users).doc(studentId).get(),
    adminDb!.collection(collections.teachers).doc(teacherId).get(),
  ])
  const payerProfile = payerSnap.data() as { role?: string } | undefined
  const studentProfile = studentSnap.data() as { role?: string; linkedParentIds?: string[] } | undefined
  if (!payerProfile || !studentProfile || studentProfile.role !== 'student') {
    return NextResponse.json({ error: 'Nie znaleziono konta ucznia.' }, { status: 404 })
  }
  if (payerRole === 'student') {
    if (uid !== studentId || payerProfile.role !== 'student') {
      return NextResponse.json({ error: 'Uczeń może kupić pakiet tylko dla siebie.' }, { status: 403 })
    }
  } else if (payerProfile.role !== 'parent' || !studentProfile.linkedParentIds?.includes(uid)) {
    return NextResponse.json({ error: 'Ten rodzic nie jest połączony z kontem ucznia.' }, { status: 403 })
  }

  const teacher = teacherSnap.data() as
    | { name?: string; initials?: string; avatarColor?: string; photoUrl?: string; specialty?: string; categoryId?: string; categoryIds?: string[]; customSubjects?: string[]; hourlyRate?: number; status?: string; lessonDurations?: number[]; lessonPackageSizes?: number[]; availabilityHours?: AvailabilityHours; foundingTeacherPromotion?: FoundingTeacherPromotion }
    | undefined
  if (!teacher || !teacher.hourlyRate || (teacher.status && teacher.status !== 'approved')) {
    return NextResponse.json({ error: 'Nie znaleziono tego nauczyciela.' }, { status: 404 })
  }
  if (!teacherOffersLessonPackageSize(teacher, packageSize)) {
    return NextResponse.json({ error: 'Ten nauczyciel nie oferuje wybranego pakietu lekcji.' }, { status: 409 })
  }
  if (!normalizeLessonDurations(teacher.lessonDurations).includes(duration)) {
    return NextResponse.json({ error: 'Ten nauczyciel nie oferuje wybranej długości lekcji.' }, { status: 409 })
  }

  const teacherCategoryIds = getTeacherCategoryIds({
    categoryId: teacher.categoryId ?? '',
    categoryIds: teacher.categoryIds,
  })
  if (subjectCategoryId && !teacherCategoryIds.includes(subjectCategoryId)) {
    return NextResponse.json({ error: 'Ten nauczyciel nie prowadzi lekcji z wybranego przedmiotu.' }, { status: 409 })
  }
  const requestedCustomSubject = specialty?.trim()
  const customSubject = requestedCustomSubject
    ? getTeacherCustomSubjects({ customSubjects: teacher.customSubjects }).find((subject) => subject.toLowerCase() === requestedCustomSubject.toLowerCase())
    : undefined
  if (!subjectCategoryId && requestedCustomSubject && requestedCustomSubject !== teacher.specialty && !customSubject) {
    return NextResponse.json({ error: 'Ten nauczyciel nie prowadzi lekcji z wybranego przedmiotu.' }, { status: 409 })
  }

  const selectedSubjectCategoryId = subjectCategoryId ?? (customSubject ? undefined : teacherCategoryIds[0])
  const selectedSubjectName = selectedSubjectCategoryId
    ? categoriesData.find((category) => category.id === selectedSubjectCategoryId)?.name
    : undefined
  const selectedSpecialty = safeMetaText(selectedSubjectName || customSubject || teacher.specialty || '')
  const selectedSubjectKey = packageSubjectKey({ subjectCategoryId: selectedSubjectCategoryId, specialty: selectedSpecialty })
  if (!selectedSubjectKey) {
    return NextResponse.json({ error: 'Wybierz przedmiot pakietu.' }, { status: 400 })
  }

  const perLessonGrossGrosze = toGrosze(Math.round((teacher.hourlyRate / 60) * duration))
  const paymentSettings = await getPlatformPaymentSettings()
  const { effectiveCommissionPercent, commissionSource } = resolveEffectiveCommission({
    standardCommissionPercent: paymentSettings.commissionPercent,
    foundingTeacherPromotion: teacher.foundingTeacherPromotion,
  })
  const { platformFeeGrosze, teacherAmountGrosze } = splitPayment(perLessonGrossGrosze, effectiveCommissionPercent)
  const terms = calculateLessonPackageTerms({
    packageSize,
    perLessonGrossGrosze,
    platformFeePerLessonGrosze: platformFeeGrosze,
    teacherAmountPerLessonGrosze: teacherAmountGrosze,
    effectiveCommissionPercent,
    commissionSource,
  })

  try {
    const origin = getOrigin(request)
    const session = await stripe!.checkout.sessions.create({
      mode: 'payment',
      currency: STRIPE_CURRENCY,
      line_items: [
        {
          price_data: {
            currency: STRIPE_CURRENCY,
            product_data: {
              name: `Pakiet ${packageSize} lekcji: ${selectedSpecialty}`,
              description: `${teacher.name} · ${selectedSpecialty} · ${duration} min · ${packageSize} lekcji`,
            },
            unit_amount: terms.totalPriceGrosze,
          },
          quantity: 1,
        },
      ],
      metadata: {
        paymentType: 'lesson_package',
        teacherId,
        teacherName: safeMetaText(teacher.name ?? ''),
        teacherInitials: teacher.initials ?? '',
        teacherColor: teacher.avatarColor ?? '#F4B400',
        teacherPhotoUrl: safeMetaPhotoUrl(teacher.photoUrl),
        studentId,
        studentName: safeMetaText(studentName),
        payerId,
        payerRole,
        packageSize: String(packageSize),
        subjectKey: selectedSubjectKey,
        subjectCategoryId: selectedSubjectCategoryId ?? '',
        specialty: selectedSpecialty,
        duration: String(duration),
        totalPriceGrosze: String(terms.totalPriceGrosze),
        perLessonGrossGrosze: String(terms.perLessonGrossGrosze),
        platformFeePerLessonGrosze: String(terms.platformFeePerLessonGrosze),
        teacherAmountPerLessonGrosze: String(terms.teacherAmountPerLessonGrosze),
        commissionPercent: String(terms.effectiveCommissionPercent),
        effectiveCommissionPercent: String(terms.effectiveCommissionPercent),
        commissionSource,
      },
      success_url: `${origin}/payment/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/teacher/${teacherId}/book`,
    })

    return NextResponse.json({ url: session.url })
  } catch (err) {
    console.error('[stripe/packages/create-session] Failed:', err)
    return NextResponse.json({ error: 'Nie udało się rozpocząć płatności za pakiet. Spróbuj ponownie.' }, { status: 500 })
  }
}
