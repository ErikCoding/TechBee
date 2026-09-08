'use client'

import { useRef, useState } from 'react'
import { ImagePlus, Link as LinkIcon, Trash2 } from 'lucide-react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useAuth } from '@/lib/auth-context'
import { uploadProfilePhoto } from '@/services/profile-photo.service'

interface Props {
  value?: string
  onChange: (value: string) => void
  onCommit?: (value: string) => Promise<void> | void
  initials: string
  avatarColor: string
}

export function ProfilePhotoPicker({ value, onChange, onCommit, initials, avatarColor }: Props) {
  const { user } = useAuth()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [error, setError] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [committing, setCommitting] = useState(false)

  async function commit(value: string) {
    if (!onCommit) return
    setCommitting(true)
    try {
      await onCommit(value)
    } catch {
      setError('Zdjęcie zostało przygotowane, ale nie udało się zapisać profilu. Spróbuj kliknąć „Zapisz profil”.')
    } finally {
      setCommitting(false)
    }
  }

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setError(null)
    if (!file.type.startsWith('image/')) {
      setError('Wybierz plik graficzny.')
      e.target.value = ''
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      setError('Zdjęcie może mieć maksymalnie 5 MB.')
      e.target.value = ''
      return
    }
    if (!user) {
      setError('Zaloguj się ponownie, aby dodać zdjęcie.')
      e.target.value = ''
      return
    }
    setUploading(true)
    try {
      const nextUrl = await uploadProfilePhoto(user.id, file)
      onChange(nextUrl)
      await commit(nextUrl)
    } catch {
      setError('Nie udało się przetworzyć zdjęcia. Spróbuj użyć pliku JPG, PNG albo WebP.')
    } finally {
      setUploading(false)
      e.target.value = ''
    }
  }

  async function handleRemove() {
    onChange('')
    await commit('')
  }

  const busy = uploading || committing

  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
        <Avatar className="h-20 w-20 shrink-0">
          {value && <AvatarImage src={value} alt="" />}
          <AvatarFallback color={avatarColor} className="text-xl">
            {initials}
          </AvatarFallback>
        </Avatar>

        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-foreground">Zdjęcie profilowe</p>
          <div className="mt-3 flex flex-col gap-2 sm:flex-row">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              className="hidden"
              onChange={handleFile}
            />
            <Button type="button" variant="outline" onClick={() => fileInputRef.current?.click()} disabled={busy}>
              <ImagePlus className="h-4 w-4" aria-hidden="true" />
              {uploading ? 'Przetwarzanie...' : committing ? 'Zapisywanie...' : 'Dodaj zdjęcie'}
            </Button>
            {value && (
              <Button type="button" variant="ghost" onClick={handleRemove} disabled={busy}>
                <Trash2 className="h-4 w-4" aria-hidden="true" />
                Usuń
              </Button>
            )}
          </div>
          {error && <p className="mt-2 text-xs text-destructive">{error}</p>}
        </div>
      </div>

      <div className="mt-4 flex flex-col gap-1.5">
        <label htmlFor="profile-photo-url" className="flex items-center gap-1.5 text-xs font-medium text-foreground">
          <LinkIcon className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
          Link do zdjęcia
        </label>
        <Input
          id="profile-photo-url"
          type="url"
          value={value ?? ''}
          onChange={(e) => onChange(e.target.value)}
          placeholder="https://..."
          disabled={busy}
        />
      </div>
    </div>
  )
}
