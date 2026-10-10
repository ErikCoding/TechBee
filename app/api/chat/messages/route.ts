import { NextResponse } from 'next/server'
import { FieldValue } from 'firebase-admin/firestore'
import { adminDb, isAdminConfigured } from '@/lib/firebase-admin'
import { collections } from '@/lib/firebase'
import { verifyCaller } from '@/lib/stripe-server-auth'
import { runbeeAppUrl, sendProductNotificationEmail } from '@/lib/email/product-notifications.server'
import { sanitizeChatAttachment } from '@/lib/chat-attachment-core'
import { canPostReportCard, sanitizeChatReportCard } from '@/lib/chat-report-card-core'
import { buildOutboxPayload, productEmailDocId, type ProductEmailInput } from '@/lib/email/product-notifications-core'

type Body = {
  idToken?: unknown
  conversationId?: unknown
  clientMessageId?: unknown
  text?: unknown
  attachment?: unknown
  reportCard?: unknown
}

function safeText(value: unknown): string {
  return typeof value === 'string' ? value.trim().slice(0, 4000) : ''
}

export async function POST(request: Request) {
  if (!isAdminConfigured || !adminDb) {
    return NextResponse.json({ error: 'Czat nie jest skonfigurowany po stronie serwera.' }, { status: 503 })
  }

  const body = await request.json().catch(() => null) as Body | null
  const uid = await verifyCaller(typeof body?.idToken === 'string' ? body.idToken : undefined)
  if (!uid) return NextResponse.json({ error: 'Musisz być zalogowany.' }, { status: 401 })

  const conversationId = typeof body?.conversationId === 'string' ? body.conversationId.trim() : ''
  if (!conversationId || conversationId.length > 260) {
    return NextResponse.json({ error: 'Nieprawidłowa konwersacja.' }, { status: 400 })
  }
  const rawClientMessageId = typeof body?.clientMessageId === 'string' ? body.clientMessageId.trim() : ''
  const clientMessageId = rawClientMessageId.match(/^[a-zA-Z0-9_-]{8,80}$/) ? rawClientMessageId : ''
  if (!clientMessageId) {
    return NextResponse.json({ error: 'Brak identyfikatora wiadomości.' }, { status: 400 })
  }

  const rawReportCard = body?.reportCard
  const reportCardInput = rawReportCard === undefined ? undefined : sanitizeChatReportCard(rawReportCard)
  if (rawReportCard !== undefined && !reportCardInput) {
    return NextResponse.json({ error: 'Nieprawidłowy raport.' }, { status: 400 })
  }
  const text = reportCardInput ? '' : safeText(body?.text)
  const attachment = reportCardInput ? undefined : sanitizeChatAttachment(body?.attachment, {
    uid,
    conversationId,
    bucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  })
  if (!text && !attachment && !reportCardInput) {
    return NextResponse.json({ error: 'Wiadomość jest pusta.' }, { status: 400 })
  }

  const conversationRef = adminDb.collection(collections.conversations).doc(conversationId)
  const conversationSnap = await conversationRef.get()
  if (!conversationSnap.exists) return NextResponse.json({ error: 'Nie znaleziono konwersacji.' }, { status: 404 })

  const conversation = conversationSnap.data() ?? {}
  const participantIds = Array.isArray(conversation.participantIds) ? conversation.participantIds.filter((id) => typeof id === 'string') as string[] : []
  if (!participantIds.includes(uid)) return NextResponse.json({ error: 'Brak dostępu do konwersacji.' }, { status: 403 })

  const otherId = participantIds.find((id) => id !== uid)
  const sender = conversation.participants?.[uid]

  // Report cards: only the lesson's own teacher, identity/price taken from
  // the real lesson document, never from the client payload.
  let reportCard: (NonNullable<typeof reportCardInput> & { teacherName: string; studentName: string; price: number }) | undefined
  if (reportCardInput) {
    const lessonSnap = await adminDb.collection(collections.lessons).doc(reportCardInput.lessonId).get()
    const lesson = lessonSnap.exists ? lessonSnap.data() ?? {} : null
    if (!lesson || !canPostReportCard({
      uid,
      lesson,
      conversationParticipantIds: participantIds,
      confirmingPartyId: reportCardInput.confirmingPartyId,
    })) {
      return NextResponse.json({ error: 'Brak uprawnień do wysłania raportu.' }, { status: 403 })
    }
    reportCard = {
      ...reportCardInput,
      teacherName: typeof lesson.teacherName === 'string' ? lesson.teacherName : reportCardInput.teacherName,
      studentName: typeof lesson.studentName === 'string' ? lesson.studentName : reportCardInput.studentName,
      price: typeof lesson.price === 'number' ? lesson.price : reportCardInput.price,
    }
  }

  const messageText = reportCard
    ? `📋 Raport z lekcji „${reportCard.topic}"`
    : text || (attachment ? `Wysłano załącznik: ${attachment.name}` : '')
  const now = Date.now()
  const messageRef = conversationRef.collection('items').doc(clientMessageId)
  const emailEventId = `chat:${conversationId}:message:${messageRef.id}:recipient:${otherId ?? ''}`
  const chatEmail: ProductEmailInput | null = otherId && !reportCard ? {
    eventId: emailEventId,
    recipientUid: otherId,
    type: 'messages.newMessage',
    subject: 'Nowa wiadomość w Runbee',
    title: 'Masz nową wiadomość',
    preheader: 'Ktoś napisał do Ciebie na czacie Runbee.',
    body: 'W Runbee czeka na Ciebie nowa wiadomość. Otwórz czat, aby odpisać.',
    details: [
      { label: 'Nadawca', value: typeof sender?.name === 'string' ? sender.name : 'Użytkownik Runbee' },
    ],
    cta: { label: 'Otwórz czat', href: runbeeAppUrl(`/chat?with=${encodeURIComponent(conversationId)}`) },
  } : null
  const outboxRef = adminDb.collection(collections.emailEvents).doc(productEmailDocId(emailEventId))
  const outcome = await adminDb.runTransaction(async (transaction) => {
    const messageSnap = await transaction.get(messageRef)
    if (messageSnap.exists) {
      // Same id from someone else is a collision, not a retry.
      return messageSnap.data()?.senderId === uid ? 'duplicate' as const : 'conflict' as const
    }

    transaction.set(messageRef, {
      senderId: uid,
      text: reportCard ? '' : messageText,
      time: 'teraz',
      createdAt: now,
      ...(attachment ? { attachment } : {}),
      ...(reportCard ? { reportCard } : {}),
    })

    transaction.update(conversationRef, {
      lastMessage: messageText,
      lastMessageTime: 'teraz',
      lastMessageAt: now,
      ...(sender ? { [`participants.${uid}`]: sender } : {}),
      ...(otherId ? { [`unread.${otherId}`]: FieldValue.increment(1) } : {}),
    })

    // Outbox: the intent to notify is committed atomically with the
    // message, so a crash or Resend outage right after this point can
    // never lose it — delivery below (or a retry of the same
    // clientMessageId) picks it up from "pending".
    if (chatEmail) {
      transaction.set(outboxRef, {
        eventId: emailEventId,
        recipientUid: chatEmail.recipientUid,
        type: chatEmail.type,
        status: 'pending',
        attempts: 0,
        createdAt: now,
        updatedAt: now,
        payload: buildOutboxPayload(chatEmail),
      })
    }

    return 'created' as const
  })

  if (outcome === 'conflict') {
    return NextResponse.json({ error: 'Identyfikator wiadomości jest już użyty.' }, { status: 409 })
  }

  // Report cards have their own notification path; plain/attachment
  // messages notify the other participant. On a duplicate (client retry)
  // delivery is re-attempted only if the outbox entry is still unsent —
  // sendProductNotificationEmail never sends a second email for a sent one.
  if (chatEmail) await sendProductNotificationEmail(chatEmail)

  if (outcome === 'duplicate') {
    return NextResponse.json({ ok: true, messageId: messageRef.id, duplicate: true })
  }
  return NextResponse.json({ ok: true, messageId: messageRef.id })
}
