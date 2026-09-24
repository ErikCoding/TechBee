'use client'

import { useEffect, useMemo, useState } from 'react'
import type React from 'react'
import { Bell, CheckCircle2, KeyRound, Loader2, Mail, ShieldCheck, UserRound } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Dialog, DialogBody, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { FormError } from '@/components/ui/form-error'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { useAuth } from '@/lib/auth-context'
import { AccountSecurityRequestError } from '@/lib/account-security-client'
import {
  EMAIL_NOTIFICATION_GROUPS,
  getEmailNotificationPreference,
  normalizeNotificationPreferences,
  setEmailNotificationPreference,
  type EmailNotificationType,
  type NotificationPreferences,
} from '@/lib/notification-preferences'
import { roleLabelPl } from '@/lib/utils'
import {
  changeCurrentUserPassword,
  getCurrentAuthProviderState,
  requestCurrentUserEmailChange,
  type AuthProviderState,
} from '@/services/auth.service'
import { getUserNotificationPreferences, setUserEmailNotificationPreference } from '@/services/user-settings.service'

function SettingsSection({
  id,
  icon: Icon,
  title,
  description,
  children,
}: {
  id: string
  icon: React.ElementType
  title: string
  description: string
  children: React.ReactNode
}) {
  return (
    <section id={id} className="scroll-mt-20 overflow-hidden rounded-2xl border border-border bg-card">
      <div className="flex items-start gap-3 border-b border-border bg-muted/35 px-5 py-4">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent text-bee-yellow-dark">
          <Icon className="h-4 w-4" aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <h2 className="text-sm font-semibold text-foreground">{title}</h2>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{description}</p>
        </div>
      </div>
      <div className="p-5">{children}</div>
    </section>
  )
}

export function SettingsClient() {
  const { user, updateProfile, refreshVerification } = useAuth()
  const [name, setName] = useState(user?.name ?? '')
  const [preferences, setPreferences] = useState<NotificationPreferences>(() => normalizeNotificationPreferences(null))
  const [loadingPrefs, setLoadingPrefs] = useState(true)
  const [savingName, setSavingName] = useState(false)
  const [savingPreference, setSavingPreference] = useState<EmailNotificationType | null>(null)
  const [profileMessage, setProfileMessage] = useState<string | null>(null)
  const [profileError, setProfileError] = useState<string | null>(null)
  const [prefsError, setPrefsError] = useState<string | null>(null)
  const [providerState, setProviderState] = useState<AuthProviderState>(() => ({ hasPasswordProvider: true, providerIds: ['password'] }))
  const [passwordDialogOpen, setPasswordDialogOpen] = useState(false)
  const [emailDialogOpen, setEmailDialogOpen] = useState(false)
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [newPasswordRepeat, setNewPasswordRepeat] = useState('')
  const [passwordError, setPasswordError] = useState<string | null>(null)
  const [passwordMessage, setPasswordMessage] = useState<string | null>(null)
  const [passwordSaving, setPasswordSaving] = useState(false)
  const [emailCurrentPassword, setEmailCurrentPassword] = useState('')
  const [newEmail, setNewEmail] = useState('')
  const [emailError, setEmailError] = useState<string | null>(null)
  const [emailMessage, setEmailMessage] = useState<string | null>(null)
  const [emailSaving, setEmailSaving] = useState(false)

  useEffect(() => {
    if (!user) return
    setName(user.name)
    setNewEmail(user.email)
    setProviderState(getCurrentAuthProviderState())
    let cancelled = false
    setLoadingPrefs(true)
    getUserNotificationPreferences(user.id)
      .then((next) => { if (!cancelled) setPreferences(next) })
      .catch(() => { if (!cancelled) setPrefsError('Nie udało się wczytać preferencji powiadomień.') })
      .finally(() => { if (!cancelled) setLoadingPrefs(false) })
    return () => { cancelled = true }
  }, [user])

  useEffect(() => {
    if (!user?.id) return

    void refreshVerification().catch(() => {})
    const refreshWhenVisible = () => {
      if (document.visibilityState === 'visible') {
        void refreshVerification().catch(() => {})
      }
    }
    const refreshOnFocus = () => {
      void refreshVerification().catch(() => {})
    }

    document.addEventListener('visibilitychange', refreshWhenVisible)
    window.addEventListener('focus', refreshOnFocus)
    return () => {
      document.removeEventListener('visibilitychange', refreshWhenVisible)
      window.removeEventListener('focus', refreshOnFocus)
    }
  }, [refreshVerification, user?.id])

  const navItems = useMemo(() => [
    { href: '#konto', label: 'Konto' },
    { href: '#bezpieczenstwo', label: 'Bezpieczeństwo' },
    { href: '#powiadomienia', label: 'Powiadomienia' },
  ], [])

  async function saveName() {
    if (!user || !name.trim() || name.trim() === user.name) return
    setSavingName(true)
    setProfileMessage(null)
    setProfileError(null)
    try {
      await updateProfile({ name: name.trim(), photoUrl: user.photoUrl })
      setProfileMessage('Dane konta zostały zapisane.')
    } catch {
      setProfileError('Nie udało się zapisać danych konta.')
    } finally {
      setSavingName(false)
    }
  }

  async function togglePreference(type: EmailNotificationType, enabled: boolean) {
    if (!user) return
    const previous = preferences
    const optimistic = setEmailNotificationPreference(preferences, type, enabled)
    setPreferences(optimistic)
    setSavingPreference(type)
    setPrefsError(null)
    try {
      const saved = await setUserEmailNotificationPreference(user.id, type, enabled)
      setPreferences(saved)
    } catch {
      setPreferences(previous)
      setPrefsError('Nie udało się zapisać preferencji. Spróbuj ponownie.')
    } finally {
      setSavingPreference(null)
    }
  }

  async function submitPasswordChange(event: React.FormEvent) {
    event.preventDefault()
    setPasswordError(null)
    setPasswordMessage(null)
    if (!providerState.hasPasswordProvider) return
    if (newPassword.length < 6) {
      setPasswordError('Nowe hasło musi mieć co najmniej 6 znaków.')
      return
    }
    if (newPassword !== newPasswordRepeat) {
      setPasswordError('Nowe hasła nie są takie same.')
      return
    }
    setPasswordSaving(true)
    try {
      await changeCurrentUserPassword({ currentPassword, newPassword })
      setPasswordMessage('Hasło zostało zmienione.')
      setCurrentPassword('')
      setNewPassword('')
      setNewPasswordRepeat('')
    } catch (err) {
      setPasswordError(err instanceof Error ? err.message : 'Nie udało się zmienić hasła.')
    } finally {
      setPasswordSaving(false)
    }
  }

  async function submitEmailChange(event: React.FormEvent) {
    event.preventDefault()
    setEmailError(null)
    setEmailMessage(null)
    if (!providerState.hasPasswordProvider) return
    if (newEmail.trim().toLowerCase() === user?.email.trim().toLowerCase()) {
      setEmailError('Nowy adres jest taki sam jak obecny.')
      return
    }
    setEmailSaving(true)
    try {
      await requestCurrentUserEmailChange({ newEmail, currentPassword: emailCurrentPassword })
      setEmailMessage('Wysłaliśmy link potwierdzający na nowy adres e-mail. Obecny adres pozostaje aktywny do czasu potwierdzenia.')
      setEmailCurrentPassword('')
    } catch (err) {
      if (err instanceof AccountSecurityRequestError && err.status === 429) {
        setEmailError('Zbyt wiele prób. Spróbuj ponownie za chwilę.')
      } else {
        setEmailError(err instanceof Error ? err.message : 'Nie udało się rozpocząć zmiany adresu e-mail.')
      }
    } finally {
      setEmailSaving(false)
    }
  }

  if (!user) return null

  return (
    <div className="grid gap-6 lg:grid-cols-[240px_minmax(0,1fr)] lg:items-start">
      <aside className="lg:sticky lg:top-20">
        <div className="rounded-2xl border border-border bg-card p-3">
          <p className="px-2 pb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">Ustawienia</p>
          <nav className="flex gap-1 overflow-x-auto lg:flex-col lg:overflow-visible" aria-label="Sekcje ustawień">
            {navItems.map((item) => (
              <a key={item.href} href={item.href} className="whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">
                {item.label}
              </a>
            ))}
          </nav>
        </div>
      </aside>

      <div className="min-w-0">
        <header className="mb-5">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Konto Runbee</p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-foreground">Ustawienia</h1>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
            Zarządzaj danymi konta i preferencjami powiadomień. Wiadomości bezpieczeństwa, takie jak weryfikacja adresu e-mail, pozostają zawsze aktywne.
          </p>
        </header>

        <div className="flex flex-col gap-5">
          <SettingsSection id="konto" icon={UserRound} title="Konto" description="Podstawowe dane widoczne w Runbee.">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="flex flex-col gap-1.5">
                <label htmlFor="settings-name" className="text-xs font-medium text-foreground">Imię i nazwisko / nazwa</label>
                <Input id="settings-name" value={name} onChange={(event) => setName(event.target.value)} />
              </div>
              <div className="flex flex-col gap-1.5">
                <label htmlFor="settings-email" className="text-xs font-medium text-foreground">Adres e-mail</label>
                <Input id="settings-email" value={user.email} disabled readOnly />
              </div>
            </div>
            <div className="mt-4 flex flex-col gap-3 rounded-xl border border-border bg-background/45 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-semibold text-foreground">Status adresu e-mail</p>
                <p className="mt-1 text-xs text-muted-foreground">Potwierdzony adres pomaga chronić konto i odblokowuje wszystkie funkcje.</p>
              </div>
              <Badge variant={user.emailVerified === false ? 'outline' : 'default'} className="self-start sm:self-auto">
                {user.emailVerified === false ? 'Niezweryfikowany' : 'Zweryfikowany'}
              </Badge>
            </div>
            <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div className="text-xs text-muted-foreground">Typ konta: <span className="font-medium text-foreground">{roleLabelPl(user.role)}</span></div>
              <div className="flex flex-col gap-2 sm:flex-row">
                <Button type="button" variant="outline" onClick={() => setEmailDialogOpen(true)}>
                  <Mail className="h-4 w-4" aria-hidden="true" />
                  Zmień adres e-mail
                </Button>
                <Button type="button" onClick={saveName} disabled={savingName || !name.trim() || name.trim() === user.name} className="font-semibold">
                  {savingName ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                  Zapisz dane
                </Button>
              </div>
            </div>
            {profileMessage && <p className="mt-3 text-xs text-success-on-surface">{profileMessage}</p>}
            <FormError className="mt-3">{profileError}</FormError>
          </SettingsSection>

          <SettingsSection id="bezpieczenstwo" icon={ShieldCheck} title="Bezpieczeństwo" description="Opcje bezpieczeństwa konta.">
            <div className="flex flex-col gap-3 rounded-xl border border-border bg-background/45 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-semibold text-foreground">Hasło</p>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                  Zmień hasło po potwierdzeniu obecnego hasła.
                </p>
              </div>
              <Button type="button" variant="outline" onClick={() => setPasswordDialogOpen(true)}>
                <KeyRound className="h-4 w-4" aria-hidden="true" />
                Zmień hasło
              </Button>
            </div>
          </SettingsSection>

          <SettingsSection id="powiadomienia" icon={Bell} title="Powiadomienia" description="Wybierz, które opcjonalne maile transakcyjne chcesz dostawać.">
            <FormError className="mb-3">{prefsError}</FormError>
            {loadingPrefs ? (
              <div className="h-40 animate-pulse rounded-xl border border-border bg-muted/40" />
            ) : (
              <div className="divide-y divide-border rounded-xl border border-border">
                {EMAIL_NOTIFICATION_GROUPS.map((group) => (
                  <div key={group.id} className="p-4">
                    <div className="mb-3">
                      <h3 className="text-sm font-semibold text-foreground">{group.label}</h3>
                      <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{group.description}</p>
                    </div>
                    <div className="flex flex-col gap-2">
                      {group.items.map((item) => {
                        const type = `${group.id}.${item.id}` as EmailNotificationType
                        const checked = getEmailNotificationPreference(preferences, type)
                        return (
                          <label key={type} className="flex min-h-12 items-center justify-between gap-4 rounded-lg border border-border bg-background/40 px-3 py-2">
                            <span className="min-w-0">
                              <span className="block text-sm font-medium text-foreground">{item.label}</span>
                              <span className="block text-xs leading-relaxed text-muted-foreground">{item.description}</span>
                            </span>
                            <Switch
                              checked={checked}
                              disabled={savingPreference === type}
                              onCheckedChange={(value) => togglePreference(type, value === true)}
                              aria-label={item.label}
                            />
                          </label>
                        )
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}
            <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
              Maile bezpieczeństwa, weryfikacja adresu e-mail, reset hasła i potwierdzenia zmiany adresu nie są opcjonalne.
            </p>
          </SettingsSection>
        </div>
      </div>

      <Dialog open={passwordDialogOpen} onOpenChange={setPasswordDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Zmień hasło</DialogTitle>
            <DialogDescription>Potwierdź obecne hasło i ustaw nowe hasło do konta Runbee.</DialogDescription>
          </DialogHeader>
          <form onSubmit={submitPasswordChange}>
            <DialogBody>
              {!providerState.hasPasswordProvider ? (
                <div className="rounded-xl border border-border bg-muted/35 px-4 py-3 text-sm leading-relaxed text-muted-foreground">
                  To konto nie używa hasła Runbee. Hasło zmienisz u dostawcy logowania, którego używasz do wejścia na konto.
                </div>
              ) : (
                <>
                  <div className="flex flex-col gap-1.5">
                    <label htmlFor="settings-current-password" className="text-xs font-medium text-foreground">Obecne hasło</label>
                    <Input id="settings-current-password" type="password" autoComplete="current-password" value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} required />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label htmlFor="settings-new-password" className="text-xs font-medium text-foreground">Nowe hasło</label>
                    <Input id="settings-new-password" type="password" autoComplete="new-password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} placeholder="Min. 6 znaków" required />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label htmlFor="settings-new-password-repeat" className="text-xs font-medium text-foreground">Powtórz nowe hasło</label>
                    <Input id="settings-new-password-repeat" type="password" autoComplete="new-password" value={newPasswordRepeat} onChange={(event) => setNewPasswordRepeat(event.target.value)} required />
                  </div>
                </>
              )}
              {passwordMessage && <p className="text-xs text-success-on-surface">{passwordMessage}</p>}
              <FormError>{passwordError}</FormError>
            </DialogBody>
            <DialogFooter className="justify-end">
              <Button type="button" variant="outline" onClick={() => setPasswordDialogOpen(false)}>Zamknij</Button>
              {providerState.hasPasswordProvider && (
                <Button type="submit" disabled={passwordSaving} className="font-semibold">
                  {passwordSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />}
                  Zmień hasło
                </Button>
              )}
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={emailDialogOpen} onOpenChange={setEmailDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Zmień adres e-mail</DialogTitle>
            <DialogDescription>Nowy adres zostanie zapisany dopiero po kliknięciu linku potwierdzającego.</DialogDescription>
          </DialogHeader>
          <form onSubmit={submitEmailChange}>
            <DialogBody>
              {!providerState.hasPasswordProvider ? (
                <div className="rounded-xl border border-border bg-muted/35 px-4 py-3 text-sm leading-relaxed text-muted-foreground">
                  To konto korzysta z zewnętrznego dostawcy logowania. Zmianę adresu e-mail wykonaj u tego dostawcy albo skontaktuj się z pomocą Runbee.
                </div>
              ) : (
                <>
                  <div className="rounded-xl border border-border bg-muted/35 px-4 py-3 text-xs leading-relaxed text-muted-foreground">
                    Obecny adres <span className="font-medium text-foreground">{user.email}</span> pozostanie aktywny, dopóki nie potwierdzisz nowego adresu.
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label htmlFor="settings-new-email" className="text-xs font-medium text-foreground">Nowy adres e-mail</label>
                    <Input id="settings-new-email" type="email" autoComplete="email" value={newEmail} onChange={(event) => setNewEmail(event.target.value)} required />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label htmlFor="settings-email-current-password" className="text-xs font-medium text-foreground">Obecne hasło</label>
                    <Input id="settings-email-current-password" type="password" autoComplete="current-password" value={emailCurrentPassword} onChange={(event) => setEmailCurrentPassword(event.target.value)} required />
                  </div>
                </>
              )}
              {emailMessage && <p className="text-xs leading-relaxed text-success-on-surface">{emailMessage}</p>}
              <FormError>{emailError}</FormError>
            </DialogBody>
            <DialogFooter className="justify-end">
              <Button type="button" variant="outline" onClick={() => setEmailDialogOpen(false)}>Zamknij</Button>
              {providerState.hasPasswordProvider && (
                <Button type="submit" disabled={emailSaving} className="font-semibold">
                  {emailSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
                  Wyślij potwierdzenie
                </Button>
              )}
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
