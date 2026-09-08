import { NextResponse } from 'next/server'
import { RoomServiceClient } from 'livekit-server-sdk'
import { lessonRoomName } from '@/lib/livekit-config'

interface RoomStatusRequestBody {
  lessonId?: string
}

function livekitHttpUrl(url: string): string {
  if (url.startsWith('wss://')) return `https://${url.slice('wss://'.length)}`
  if (url.startsWith('ws://')) return `http://${url.slice('ws://'.length)}`
  return url
}

export async function POST(request: Request) {
  const apiKey = process.env.LIVEKIT_API_KEY
  const apiSecret = process.env.LIVEKIT_API_SECRET
  const livekitUrl = process.env.NEXT_PUBLIC_LIVEKIT_URL

  if (!apiKey || !apiSecret || !livekitUrl) {
    return NextResponse.json({ configured: false, active: false, participantCount: 0 })
  }

  let body: RoomStatusRequestBody
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Nieprawidłowe żądanie.' }, { status: 400 })
  }

  if (!body.lessonId) {
    return NextResponse.json({ error: 'Brak identyfikatora lekcji.' }, { status: 400 })
  }

  try {
    const roomService = new RoomServiceClient(livekitHttpUrl(livekitUrl), apiKey, apiSecret)
    const participants = await roomService.listParticipants(lessonRoomName(body.lessonId))
    return NextResponse.json({
      configured: true,
      active: participants.length > 0,
      participantCount: participants.length,
    })
  } catch {
    return NextResponse.json({ configured: true, active: false, participantCount: 0 })
  }
}
