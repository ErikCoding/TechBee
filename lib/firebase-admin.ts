// ─────────────────────────────────────────────────────────────
// DEPRECATED — no longer used anywhere in this project.
//
// This used to wrap the `firebase-admin` package for server-side
// verification in app/api/livekit/token/route.ts. Removed because
// `firebase-admin`'s `auth` submodule depends on `jwks-rsa@4.1.0`,
// which unconditionally `require()`s `jose@6` — a pure-ESM package.
// That combination throws `ERR_REQUIRE_ESM` when bundled for a
// Vercel serverless function (it only "worked" in `next dev`, which
// loads modules differently). It's a real, unpatched bug in
// jwks-rsa's latest release as of this writing, not something fixable
// from this project by pinning versions.
//
// The token route now verifies callers with two plain REST calls to
// Google's own APIs instead (Identity Toolkit + the Firestore REST
// API) — see the top-of-file comment in
// app/api/livekit/token/route.ts for details. No admin SDK, no
// service-account key required.
//
// Kept as an empty file (rather than deleted) purely because this
// sandbox's filesystem mount can't always unlink files — it is not
// imported by anything and has no effect on the app.
// ─────────────────────────────────────────────────────────────

export {}
