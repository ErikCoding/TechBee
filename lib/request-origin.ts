// ─────────────────────────────────────────────────────────────
// Best-effort absolute origin for a Next.js Route Handler request —
// used to build Stripe redirect URLs (Checkout success/cancel, Connect
// onboarding return/refresh) that have to be full URLs, not paths.
// There's no NEXT_PUBLIC_APP_URL in this project yet, so this is
// derived straight from the incoming request instead of adding one.
// ─────────────────────────────────────────────────────────────

export function getOrigin(request: Request): string {
  const headerOrigin = request.headers.get('origin')
  if (headerOrigin) return headerOrigin

  const host = request.headers.get('x-forwarded-host') ?? request.headers.get('host')
  if (host) {
    const proto = request.headers.get('x-forwarded-proto') ?? (host.startsWith('localhost') || host.startsWith('127.0.0.1') ? 'http' : 'https')
    return `${proto}://${host}`
  }

  return new URL(request.url).origin
}
