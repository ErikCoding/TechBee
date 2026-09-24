import { NextResponse } from 'next/server'
import { adminAuth, isAdminAuthConfigured } from '@/lib/firebase-admin-auth'
import { collections } from '@/lib/firebase'
import { siteConfig } from '@/config/site'
import { handlePasswordResetRequest } from '@/lib/account-security-endpoints'
import { checkAndRecordAccountSecurityAttempt, hashSensitiveValue } from '@/lib/account-security.server'
import { sendPasswordResetEmail } from '@/lib/email/password-reset-email.server'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const actionCodeSettings = {
  url: new URL('/auth/action', siteConfig.url).toString(),
  handleCodeInApp: true,
}

export async function POST(request: Request) {
  if (!isAdminAuthConfigured || !adminAuth) {
    return NextResponse.json({ error: 'Reset hasła nie jest skonfigurowany.' }, { status: 503 })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    body = {}
  }

  const auth = adminAuth
  const result = await handlePasswordResetRequest(body, {
    actionCodeSettings,
    siteUrl: siteConfig.url,
    checkRateLimit: async (email, now) => checkAndRecordAccountSecurityAttempt(
      collections.passwordResetRateLimits,
      hashSensitiveValue(email),
      now,
    ),
    getUserByEmail: (email) => auth.getUserByEmail(email),
    generatePasswordResetLink: (email, settings) => auth.generatePasswordResetLink(email, settings),
    sendPasswordResetEmail,
  })

  return NextResponse.json(result.body, { status: result.status, headers: result.headers })
}
