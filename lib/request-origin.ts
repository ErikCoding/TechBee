// ─────────────────────────────────────────────────────────────
// Best-effort absolute origin for a Next.js Route Handler request —
// used to build Stripe redirect URLs (Checkout success/cancel, Connect
// onboarding return/refresh) that have to be full URLs, not paths.
// Production should use an explicit public URL. Falling back to the
// incoming request keeps local Stripe testing working on localhost.
// ─────────────────────────────────────────────────────────────

export function getOrigin(request: Request): string {
  const configured = process.env.NEXT_PUBLIC_APP_URL?.trim() || process.env.APP_URL?.trim()
  if (configured) return configured.replace(/\/$/, '')

  const headerOrigin = request.headers.get('origin')
  if (headerOrigin) return headerOrigin

  const host = request.headers.get('x-forwarded-host') ?? request.headers.get('host')
  if (host) {
    const proto = request.headers.get('x-forwarded-proto') ?? (host.startsWith('localhost') || host.startsWith('127.0.0.1') ? 'http' : 'https')
    return `${proto}://${host}`
  }

  return new URL(request.url).origin
}
