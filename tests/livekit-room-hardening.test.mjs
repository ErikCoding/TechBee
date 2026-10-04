import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const clientSource = readFileSync(new URL('../components/lesson/lesson-room-client.tsx', import.meta.url), 'utf8')
const stageSource = readFileSync(new URL('../components/lesson/lesson-room-stage.tsx', import.meta.url), 'utf8')

test('LiveKitRoom no longer auto-starts camera or microphone through props', () => {
  assert.equal(clientSource.includes('audio={false}'), true)
  assert.equal(clientSource.includes('video={false}'), true)
  assert.equal(clientSource.includes('\n      audio\n'), false)
  assert.equal(clientSource.includes('\n      video\n'), false)
})

test('LessonRoomStage starts microphone and camera independently after connected', () => {
  assert.equal(stageSource.includes('autoMediaStartedRef.current'), true)
  assert.equal(stageSource.includes('localParticipant.setMicrophoneEnabled(true)'), true)
  assert.equal(stageSource.includes('localParticipant.setCameraEnabled(true)'), true)
})

test('media startup failures stay local and do not set fatal room state', () => {
  assert.equal(stageSource.includes("setState('error')"), false)
  assert.equal(stageSource.includes("onMediaDeviceError?.({ deviceKind: 'audioinput'"), true)
  assert.equal(stageSource.includes("onMediaDeviceError?.({ deviceKind: 'videoinput'"), true)
  assert.equal(stageSource.includes('setMediaErrors'), true)
})

test('fatal LiveKitRoom onError remains wired for connection failures', () => {
  assert.equal(clientSource.includes('onError={handleLiveKitError}'), true)
  assert.equal(clientSource.includes("reportDiagnostic('livekit_room_error'"), true)
  assert.equal(clientSource.includes("setState('error')"), true)
})
