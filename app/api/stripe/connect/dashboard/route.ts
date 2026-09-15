import { NextResponse } from 'next/server'
import { FieldValue } from 'firebase-admin/firestore'
import { stripe } from '@/lib/stripe'
import { adminDb } from '@/lib/firebase-admin'
import { collections } from '@/lib/firebase'
import { getVerifiedUserRole, requireStripeBackend, verifyCaller } from '@/lib/stripe-server-auth'

function isAccountInvalidError(err: unknown) {
  return typeof err === 'object' && err !== null && 'code' in err && (err as { code?: unknown }).code === 'account_invalid'
}

export async function POST(request: Request) {
  const backendError = requireStripeBackend()
  if (backendError) return backendError

  const body = await request.json().catch(() => ({}) as { idToken?: string })
  const uid = await verifyCaller(body.idToken)
  if (!uid) return NextResponse.json({ error: 'Musisz być zalogowany.' }, { status: 401 })

  const role = await getVerifiedUserRole(uid)
  if (role !== 'teacher') return NextResponse.json({ error: 'Tylko nauczyciel może zarządzać wypłatami.' }, { status: 403 })

  const teacherSnap = await adminDb!.collection(collections.teachers).doc(uid).get()
  const accountId = teacherSnap.data()?.stripe?.accountId as string | undefined
  if (!accountId) {
    return NextResponse.json({ error: 'Najpierw skonfiguruj wypłaty Stripe.' }, { status: 400 })
  }

  try {
    const loginLink = await stripe!.accounts.createLoginLink(accountId)
    return NextResponse.json({ url: loginLink.url })
  } catch (err) {
    if (isAccountInvalidError(err)) {
      console.warn('[stripe/connect/dashboard] Connected account is not available for the current Stripe mode:', accountId)
      await adminDb!.collection(collections.teachers).doc(uid).update({
        'stripe.accountId': FieldValue.delete(),
        'stripe.onboardingComplete': false,
        'stripe.detailsSubmitted': false,
        'stripe.chargesEnabled': false,
        'stripe.payoutsEnabled': false,
      })
      return NextResponse.json({
        error: 'To konto Stripe nie należy do aktualnego trybu płatności. Skonfiguruj wypłaty ponownie w panelu nauczyciela.',
      }, { status: 409 })
    }
    console.error('[stripe/connect/dashboard] Failed:', err)
    return NextResponse.json({ error: 'Nie udało się otworzyć ustawień Stripe. Spróbuj ponownie.' }, { status: 500 })
  }
}
