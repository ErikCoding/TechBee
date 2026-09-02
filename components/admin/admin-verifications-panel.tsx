'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ShieldCheck, Check, X, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { getPendingTeacherApplications, reviewTeacherApplication } from '@/services/teachers.service'
import type { Teacher } from '@/lib/types'

export function AdminVerificationsPanel() {
  const [applications, setApplications] = useState<Teacher[] | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)

  useEffect(() => {
    getPendingTeacherApplications().then(setApplications)
  }, [])

  async function decide(id: string, decision: 'approved' | 'rejected') {
    setBusyId(id)
    try {
      await reviewTeacherApplication(id, decision)
      setApplications((prev) => (prev ?? []).filter((a) => a.id !== id))
    } finally {
      setBusyId(null)
    }
  }

  return (
    <section className="animate-fade-in-up overflow-hidden rounded-2xl border border-border">
      <div className="flex items-center gap-2 bg-muted/40 px-5 py-3.5">
        <ShieldCheck className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
        <h2 className="text-sm font-semibold text-foreground">Oczekujące zgłoszenia</h2>
        {applications !== null && applications.length > 0 && (
          <Badge className="ml-auto">{applications.length}</Badge>
        )}
      </div>

      <div className="bg-card p-5">
      {applications === null ? (
        <div className="h-20 animate-pulse rounded-xl bg-muted" />
      ) : applications.length === 0 ? (
        <p className="text-sm text-muted-foreground">Brak zgłoszeń czekających na weryfikację.</p>
      ) : (
        <div className="flex flex-col divide-y divide-border overflow-hidden rounded-xl border border-border">
          {applications.map((app) => (
            <div key={app.id} className="flex flex-col gap-3 p-4 transition-colors hover:bg-muted/30 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-start gap-3">
                <Avatar className="h-10 w-10 shrink-0">
                  {app.photoUrl && <AvatarImage src={app.photoUrl} alt="" />}
                  <AvatarFallback color={app.avatarColor}>{app.initials}</AvatarFallback>
                </Avatar>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-semibold text-foreground">{app.name}</p>
                    <Badge variant="secondary" className="text-[10px]">{app.specialty}</Badge>
                  </div>
                  <p className="mt-0.5 max-w-md text-xs text-muted-foreground">{app.shortBio}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">{app.location} · {app.hourlyRate} zł/godz. · {app.experience} lat doświadczenia</p>
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-2 self-end sm:self-center">
                <Button
                  size="sm"
                  variant="outline"
                  disabled={busyId === app.id}
                  onClick={() => decide(app.id, 'rejected')}
                  className="text-destructive hover:text-destructive"
                >
                  {busyId === app.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <X className="h-3.5 w-3.5" />}
                  Odrzuć
                </Button>
                <Button
                  size="sm"
                  disabled={busyId === app.id}
                  onClick={() => decide(app.id, 'approved')}
                  className="font-semibold"
                >
                  {busyId === app.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                  Zaakceptuj
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <p className="mt-4 text-xs text-muted-foreground">
        Zaakceptowani nauczyciele pojawiają się od razu w{' '}
        <Link href="/marketplace" className="underline underline-offset-2 hover:text-foreground">giełdzie nauczycieli</Link>.
      </p>
      </div>
    </section>
  )
}
