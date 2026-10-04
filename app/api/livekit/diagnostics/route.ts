import { NextResponse } from 'next/server'
import { sanitizeLiveKitDiagnosticEvent } from '@/lib/livekit-diagnostics'

const MAX_BODY_BYTES = 4096

function isSameOrigin(request: Request): boolean {
  const origin = request.headers.get('origin')
  if (!origin) return true
  try {
    return new URL(origin).origin === new URL(request.url).origin
  } catch {
    return false
  }
}

export async function POST(request: Request) {
  if (!isSameOrigin(request)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await request.text()
  if (body.length > MAX_BODY_BYTES) {
    return NextResponse.json({ error: 'Payload too large' }, { status: 413 })
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(body)
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const event = sanitizeLiveKitDiagnosticEvent(parsed)
  if (!event) {
    return NextResponse.json({ error: 'Invalid diagnostic event' }, { status: 400 })
  }

  console.info('[livekit/diagnostic]', JSON.stringify({ ...event, receivedAt: new Date().toISOString() }))
  return NextResponse.json({ ok: true })
}
