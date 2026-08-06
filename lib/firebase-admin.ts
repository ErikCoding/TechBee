// ─────────────────────────────────────────────────────────────
// Firebase Admin bootstrap — SERVER-ONLY (do not import from any
// 'use client' file or client-invoked service).
//
// Used exclusively by app/api/livekit/token/route.ts to verify a
// caller's Firebase ID token and check it against a lesson doc's
// teacherId/studentId before minting a LiveKit room token — real,
// server-side authorization instead of trusting whatever identity
// the client claims to be.
//
// Optional by design, same posture as isFirebaseConfigured in
// lib/firebase.ts: until FIREBASE_SERVICE_ACCOUNT_KEY is set, every
// export here is a no-op/null and the token route falls back to
// trusting the client-supplied identity — so the app keeps working
// locally before this is wired up, and switches over automatically
// the moment a service account key is present.
// ─────────────────────────────────────────────────────────────

import { cert, getApps, initializeApp, type App, type ServiceAccount } from 'firebase-admin/app'
import { getAuth, type Auth } from 'firebase-admin/auth'
import { getFirestore, type Firestore } from 'firebase-admin/firestore'

function parseServiceAccount(): ServiceAccount | null {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_KEY
  if (!raw) return null
  try {
    return JSON.parse(raw) as ServiceAccount
  } catch {
    return null
  }
}

/** True once a valid-looking service account key is present. */
export const isFirebaseAdminConfigured = Boolean(parseServiceAccount())

let adminApp: App | null = null
let initFailed = false

function getAdminApp(): App | null {
  if (adminApp) return adminApp
  if (initFailed) return null
  const serviceAccount = parseServiceAccount()
  if (!serviceAccount) return null
  try {
    adminApp = getApps().length ? getApps()[0] : initializeApp({ credential: cert(serviceAccount) })
    return adminApp
  } catch (err) {
    // A malformed FIREBASE_SERVICE_ACCOUNT_KEY (e.g. mangled newlines from
    // pasting into a hosting provider's env var UI) must not crash the
    // whole route that uses this — see app/api/livekit/token/route.ts,
    // which falls back to trusting the client identity when this returns
    // null, same as when the key isn't set at all. Logged so it's visible
    // in server logs instead of silently degrading forever.
    console.error('[firebase-admin] Failed to initialize with FIREBASE_SERVICE_ACCOUNT_KEY:', err)
    initFailed = true
    return null
  }
}

export function getAdminAuth(): Auth | null {
  const app = getAdminApp()
  return app ? getAuth(app) : null
}

export function getAdminDb(): Firestore | null {
  const app = getAdminApp()
  return app ? getFirestore(app) : null
}
