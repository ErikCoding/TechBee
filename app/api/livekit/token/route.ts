import { NextResponse } from 'next/server'
import { AccessToken } from 'livekit-server-sdk'
import { lessonRoomName } from '@/lib/livekit-config'
import { canJoinLesson } from '@/lib/lesson-time'
import type { Lesson } from '@/lib/types'

// ─────────────────────────────────────────────────────────────
// Mints a LiveKit room-join token for a lesson's video call.
//
// The room name is deterministic (`lesson-{lessonId}`, see
// lib/livekit-config.ts) — that alone is what puts the teacher and
// student in the same room, since both land here via the same
// lessonId in the URL (/lesson/{id}/room).
//
// Authorization is best-effort real verification, done with two
// plain REST calls to Google's own APIs instead of the
// `firebase-admin` package:
//   1. Identity Toolkit's `accounts:lookup` confirms the caller's
//      Firebase ID token is genuine and resolves it to a real uid.
//   2. The Firestore REST API reads the lesson doc using that same
//      ID token as the bearer credential — Firestore's own security
//      rules (firestore.rules) decide whether that's allowed, so no
//      separate admin credential is needed at all.
// If the resolved uid matches the lesson's teacherId/studentId, that
// server-verified identity is used for the LiveKit token. In a real
// Firebase environment verification is mandatory; the client-supplied
// identity/name fallback is kept only for the no-Firebase local mock.
//
// Why not `firebase-admin`: its `auth` submodule pulls in
// `jwks-rsa@4.1.0`, which unconditionally `require()`s `jose@6` — a
// pure-ESM-only package. That combination throws `ERR_REQUIRE_ESM`
// when bundled for a Vercel serverless function (works in `next dev`,
// breaks in every production build). It's a real, unpatched bug in
// jwks-rsa's latest release, not something fixable from this project.
// The LiveKit API key/secret never leave this file.
// ─────────────────────────────────────────────────────────────

interface TokenRequestBody {
  lessonId?: string
  identity?: string
  name?: string
  idToken?: string
}

interface FirestoreStringField {
  stringValue?: string
  integerValue?: string
  doubleValue?: number
}

interface FirestoreDocument {
  fields?: Record<string, FirestoreStringField>
}

function firestoreField(doc: FirestoreDocument, field: string): string | undefined {
  return doc.fields?.[field]?.stringValue
}

function firestoreNumberField(doc: FirestoreDocument, field: string): number | undefined {
  const value = doc.fields?.[field]
  const raw = value?.integerValue ?? value?.doubleValue
  const number = typeof raw === 'number' ? raw : Number(raw)
  return Number.isFinite(number) ? number : undefined
}

function firebaseVerificationConfigured(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_FIREBASE_API_KEY && process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID)
}

/**
 * Best-effort: resolves a real, server-verified {uid, name} for this
 * lesson's caller, or `null` if verification isn't possible/conclusive
 * (caller should then fall back to the client-supplied identity).
 * Throws only for genuine, confident "this caller is not part of this
 * lesson" cases — everything else resolves to `null`.
 */
async function verifyCallerAgainstLesson(
  idToken: string,
  lessonId: string,
): Promise<{ uid: string; name: string; lesson: Pick<Lesson, 'scheduledStartAt' | 'date' | 'dateIso' | 'time' | 'duration' | 'status'> } | 'unauthorized' | null> {
  const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY
  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID
  if (!apiKey || !projectId) return null

  const lookupRes = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ idToken }),
  })
  if (!lookupRes.ok) return null
  const lookupData = (await lookupRes.json()) as { users?: { localId?: string }[] }
  const uid = lookupData.users?.[0]?.localId
  if (!uid) return null

  const docRes = await fetch(
    `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/lessons/${lessonId}`,
    { headers: { Authorization: `Bearer ${idToken}` } },
  )
  if (!docRes.ok) return null
  const doc = (await docRes.json()) as FirestoreDocument

  const teacherId = firestoreField(doc, 'teacherId')
  const studentId = firestoreField(doc, 'studentId')
  const isTeacher = uid === teacherId
  const isStudent = uid === studentId
  if (!isTeacher && !isStudent) return 'unauthorized'

  const name = (isTeacher ? firestoreField(doc, 'teacherName') : firestoreField(doc, 'studentName')) ?? ''
  return {
    uid,
    name,
    lesson: {
      scheduledStartAt: firestoreNumberField(doc, 'scheduledStartAt'),
      date: firestoreField(doc, 'date') ?? '',
      dateIso: firestoreField(doc, 'dateIso'),
      time: firestoreField(doc, 'time') ?? '',
      duration: firestoreNumberField(doc, 'duration') ?? 60,
      status: (firestoreField(doc, 'status') as Lesson['status']) ?? 'upcoming',
    },
  }
}

export async function POST(request: Request) {
  const apiKey = process.env.LIVEKIT_API_KEY
  const apiSecret = process.env.LIVEKIT_API_SECRET
  const livekitUrl = process.env.NEXT_PUBLIC_LIVEKIT_URL

  if (!apiKey || !apiSecret || !livekitUrl) {
    return NextResponse.json(
      { error: 'Wideolekcje nie są jeszcze skonfigurowane (brak zmiennych LIVEKIT_* w środowisku).' },
      { status: 503 },
    )
  }

  let body: TokenRequestBody
  try {
    body = (await request.json()) as TokenRequestBody
  } catch {
    return NextResponse.json({ error: 'Nieprawidłowe żądanie.' }, { status: 400 })
  }

  const { lessonId, idToken } = body
  if (!lessonId) {
    return NextResponse.json({ error: 'Brak identyfikatora lekcji.' }, { status: 400 })
  }

  let identity = body.identity
  let name = body.name

  if (firebaseVerificationConfigured()) {
    if (!idToken) {
      return NextResponse.json({ error: 'Musisz być zalogowany, aby dołączyć do lekcji.' }, { status: 401 })
    }
    try {
      const verified = await verifyCallerAgainstLesson(idToken, lessonId)
      if (verified === 'unauthorized') {
        return NextResponse.json({ error: 'Nie masz dostępu do tej lekcji.' }, { status: 403 })
      }
      if (!verified) {
        return NextResponse.json({ error: 'Nie udało się potwierdzić dostępu do tej lekcji.' }, { status: 403 })
      }
      const joinState = canJoinLesson(verified.lesson)
      if (!joinState.canJoin) {
        return NextResponse.json({ error: joinState.reason ?? 'Nie można teraz dołączyć do lekcji.' }, { status: 403 })
      }
      identity = verified.uid
      name = verified.name || name || 'Uczestnik'
    } catch (err) {
      console.error('[livekit/token] Verification against Google APIs failed:', err)
      return NextResponse.json({ error: 'Nie udało się potwierdzić dostępu do tej lekcji.' }, { status: 503 })
    }
  }

  if (!identity || !name) {
    return NextResponse.json({ error: 'Brak danych uczestnika.' }, { status: 400 })
  }

  try {
    const token = new AccessToken(apiKey, apiSecret, {
      identity,
      name,
      ttl: '3h',
    })
    token.addGrant({
      room: lessonRoomName(lessonId),
      roomJoin: true,
      canPublish: true,
      canSubscribe: true,
      canPublishData: true,
    })

    return NextResponse.json({ token: await token.toJwt(), url: livekitUrl })
  } catch (err) {
    console.error('[livekit/token] Failed to mint LiveKit token:', err)
    return NextResponse.json({ error: 'Nie udało się utworzyć tokenu do pokoju.' }, { status: 500 })
  }
}
