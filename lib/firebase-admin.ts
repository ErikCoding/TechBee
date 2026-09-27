import 'server-only'
import { cert, getApps, initializeApp, type App, type Credential } from 'firebase-admin/app'
import { getFirestore, type Firestore } from 'firebase-admin/firestore'
import { parseFirebaseServiceAccountKey, type FirebaseServerCredentialState } from '@/lib/firebase-server-credentials'

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
// IMPORTANT — keep this module as the single place that initializes the
// Firebase Admin App. Feature-specific helpers may attach sub-services
// (Firestore here, Auth in lib/firebase-admin-auth.ts), but they must reuse
// this already-initialized app instead of creating their own.
//
// Needs FIREBASE_SERVICE_ACCOUNT_KEY (the full JSON key downloaded
// from Firebase Console → Project settings → Service accounts →
// Generate new private key — either pasted raw as one line, or
// base64-encoded, either works). Absent it, `adminDb` is null and
// every Stripe money endpoint returns a clear 503 instead of ever
// falling back to trusting a client-supplied payment status.
// ─────────────────────────────────────────────────────────────

const rawKey = process.env.FIREBASE_SERVICE_ACCOUNT_KEY
const credentialState = parseFirebaseServiceAccountKey(rawKey, process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID)

let app: App | null = null
let dbInstance: Firestore | null = null
let credentialInstance: Credential | null = null
let credentialStatus: FirebaseServerCredentialState = credentialState

if (credentialState.ok) {
  try {
    credentialInstance = cert(credentialState.credentialInput)
    app = getApps().length ? getApps()[0] : initializeApp({ credential: credentialInstance })
    dbInstance = getFirestore(app)
  } catch {
    credentialInstance = null
    app = null
    dbInstance = null
    credentialStatus = {
      ok: false,
      diagnosticCode: 'firebase_service_account_invalid',
      invalidField: 'private_key',
    }
    console.error('[firebase-admin] Failed to initialize Firebase Admin credential.', {
      diagnosticCode: credentialStatus.diagnosticCode,
      invalidField: credentialStatus.invalidField,
    })
  }
} else if (credentialState.diagnosticCode !== 'firebase_service_account_missing') {
  console.error('[firebase-admin] Firebase Admin credential is not usable.', {
    diagnosticCode: credentialState.diagnosticCode,
    invalidField: credentialState.invalidField,
    missingEnv: credentialState.missingEnv,
  })
}

/** True once a real, trusted server-side Firestore connection is available. */
export const isAdminConfigured = Boolean(dbInstance)

/** Shared Firebase Admin app instance. Reuse this from server-only helpers; never initialize a second Admin App. */
export const adminApp = app

/** Trusted Firestore instance for server-only money-integrity writes, or `null` if FIREBASE_SERVICE_ACCOUNT_KEY isn't set. */
export const adminDb = dbInstance

/** Canonical credential created from FIREBASE_SERVICE_ACCOUNT_KEY, used by Admin app and Auth REST helpers. */
export const firebaseAdminCredential = credentialInstance

/** Safe, non-secret status of the canonical Firebase server credential. */
export const firebaseAdminCredentialStatus = credentialStatus

/** Firebase project id from the validated service account, or null when server credentials are not usable. */
export const firebaseAdminProjectId = credentialStatus.ok ? credentialStatus.serviceAccount.project_id : null
