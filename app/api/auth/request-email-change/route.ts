import { NextResponse } from 'next/server'
import { adminAuth, isAdminAuthConfigured } from '@/lib/firebase-admin-auth'
import { siteConfig } from '@/config/site'
import { collections } from '@/lib/firebase'
import { handleRequestEmailChange } from '@/lib/account-security-endpoints'
import { checkAndRecordAccountSecurityAttempt, savePendingEmailChange } from '@/lib/account-security.server'
import { sendEmailChangeVerificationEmail } from '@/lib/email/email-change-email.server'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const actionCodeSettings = {
  url: new URL('/auth/action', siteConfig.url).toString(),
  handleCodeInApp: true,
}

export async function POST(request: Request) {
  if (!isAdminAuthConfigured || !adminAuth) {
    return NextResponse.json({ error: 'Zmiana adresu e-mail nie jest skonfigurowana.' }, { status: 503 })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    body = {}
  }

  const auth = adminAuth
  const result = await handleRequestEmailChange(request.headers.get('authorization'), body, {
    actionCodeSettings,
    siteUrl: siteConfig.url,
    verifyIdToken: (idToken) => auth.verifyIdToken(idToken),
    getUser: (uid) => auth.getUser(uid),
    checkRateLimit: async (uid, now) => checkAndRecordAccountSecurityAttempt(collections.emailChangeRateLimits, uid, now),
    generateVerifyAndChangeEmailLink: (email, newEmail, settings) => auth.generateVerifyAndChangeEmailLink(email, newEmail, settings),
    savePendingEmailChange,
    sendEmailChangeVerificationEmail,
  })

  return NextResponse.json(result.body, { status: result.status, headers: result.headers })
}
