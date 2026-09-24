import { NextResponse } from 'next/server'
import { adminDb, isAdminConfigured } from '@/lib/firebase-admin'
import { adminAuth, isAdminAuthConfigured } from '@/lib/firebase-admin-auth'
import { collections } from '@/lib/firebase'
import { siteConfig } from '@/config/site'
import { checkAndRecordEmailVerificationAttempt } from '@/lib/email-verification-rate-limit.server'
import { handleSendVerificationEmailRequest } from '@/lib/email-verification-endpoint'
import { sendEmailVerificationEmail } from '@/lib/email/email-verification-email.server'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const actionCodeSettings = {
  url: new URL('/login?verified=1', siteConfig.url).toString(),
  handleCodeInApp: false,
}

async function getFirstName(uid: string): Promise<string | null> {
  if (!adminDb) return null
  const snap = await adminDb.collection(collections.users).doc(uid).get()
  const firstName = snap.data()?.firstName
  return typeof firstName === 'string' && firstName.trim() ? firstName.trim() : null
}

export async function POST(request: Request) {
  if (!isAdminConfigured || !isAdminAuthConfigured || !adminAuth) {
    return NextResponse.json({ error: 'Wysyłka maili weryfikacyjnych nie jest skonfigurowana.' }, { status: 503 })
  }
  const auth = adminAuth

  const result = await handleSendVerificationEmailRequest(request.headers.get('authorization'), {
    actionCodeSettings,
    verifyIdToken: (idToken) => auth.verifyIdToken(idToken),
    getUser: (uid) => auth.getUser(uid),
    getFirstName,
    checkRateLimit: async (uid, now) => checkAndRecordEmailVerificationAttempt(uid, now),
    generateEmailVerificationLink: (email, settings) => auth.generateEmailVerificationLink(email, settings),
    sendEmailVerificationEmail,
  })

  return NextResponse.json(result.body, { status: result.status, headers: result.headers })
}
