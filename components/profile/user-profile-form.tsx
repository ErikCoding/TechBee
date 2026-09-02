'use client'

import { useEffect, useState } from 'react'
import { CheckCircle2, Loader2, Save } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ProfilePhotoPicker } from '@/components/profile/profile-photo-picker'
import { useAuth } from '@/lib/auth-context'
import { roleLabelPl } from '@/lib/utils'

export function UserProfileForm() {
  const { user, updateProfile } = useAuth()
  const [name, setName] = useState(user?.name ?? '')
  const [photoUrl, setPhotoUrl] = useState(user?.photoUrl ?? '')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!user) return
    setName(user.name)
    setPhotoUrl(user.photoUrl ?? '')
  }, [user])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!user) return
    setSaving(true)
    setSaved(false)
    setError(null)
    try {
      await updateProfile({ name, photoUrl })
      setSaved(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Nie udało się zapisać profilu.')
    } finally {
      setSaving(false)
    }
  }

  if (!user) return null

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5">
      <ProfilePhotoPicker
        value={photoUrl}
        onChange={setPhotoUrl}
        initials={user.initials}
        avatarColor={user.avatarColor}
      />

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="profile-name" className="text-xs font-medium text-foreground">Imię i nazwisko</label>
          <Input
            id="profile-name"
            required
            autoComplete="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="profile-email" className="text-xs font-medium text-foreground">Adres e-mail</label>
          <Input id="profile-email" value={user.email} disabled />
        </div>
      </div>

      <div className="rounded-xl border border-border bg-muted/40 px-4 py-3">
        <p className="text-xs font-medium text-muted-foreground">Typ konta</p>
        <p className="mt-1 text-sm font-semibold text-foreground">{roleLabelPl(user.role)}</p>
      </div>

      {error && (
        <p className="rounded-lg bg-destructive/10 px-3 py-2 text-xs text-destructive">{error}</p>
      )}

      {saved && !error && (
        <p className="flex items-center gap-2 rounded-lg bg-success-surface px-3 py-2 text-xs text-success-on-surface">
          <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
          Profil został zapisany.
        </p>
      )}

      <Button type="submit" disabled={saving} className="font-semibold sm:w-fit">
        {saving ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Save className="h-4 w-4" aria-hidden="true" />}
        Zapisz profil
      </Button>
    </form>
  )
}
