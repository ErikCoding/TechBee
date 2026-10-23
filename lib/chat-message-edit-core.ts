/** How long after sending a text message its author may still edit it. */
export const CHAT_MESSAGE_EDIT_WINDOW_MS = 5 * 60 * 1000
export const CHAT_MESSAGE_MAX_LENGTH = 4000

type EditableMessageLike = {
  senderId?: unknown
  createdAt?: unknown
  text?: unknown
  attachment?: unknown
  reportCard?: unknown
}

/** Plain text messages only (no attachments / report cards), by their own sender, inside the window. */
export function canEditChatMessage(message: EditableMessageLike, uid: string, now = Date.now()): boolean {
  if (message.senderId !== uid) return false
  if (message.attachment || message.reportCard) return false
  if (typeof message.text !== 'string' || !message.text.trim()) return false
  if (typeof message.createdAt !== 'number' || !Number.isFinite(message.createdAt)) return false
  const age = now - message.createdAt
  return age >= 0 && age <= CHAT_MESSAGE_EDIT_WINDOW_MS
}

export function sanitizeEditedChatText(value: unknown): string {
  return typeof value === 'string' ? value.trim().slice(0, CHAT_MESSAGE_MAX_LENGTH) : ''
}
