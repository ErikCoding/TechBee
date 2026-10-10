export type ChatAttachmentInput = {
  name: string
  size: string
  kind: 'pdf' | 'image' | 'zip' | 'doc'
  url?: string
  storagePath?: string
  contentType?: string
}

/**
 * Server-side normalisation of a chat attachment sent by a client. A
 * participant may only reference files in their own folder of this very
 * conversation (the same path rule storage.rules enforces for uploads) and
 * only over https, so a crafted message cannot point other users at
 * someone else's file or a non-https/`javascript:` URL.
 */
export function sanitizeChatAttachment(value: unknown, ctx: { uid: string; conversationId: string; bucket?: string }): ChatAttachmentInput | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined
  const input = value as Record<string, unknown>
  const kind = input.kind
  if (kind !== 'pdf' && kind !== 'image' && kind !== 'zip' && kind !== 'doc') return undefined
  const name = typeof input.name === 'string' ? input.name.slice(0, 180) : ''
  const size = typeof input.size === 'string' ? input.size.slice(0, 40) : ''
  if (!name || !size) return undefined

  // Same path rule storage.rules enforces for uploads: own folder, this conversation.
  const allowedPrefix = `chat-attachments/${ctx.uid}/${ctx.conversationId}/`
  const storagePath = typeof input.storagePath === 'string'
    && input.storagePath.startsWith(allowedPrefix)
    && input.storagePath.length > allowedPrefix.length
    && !input.storagePath.includes('..')
    && input.storagePath.length <= 500
    ? input.storagePath
    : undefined

  // A download url is kept only when it demonstrably points at that exact
  // object in this project's bucket — never an arbitrary link.
  const urlPrefix = ctx.bucket
    ? `https://firebasestorage.googleapis.com/v0/b/${ctx.bucket}/o/`
    : 'https://firebasestorage.googleapis.com/v0/b/'
  const url = storagePath
    && typeof input.url === 'string'
    && input.url.length <= 2000
    && input.url.startsWith(urlPrefix)
    && input.url.includes(`/o/${encodeURIComponent(storagePath)}`)
    ? input.url
    : undefined

  return {
    name,
    size,
    kind,
    ...(url ? { url } : {}),
    ...(storagePath ? { storagePath } : {}),
    ...(typeof input.contentType === 'string' ? { contentType: input.contentType.slice(0, 120) } : {}),
  }
}
