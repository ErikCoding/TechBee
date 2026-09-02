import 'server-only'
import { NextResponse } from 'next/server'
import { adminDb, isAdminConfigured } from '@/lib/firebase-admin'
import { isStripeConfigured } from '@/lib/stripe'
import type { UserRole } from '@/lib/types'

// ─────────────────────────────────────────────────────────────
// Server-side caller verification for app/api/stripe/* routes —
// the same REST-based technique already proven in
// app/api/livekit/token/route.ts (Identity Toolkit's
// `accounts:lookup`), factored out for reuse. No `firebase-admin/auth`
// involved (see the top-of-file comment in lib/firebase-admin.ts for
// why that submodule is avoided entirely).
//
// Every Stripe money endpoint calls `verifyCaller(idToken)` and
// refuses to proceed without a confident, server-verified uid — unlike
// the LiveKit token route, there's no "fall back to trusting the
// client" here, because these endpoints move real (test-mode) money.
// ─────────────────────────────────────────────────────────────

/** Resolves a Firebase ID token to its real, server-verified uid — or `null` if it's missing, invalid, or verification fails for any reason (network, misconfiguration, etc.). Never throws. */
export async function verifyCaller(idToken: string | undefined | null): Promise<string | null> {
  if (!idToken) return null
  const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY
  if (!apiKey) return null
  try {
    const res = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idToken }),
    })
    if (!res.ok) return null
    const data = (await res.json()) as { users?: { localId?: string }[] }
    return data.users?.[0]?.localId ?? null
  } catch {
    return null
  }
}

/** Reads a user's real role straight from the trusted admin Firestore connection — never trust a role the client claims about itself. Requires `adminDb` (FIREBASE_SERVICE_ACCOUNT_KEY) to be configured. */
export async function getVerifiedUserRole(uid: string): Promise<UserRole | null> {
  if (!adminDb) return null
  const snap = await adminDb.collection('users').doc(uid).get()
  if (!snap.exists) return null
  const role = snap.data()?.role
  return typeof role === 'string' ? (role as UserRole) : null
}

/** Every app/api/stripe/* route needs both a real Stripe key and the trusted admin Firestore connection — returns a ready-to-return 503 if either is missing, or `null` if both are fine. Checked first, before ever touching a request body. */
export function requireStripeBackend(): NextResponse | null {
  if (!isStripeConfigured) {
    return NextResponse.json({ error: 'Płatności Stripe nie są jeszcze skonfigurowane (brak STRIPE_SECRET_KEY).' }, { status: 503 })
  }
  if (!isAdminConfigured) {
    return NextResponse.json({ error: 'Zaufane zapisy Firestore nie są skonfigurowane (brak FIREBASE_SERVICE_ACCOUNT_KEY).' }, { status: 503 })
  }
  return null
}
