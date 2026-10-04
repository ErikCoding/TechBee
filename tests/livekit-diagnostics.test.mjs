import assert from 'node:assert/strict'
import test from 'node:test'
import {
  sanitizeLiveKitDiagnosticEvent,
} from '../lib/livekit-diagnostics.ts'

test('sanitizeLiveKitDiagnosticEvent accepts only the limited diagnostic schema', () => {
  const event = sanitizeLiveKitDiagnosticEvent({
    clientSessionId: 'session-1',
    lessonId: 'lesson-1',
    uid: 'student-1',
    role: 'student',
    event: 'livekit_room_error',
    timestamp: '2026-10-04T18:00:00.000Z',
    errorName: 'NotAllowedError',
    errorMessage: 'Permission denied',
    token: 'secret-token',
    idToken: 'secret-firebase-token',
  })

  assert.deepEqual(event, {
    clientSessionId: 'session-1',
    lessonId: 'lesson-1',
    uid: 'student-1',
    role: 'student',
    event: 'livekit_room_error',
    timestamp: '2026-10-04T18:00:00.000Z',
    errorName: 'NotAllowedError',
    errorMessage: 'Permission denied',
  })
})

test('sanitizeLiveKitDiagnosticEvent rejects unknown event names', () => {
  assert.equal(sanitizeLiveKitDiagnosticEvent({
    clientSessionId: 'session-1',
    lessonId: 'lesson-1',
    event: 'arbitrary_log',
    timestamp: '2026-10-04T18:00:00.000Z',
  }), null)
})

test('sanitizeLiveKitDiagnosticEvent strips control characters and limits long fields', () => {
  const event = sanitizeLiveKitDiagnosticEvent({
    clientSessionId: 'session\n1',
    lessonId: 'lesson\r1',
    event: 'media_device_error',
    timestamp: '2026-10-04T18:00:00.000Z',
    errorMessage: 'x'.repeat(500),
  })

  assert.equal(event?.clientSessionId, 'session 1')
  assert.equal(event?.lessonId, 'lesson 1')
  assert.equal(event?.errorMessage?.length, 300)
})

test('sanitizeLiveKitDiagnosticEvent redacts token-like values inside accepted fields', () => {
  const event = sanitizeLiveKitDiagnosticEvent({
    clientSessionId: 'session-1',
    lessonId: 'lesson-1',
    event: 'livekit_room_error',
    timestamp: '2026-10-04T18:00:00.000Z',
    errorMessage: 'failed token=secret-value jwt eyJabc.def.ghi',
  })

  assert.equal(event?.errorMessage, 'failed token=[redacted] jwt [redacted-jwt]')
})

test('sanitizeLiveKitDiagnosticEvent allows only known disconnect sources', () => {
  const event = sanitizeLiveKitDiagnosticEvent({
    clientSessionId: 'session-1',
    lessonId: 'lesson-1',
    event: 'disconnected',
    timestamp: '2026-10-04T18:00:00.000Z',
    disconnectReason: 'CLIENT_INITIATED',
    disconnectSource: 'leave',
  })
  const rejectedSource = sanitizeLiveKitDiagnosticEvent({
    clientSessionId: 'session-1',
    lessonId: 'lesson-1',
    event: 'disconnected',
    timestamp: '2026-10-04T18:00:00.000Z',
    disconnectSource: 'script',
  })

  assert.equal(event?.disconnectSource, 'leave')
  assert.equal(rejectedSource?.disconnectSource, undefined)
})
