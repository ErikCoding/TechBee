import 'server-only'
import Stripe from 'stripe'

// ─────────────────────────────────────────────────────────────
// Server-only Stripe client. `import 'server-only'` makes any
// accidental client-component import of this file fail the build
// instead of silently leaking STRIPE_SECRET_KEY to the browser.
//
// `isStripeConfigured` mirrors `isFirebaseConfigured` in lib/firebase.ts
// — every app/api/stripe/* route checks it first and returns a clear
// 503 instead of throwing, same posture as app/api/livekit/token.
// ─────────────────────────────────────────────────────────────

const secretKey = process.env.STRIPE_SECRET_KEY

export const isStripeConfigured = Boolean(secretKey)

export const stripe = secretKey
  ? new Stripe(secretKey, {
      apiVersion: '2026-07-29.dahlia',
      typescript: true,
      appInfo: { name: 'Runbee', version: '1.0.0' },
    })
  : null
