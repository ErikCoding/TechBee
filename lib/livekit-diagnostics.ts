export const LIVEKIT_DIAGNOSTIC_EVENTS = [
  'livekit_room_error',
  'media_device_failure',
  'media_device_error',
  'disconnected',
  'connection_state_changed',
  'disconnect_intent',
  'page_lifecycle',
] as const

export const LIVEKIT_DISCONNECT_SOURCES = ['leave', 'end', 'autoEnd', 'pagehide', 'beforeunload', 'freeze'] as const

export type LiveKitDiagnosticEventName = (typeof LIVEKIT_DIAGNOSTIC_EVENTS)[number]
export type LiveKitDisconnectSource = (typeof LIVEKIT_DISCONNECT_SOURCES)[number]

export interface LiveKitDiagnosticEvent {
  clientSessionId: string
  lessonId: string
  uid?: string
  role?: string
  event: LiveKitDiagnosticEventName
  timestamp: string
  connectionState?: string
  disconnectReason?: string
  errorName?: string
  errorMessage?: string
  deviceKind?: string
  mediaDeviceFailure?: string
  disconnectSource?: LiveKitDisconnectSource
}

const MAX_SHORT_FIELD = 120
const MAX_MESSAGE_FIELD = 300

function sanitizeString(value: unknown, maxLength = MAX_SHORT_FIELD): string | undefined {
  if (typeof value !== 'string' && typeof value !== 'number' && typeof value !== 'boolean') return undefined
  const sanitized = String(value)
    .replace(/[\u0000-\u001f\u007f]+/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g, '[redacted-jwt]')
    .replace(/\b(idToken|token|authorization)=\S+/gi, '$1=[redacted]')
    .trim()
  if (!sanitized) return undefined
  return sanitized.slice(0, maxLength)
}

function isDiagnosticEventName(value: unknown): value is LiveKitDiagnosticEventName {
  return typeof value === 'string' && LIVEKIT_DIAGNOSTIC_EVENTS.includes(value as LiveKitDiagnosticEventName)
}

function isDisconnectSource(value: unknown): value is LiveKitDisconnectSource {
  return typeof value === 'string' && LIVEKIT_DISCONNECT_SOURCES.includes(value as LiveKitDisconnectSource)
}

export function sanitizeLiveKitDiagnosticEvent(input: unknown): LiveKitDiagnosticEvent | null {
  if (!input || typeof input !== 'object') return null
  const raw = input as Record<string, unknown>
  if (!isDiagnosticEventName(raw.event)) return null

  const clientSessionId = sanitizeString(raw.clientSessionId)
  const lessonId = sanitizeString(raw.lessonId)
  if (!clientSessionId || !lessonId) return null

  const timestamp = sanitizeString(raw.timestamp, 64) ?? new Date().toISOString()
  const event: LiveKitDiagnosticEvent = {
    clientSessionId,
    lessonId,
    event: raw.event,
    timestamp,
  }

  const uid = sanitizeString(raw.uid)
  const role = sanitizeString(raw.role, 40)
  const connectionState = sanitizeString(raw.connectionState)
  const disconnectReason = sanitizeString(raw.disconnectReason)
  const errorName = sanitizeString(raw.errorName)
  const errorMessage = sanitizeString(raw.errorMessage, MAX_MESSAGE_FIELD)
  const deviceKind = sanitizeString(raw.deviceKind, 40)
  const mediaDeviceFailure = sanitizeString(raw.mediaDeviceFailure, 80)

  if (uid) event.uid = uid
  if (role) event.role = role
  if (connectionState) event.connectionState = connectionState
  if (disconnectReason) event.disconnectReason = disconnectReason
  if (errorName) event.errorName = errorName
  if (errorMessage) event.errorMessage = errorMessage
  if (deviceKind) event.deviceKind = deviceKind
  if (mediaDeviceFailure) event.mediaDeviceFailure = mediaDeviceFailure
  if (isDisconnectSource(raw.disconnectSource)) event.disconnectSource = raw.disconnectSource

  return event
}

export function postLiveKitDiagnosticEvent(event: LiveKitDiagnosticEvent): void {
  const payload = JSON.stringify(event)
  const url = '/api/livekit/diagnostics'

  if (typeof navigator !== 'undefined' && typeof navigator.sendBeacon === 'function') {
    const sent = navigator.sendBeacon(url, new Blob([payload], { type: 'application/json' }))
    if (sent) return
  }

  fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: payload,
    keepalive: true,
  }).catch(() => {})
}
