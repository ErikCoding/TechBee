import { getDownloadURL, ref, uploadBytes } from 'firebase/storage'
import { isFirebaseConfigured, storage } from '@/lib/firebase'
import type { ChatMessage } from '@/lib/types'

const MAX_ATTACHMENT_BYTES = 8 * 1024 * 1024
const useFirebaseStorage = process.env.NEXT_PUBLIC_ENABLE_FIREBASE_STORAGE === 'true'

function safeFileName(name: string): string {
  return name
    .normalize('NFKD')
    .replace(/[^\w.\-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 90) || 'plik'
}

function kindFor(file: File): NonNullable<ChatMessage['attachment']>['kind'] {
  if (file.type.startsWith('image/')) return 'image'
  if (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) return 'pdf'
  if (file.type.includes('zip') || file.name.toLowerCase().endsWith('.zip')) return 'zip'
  return 'doc'
}

function sizeLabel(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`
  return `${Math.max(1, Math.round(bytes / 1024))} KB`
}

export async function prepareChatAttachment(conversationId: string, senderId: string, file: File): Promise<NonNullable<ChatMessage['attachment']>> {
  if (file.size > MAX_ATTACHMENT_BYTES) {
    throw new Error('Plik może mieć maksymalnie 8 MB.')
  }

  const base = {
    name: file.name,
    size: sizeLabel(file.size),
    kind: kindFor(file),
    contentType: file.type || 'application/octet-stream',
  } satisfies NonNullable<ChatMessage['attachment']>

  if (!useFirebaseStorage || !isFirebaseConfigured || !storage) return base

  const storagePath = `chat-attachments/${senderId}/${conversationId}/${Date.now()}-${safeFileName(file.name)}`
  const fileRef = ref(storage, storagePath)
  await uploadBytes(fileRef, file, { contentType: file.type || 'application/octet-stream' })
  const url = await getDownloadURL(fileRef)
  return { ...base, url, storagePath }
}
