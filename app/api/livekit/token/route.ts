import { NextResponse } from 'next/server'
import { AccessToken } from 'livekit-server-sdk'
import { collections } from '@/lib/firebase'
import { getAdminAuth, getAdminDb, isFirebaseAdminConfigured } from '@/lib/firebase-admin'
import { lessonRoomName } from '@/lib/livekit-config'

// ─────────────────────────────────────────────────────────────
// Mints a LiveKit room-join token for a lesson's video call.
//
// The room name is deterministic (`lesson-{lessonId}`, see
// lib/livekit-config.ts) — that alone is what puts the teacher and
// student in the same room, since both land here via the same
// lessonId in the URL (/lesson/{id}/room).
//
// Authorization has two tiers, same dual-mode posture as the rest of
// the app (see lib/firebase.ts):
//   - FIREBASE_SERVICE_ACCOUNT_KEY set → real check: verifies the
//     caller's Firebase ID token, loads the lesson doc, and only
//     mints a token if the caller is that lesson's actual teacherId
//     or studentId.
//   - Not set (local/dev default) → trusts the client-supplied
//     identity/name, matching how every other service in this app
//     behaves before Firebase is fully wired up.
// The LiveKit API key/secret never leave this file.
// ─────────────────────────────────────────────────────────────

// firebase-admin (used below when FIREBASE_SERVICE_ACCOUNT_KEY is set)
// needs the full Node.js runtime, not the Edge runtime.
export const runtime = 'nodejs'

interface TokenRequestBody {
  lessonId?: string
  identity?: string
  name?: string
  idToken?: string
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

  if (isFirebaseAdminConfigured) {
    const adminAuth = getAdminAuth()
    const adminDb = getAdminDb()
    // getAdminAuth()/getAdminDb() return null when the SDK itself failed to
    // initialize (e.g. a malformed FIREBASE_SERVICE_ACCOUNT_KEY — a config
    // problem, not the caller's fault) — that's an infra hiccup, not an
    // authorization decision, so it degrades to the "not configured" path
    // below instead of hard-failing the whole video-lesson feature. It's
    // logged server-side in lib/firebase-admin.ts so it's still visible.
    if (adminAuth && adminDb) {
      if (!idToken) {
        return NextResponse.json({ error: 'Brak autoryzacji.' }, { status: 401 })
      }
      try {
        const decoded = await adminAuth.verifyIdToken(idToken)
        const lessonSnap = await adminDb.collection(collections.lessons).doc(lessonId).get()
        if (!lessonSnap.exists) {
          return NextResponse.json({ error: 'Lekcja nie istnieje.' }, { status: 404 })
        }
        const lesson = lessonSnap.data() as { teacherId?: string; studentId?: string; teacherName?: string; studentName?: string }
        const isTeacher = decoded.uid === lesson.teacherId
        const isStudent = decoded.uid === lesson.studentId
        if (!isTeacher && !isStudent) {
          return NextResponse.json({ error: 'Nie masz dostępu do tej lekcji.' }, { status: 403 })
        }
        // Real, server-verified identity overrides whatever the client sent.
        identity = decoded.uid
        name = (isTeacher ? lesson.teacherName : lesson.studentName) ?? name
      } catch (err) {
        console.error('[livekit/token] ID token verification failed:', err)
        return NextResponse.json({ error: 'Nieprawidłowy token uwierzytelniania.' }, { status: 401 })
      }
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
