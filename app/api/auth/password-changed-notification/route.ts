import { NextResponse } from 'next/server'
import { adminAuth, isAdminAuthConfigured } from '@/lib/firebase-admin-auth'
import { handlePasswordChangedNotificationRequest } from '@/lib/account-security-endpoints'
import { sendPasswordChangedEmail } from '@/lib/email/password-changed-email.server'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function POST(request: Request) {
  if (!isAdminAuthConfigured || !adminAuth) {
    return NextResponse.json({ error: 'Powiadomienia bezpieczeństwa nie są skonfigurowane.' }, { status: 503 })
  }

  const auth = adminAuth
  const result = await handlePasswordChangedNotificationRequest(request.headers.get('authorization'), {
    verifyIdToken: (idToken) => auth.verifyIdToken(idToken),
    getUser: (uid) => auth.getUser(uid),
    sendPasswordChangedEmail,
  })

  return NextResponse.json(result.body, { status: result.status, headers: result.headers })
}
