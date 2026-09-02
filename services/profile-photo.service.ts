import { getDownloadURL, ref, uploadBytes } from 'firebase/storage'
import { isFirebaseConfigured, storage } from '@/lib/firebase'

const STORAGE_UPLOAD_TIMEOUT_MS = 8000
const IMAGE_PROCESSING_TIMEOUT_MS = 8000
const useFirebaseStorage = process.env.NEXT_PUBLIC_ENABLE_FIREBASE_STORAGE === 'true'

function extensionFor(file: File): string {
  if (file.type === 'image/png') return 'png'
  if (file.type === 'image/webp') return 'webp'
  return 'jpg'
}

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result ?? ''))
    reader.onerror = () => reject(new Error('Nie udało się odczytać zdjęcia.'))
    reader.onabort = () => reject(new Error('Odczyt zdjęcia został przerwany.'))
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

async function readCompressedDataUrl(file: File): Promise<string> {
  const raw = await readAsDataUrl(file)
  const image = await withTimeout(
    new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image()
      img.onload = () => resolve(img)
      img.onerror = () => reject(new Error('Nie udało się przetworzyć zdjęcia.'))
      img.src = raw
    }),
    IMAGE_PROCESSING_TIMEOUT_MS,
    'Przetwarzanie zdjęcia trwało zbyt długo.',
  )
  const maxSize = 512
  const scale = Math.min(1, maxSize / Math.max(image.width, image.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(image.width * scale))
  canvas.height = Math.max(1, Math.round(image.height * scale))
  const ctx = canvas.getContext('2d')
  if (!ctx) return raw
  ctx.drawImage(image, 0, 0, canvas.width, canvas.height)
  return canvas.toDataURL('image/jpeg', 0.78)
}

export async function uploadProfilePhoto(userId: string, file: File): Promise<string> {
  if (!useFirebaseStorage || !isFirebaseConfigured || !storage) return readCompressedDataUrl(file)

  const path = `profile-photos/${userId}/${Date.now()}.${extensionFor(file)}`
  const fileRef = ref(storage, path)
  try {
    await withTimeout(
      uploadBytes(fileRef, file, { contentType: file.type }),
      STORAGE_UPLOAD_TIMEOUT_MS,
      'Przesyłanie do Firebase Storage trwało zbyt długo.',
    )
    return await withTimeout(
      getDownloadURL(fileRef),
      STORAGE_UPLOAD_TIMEOUT_MS,
      'Pobieranie linku do zdjęcia trwało zbyt długo.',
    )
  } catch {
    return readCompressedDataUrl(file)
  }
}
