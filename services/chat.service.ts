import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore'
import { collections, db, isFirebaseConfigured } from '@/lib/firebase'
import type { ChatConversation, ChatMessage, ChatParticipant } from '@/lib/types'

// ─────────────────────────────────────────────────────────────
// Real messaging between two accounts (student ⇄ teacher).
//
// Firebase mode: `conversations/{id}` doc (id = the two participant
// ids, sorted and joined) holding both participants' info plus a
// `messages` subcollection ordered by `createdAt`, with live
// `onSnapshot` listeners for both the conversation list and the
// open thread — two different logged-in accounts (e.g. a student
// in one browser and a teacher in another) can message each other
// in real time once Firebase is configured.
//
// Mock mode: the same shape, persisted to localStorage. Because a
// single browser only ever holds one signed-in session, this can't
// simulate a true two-way live conversation on its own — it lets
// you build up a thread from whichever account is currently signed
// in, and it's replaced automatically by real cross-account
// messaging the moment Firebase is configured.
// ─────────────────────────────────────────────────────────────

function isBrowser() {
  return typeof window !== 'undefined'
}

function conversationIdFor(aId: string, bId: string) {
  return [aId, bId].sort().join('__')
}

export function toParticipant(input: {
  id: string
  name: string
  initials: string
  avatarColor: string
  role: ChatParticipant['role']
  specialty?: string
}): ChatParticipant {
  return {
    id: input.id,
    name: input.name,
    initials: input.initials,
    avatarColor: input.avatarColor,
    role: input.role,
    // Omit the key entirely rather than setting it to `undefined` — Firestore's
    // setDoc() rejects explicit `undefined` field values (students have no
    // specialty, so this branch matters for every student participant).
    ...(input.specialty ? { specialty: input.specialty } : {}),
  }
}

// ── Mock (localStorage) implementation ──────────────────────

const STORAGE_KEY = 'techbee.chat.conversations'

type StoredConversation = {
  id: string
  participantIds: string[]
  participants: Record<string, ChatParticipant>
  messages: ChatMessage[]
  lastMessage: string
  lastMessageTime: string
  lastMessageAt: number
  unread: Record<string, number>
}

function readAllMock(): StoredConversation[] {
  if (!isBrowser()) return []
  try {
    return JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? '[]') as StoredConversation[]
  } catch {
    return []
  }
}

function writeAllMock(list: StoredConversation[]) {
  if (!isBrowser()) return
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(list))
}

function toSummaryMock(conv: StoredConversation, viewerId: string): ChatConversation {
  const otherId = conv.participantIds.find((id) => id !== viewerId) ?? conv.participantIds[0]
  return {
    id: conv.id,
    participant: conv.participants[otherId],
    lastMessage: conv.lastMessage,
    lastMessageTime: conv.lastMessageTime,
    lastMessageAt: conv.lastMessageAt,
    unread: conv.unread[viewerId] ?? 0,
  }
}

async function getOrCreateConversationMock(me: ChatParticipant, other: ChatParticipant): Promise<string> {
  const id = conversationIdFor(me.id, other.id)
  const list = readAllMock()
  if (!list.some((c) => c.id === id)) {
    const fresh: StoredConversation = {
      id,
      participantIds: [me.id, other.id],
      participants: { [me.id]: me, [other.id]: other },
      messages: [],
      lastMessage: '',
      lastMessageTime: '',
      lastMessageAt: Date.now(),
      unread: { [me.id]: 0, [other.id]: 0 },
    }
    writeAllMock([fresh, ...list])
  }
  return id
}

function listConversationsMock(viewerId: string): ChatConversation[] {
  return readAllMock()
    .filter((c) => c.participantIds.includes(viewerId))
    .map((c) => toSummaryMock(c, viewerId))
    .sort((a, b) => b.lastMessageAt - a.lastMessageAt)
}

function getMessagesMock(conversationId: string): ChatMessage[] {
  return readAllMock().find((c) => c.id === conversationId)?.messages ?? []
}

function sendMessageMock(conversationId: string, sender: ChatParticipant, text: string, attachment?: ChatMessage['attachment']) {
  const list = readAllMock()
  const idx = list.findIndex((c) => c.id === conversationId)
  if (idx === -1) return
  const now = Date.now()
  const message: ChatMessage = {
    id: `local-${now}`,
    senderId: sender.id,
    text: text || (attachment ? `Wysłano załącznik: ${attachment.name}` : ''),
    time: 'teraz',
    createdAt: now,
    attachment,
  }
  const conv = list[idx]
  const otherId = conv.participantIds.find((id) => id !== sender.id)
  list[idx] = {
    ...conv,
    participants: { ...conv.participants, [sender.id]: sender },
    messages: [...conv.messages, message],
    lastMessage: message.text,
    lastMessageTime: 'teraz',
    lastMessageAt: now,
    unread: { ...conv.unread, ...(otherId ? { [otherId]: (conv.unread[otherId] ?? 0) + 1 } : {}) },
  }
  writeAllMock(list)
}

function markReadMock(conversationId: string, viewerId: string) {
  const list = readAllMock()
  const idx = list.findIndex((c) => c.id === conversationId)
  if (idx === -1) return
  list[idx] = { ...list[idx], unread: { ...list[idx].unread, [viewerId]: 0 } }
  writeAllMock(list)
}

// ── Firebase implementation ──────────────────────────────────

async function getOrCreateConversationFirebase(me: ChatParticipant, other: ChatParticipant): Promise<string> {
  if (!db) throw new Error('Firebase nie jest skonfigurowane.')
  const id = conversationIdFor(me.id, other.id)
  const ref = doc(db, collections.conversations, id)
  const snap = await getDoc(ref)
  if (!snap.exists()) {
    await setDoc(ref, {
      participantIds: [me.id, other.id],
      participants: { [me.id]: me, [other.id]: other },
      lastMessage: '',
      lastMessageTime: '',
      lastMessageAt: Date.now(),
      unread: { [me.id]: 0, [other.id]: 0 },
    })
  }
  return id
}

function subscribeToConversationsFirebase(viewerId: string, callback: (list: ChatConversation[]) => void): () => void {
  if (!db) {
    callback([])
    return () => {}
  }
  const q = query(collection(db, collections.conversations), where('participantIds', 'array-contains', viewerId))
  return onSnapshot(q, (snap) => {
    const list: ChatConversation[] = snap.docs.map((d) => {
      const data = d.data() as Omit<StoredConversation, 'id' | 'messages'>
      const otherId = data.participantIds.find((id) => id !== viewerId) ?? data.participantIds[0]
      return {
        id: d.id,
        participant: data.participants[otherId],
        lastMessage: data.lastMessage,
        lastMessageTime: data.lastMessageTime,
        lastMessageAt: data.lastMessageAt ?? 0,
        unread: data.unread?.[viewerId] ?? 0,
      }
    })
    list.sort((a, b) => b.lastMessageAt - a.lastMessageAt)
    callback(list)
  })
}

function subscribeToMessagesFirebase(conversationId: string, callback: (list: ChatMessage[]) => void): () => void {
  if (!db) {
    callback([])
    return () => {}
  }
  const q = query(collection(db, collections.conversations, conversationId, 'items'), orderBy('createdAt', 'asc'))
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<ChatMessage, 'id'>) })))
  })
}

async function sendMessageFirebase(conversationId: string, sender: ChatParticipant, text: string, attachment?: ChatMessage['attachment']) {
  if (!db) throw new Error('Firebase nie jest skonfigurowane.')
  const messageText = text || (attachment ? `Wysłano załącznik: ${attachment.name}` : '')
  await addDoc(collection(db, collections.conversations, conversationId, 'items'), {
    senderId: sender.id,
    text: messageText,
    time: 'teraz',
    createdAt: Date.now(),
    ...(attachment ? { attachment } : {}),
  })
  const convRef = doc(db, collections.conversations, conversationId)
  const snap = await getDoc(convRef)
  const data = snap.data() as StoredConversation | undefined
  const otherId = data?.participantIds.find((id) => id !== sender.id)
  await updateDoc(convRef, {
    lastMessage: messageText,
    lastMessageTime: 'teraz',
    lastMessageAt: Date.now(),
    participants: { ...(data?.participants ?? {}), [sender.id]: sender },
    ...(otherId ? { [`unread.${otherId}`]: (data?.unread?.[otherId] ?? 0) + 1 } : {}),
  })
}

async function markReadFirebase(conversationId: string, viewerId: string) {
  if (!db) return
  await updateDoc(doc(db, collections.conversations, conversationId), { [`unread.${viewerId}`]: 0 })
}

// ── Public API ────────────────────────────────────────────────

/** Finds the conversation between these two people, creating it if needed. Returns its id. */
export async function getOrCreateConversation(me: ChatParticipant, other: ChatParticipant): Promise<string> {
  return isFirebaseConfigured ? getOrCreateConversationFirebase(me, other) : getOrCreateConversationMock(me, other)
}

/** Live list of the viewer's conversations, newest first. Always returns an unsubscribe function. */
export function subscribeToConversations(viewerId: string, callback: (list: ChatConversation[]) => void): () => void {
  if (isFirebaseConfigured) return subscribeToConversationsFirebase(viewerId, callback)
  callback(listConversationsMock(viewerId))
  if (!isBrowser()) return () => {}
  const handler = () => callback(listConversationsMock(viewerId))
  window.addEventListener('storage', handler)
  return () => window.removeEventListener('storage', handler)
}

/** Live messages for one thread, oldest first. Always returns an unsubscribe function. */
export function subscribeToMessages(conversationId: string, callback: (list: ChatMessage[]) => void): () => void {
  if (isFirebaseConfigured) return subscribeToMessagesFirebase(conversationId, callback)
  callback(getMessagesMock(conversationId))
  if (!isBrowser()) return () => {}
  const handler = () => callback(getMessagesMock(conversationId))
  window.addEventListener('storage', handler)
  return () => window.removeEventListener('storage', handler)
}

export async function sendMessage(conversationId: string, sender: ChatParticipant, text: string, attachment?: ChatMessage['attachment']): Promise<void> {
  if (isFirebaseConfigured) return sendMessageFirebase(conversationId, sender, text, attachment)
  sendMessageMock(conversationId, sender, text, attachment)
}

export async function markConversationRead(conversationId: string, viewerId: string): Promise<void> {
  if (isFirebaseConfigured) return markReadFirebase(conversationId, viewerId)
  markReadMock(conversationId, viewerId)
}
