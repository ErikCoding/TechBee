import { getDownloadURL, ref, uploadBytes } from 'firebase/storage'
import { isFirebaseConfigured, storage } from '@/lib/firebase'
import type { ChatMessage } from '@/lib/types'

const MAX_ATTACHMENT_BYTES = 8 * 1024 * 1024
const STORAGE_UPLOAD_TIMEOUT_MS = 15000
const useFirebaseStorage = process.env.NEXT_PUBLIC_ENABLE_FIREBASE_STORAGE === 'true'

const ALLOWED_ATTACHMENT_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'application/pdf',
  'application/zip',
  'text/plain',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
]

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

function isAllowedAttachment(file: File): boolean {
  const name = file.name.toLowerCase()
  return (
    ALLOWED_ATTACHMENT_TYPES.includes(file.type) ||
    name.endsWith('.pdf') ||
    name.endsWith('.zip') ||
    name.endsWith('.doc') ||
    name.endsWith('.docx') ||
    name.endsWith('.xls') ||
    name.endsWith('.xlsx') ||
    name.endsWith('.ppt') ||
    name.endsWith('.pptx') ||
    name.endsWith('.txt')
  )
}

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result ?? ''))
    reader.onerror = () => reject(new Error('Nie udało się odczytać pliku.'))
    reader.onabort = () => reject(new Error('Odczyt pliku został przerwany.'))
    reader.readAsDataURL(file)
  })
}

function withTimeout<T>(promise: Promise<T>, ms: number, message: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timeout = window.setTimeout(() => reject(new Error(message)), ms)
    promise
      .then(resolve)
      .catch(reject)
      .finally(() => window.clearTimeout(timeout))
  })
}

export async function prepareChatAttachment(conversationId: string, senderId: string, file: File): Promise<NonNullable<ChatMessage['attachment']>> {
  if (file.size > MAX_ATTACHMENT_BYTES) {
    throw new Error('Plik może mieć maksymalnie 8 MB.')
  }
  if (!isAllowedAttachment(file)) {
    throw new Error('Możesz wysłać zdjęcie, PDF, ZIP, dokument Office albo plik TXT.')
  }

  const base = {
    name: file.name,
    size: sizeLabel(file.size),
    kind: kindFor(file),
    contentType: file.type || 'application/octet-stream',
  } satisfies NonNullable<ChatMessage['attachment']>

  if (!isFirebaseConfigured) {
    return { ...base, url: await readAsDataUrl(file) }
  }
  if (!useFirebaseStorage || !storage) {
    throw new Error('Załączniki wymagają włączonego Firebase Storage. Ustaw NEXT_PUBLIC_ENABLE_FIREBASE_STORAGE=true i zrób redeploy.')
  }

  const storagePath = `chat-attachments/${senderId}/${conversationId}/${Date.now()}-${safeFileName(file.name)}`
  const fileRef = ref(storage, storagePath)
  await withTimeout(
    uploadBytes(fileRef, file, { contentType: file.type || 'application/octet-stream' }),
    STORAGE_UPLOAD_TIMEOUT_MS,
    'Przesyłanie załącznika trwało zbyt długo.',
  )
  const url = await withTimeout(
    getDownloadURL(fileRef),
    STORAGE_UPLOAD_TIMEOUT_MS,
    'Nie udało się pobrać linku do załącznika.',
  )
  return { ...base, url, storagePath }
}
