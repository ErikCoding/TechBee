import 'server-only'
import { cert, getApps, initializeApp, type App } from 'firebase-admin/app'
import { getFirestore, type Firestore } from 'firebase-admin/firestore'

// ─────────────────────────────────────────────────────────────
// Trusted, server-only Firestore access — used ONLY by the Stripe
// webhook and payout endpoints (app/api/stripe/*), which are the one
// place this app genuinely needs writes nobody can forge from the
// browser (e.g. "this booking is paid", "this payout succeeded").
// Every other service in this codebase intentionally stays on the
// client Firestore SDK + firestore.rules (see the doc comments in
// firestore.rules about the "demo/simulation phase — trust the
// client" posture) — this file is the one deliberate exception, and
// only for money-integrity writes.
//
// IMPORTANT — only import from the `firebase-admin/app` and
// `firebase-admin/firestore` SUBPATHS, never the root `firebase-admin`
// package or `firebase-admin/auth`. This file used to wrap the `auth`
// submodule for LiveKit token verification and had to be abandoned
// (see the history below) because `firebase-admin/auth` pulls in
// `jwks-rsa@4.1.0`, which unconditionally `require()`s `jose@6` — a
// pure-ESM package — and throws `ERR_REQUIRE_ESM` when bundled for a
// Vercel serverless function. `firebase-admin/firestore` has no such
// dependency (verified directly: requiring it never touches jose or
// jwks-rsa), so it doesn't hit that bug. Caller identity is verified
// separately via lib/stripe-server-auth.ts's REST-based check against
// Google's Identity Toolkit — the same technique already proven in
// app/api/livekit/token/route.ts — so no `firebase-admin/auth` is
// needed here at all.
//
// Needs FIREBASE_SERVICE_ACCOUNT_KEY (the full JSON key downloaded
// from Firebase Console → Project settings → Service accounts →
// Generate new private key — either pasted raw as one line, or
// base64-encoded, either works). Absent it, `adminDb` is null and
// every Stripe money endpoint returns a clear 503 instead of ever
// falling back to trusting a client-supplied payment status.
// ─────────────────────────────────────────────────────────────

function parseServiceAccountKey(raw: string): Record<string, unknown> | null {
  try {
    return JSON.parse(raw)
  } catch {
    // Fall through to try base64 — pasting multi-line JSON into a
    // single-line .env value is error-prone, so base64 is the
    // recommended form (see .env.example).
  }
  try {
    return JSON.parse(Buffer.from(raw, 'base64').toString('utf-8'))
  } catch {
    return null
  }
}

const rawKey = process.env.FIREBASE_SERVICE_ACCOUNT_KEY

let app: App | null = null
let dbInstance: Firestore | null = null

if (rawKey) {
  const serviceAccount = parseServiceAccountKey(rawKey)
  if (serviceAccount) {
    try {
      app = getApps().length ? getApps()[0] : initializeApp({ credential: cert(serviceAccount as never) })
      dbInstance = getFirestore(app)
    } catch (err) {
      console.error('[firebase-admin] Failed to initialize with FIREBASE_SERVICE_ACCOUNT_KEY:', err)
    }
  } else {
    console.error('[firebase-admin] FIREBASE_SERVICE_ACCOUNT_KEY is set but is not valid JSON or base64-encoded JSON.')
  }
}

/** True once a real, trusted server-side Firestore connection is available. */
export const isAdminConfigured = Boolean(dbInstance)

/** Trusted Firestore instance for server-only money-integrity writes, or `null` if FIREBASE_SERVICE_ACCOUNT_KEY isn't set. */
export const adminDb = dbInstance
