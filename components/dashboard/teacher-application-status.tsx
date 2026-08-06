'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ClipboardList, Clock, XCircle, CheckCircle2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/lib/auth-context'
import { getTeacherApplication } from '@/services/teachers.service'
import type { Teacher } from '@/lib/types'

/**
 * Shown at the top of the teacher dashboard. Tells the signed-in
 * teacher whether they've applied to appear on the giełda yet, and
 * if so, where that application stands (pending / rejected /
 * approved).
 */
export function TeacherApplicationStatus() {
  const { user } = useAuth()
  const [application, setApplication] = useState<Teacher | null | undefined>(undefined)

  useEffect(() => {
    if (!user) return
    getTeacherApplication(user.id).then((app) => setApplication(app ?? null))
  }, [user])

  if (application === undefined) return null

  if (application === null) {
    return (
      <div className="mb-6 flex flex-col items-start gap-3 rounded-2xl border border-[#F4B400]/30 bg-[#FEF3C7] p-5 sm:flex-row sm:items-center sm:justify-between dark:bg-[#3B2800]">
        <div className="flex items-start gap-3">
          <ClipboardList className="mt-0.5 h-5 w-5 shrink-0 text-[#B45309] dark:text-[#FBBF24]" aria-hidden="true" />
          <div>
            <p className="text-sm font-semibold text-[#78350F] dark:text-[#FBBF24]">Jeszcze nie widnisz w giełdzie nauczycieli</p>
            <p className="mt-0.5 text-xs text-[#92400E] dark:text-[#FCD34D]">Uzupełnij profil, wyślij go do weryfikacji, a po akceptacji administratora uczniowie znajdą Cię w wyszukiwarce.</p>
          </div>
        </div>
        <Link href="/dashboard/teacher/apply" className="shrink-0">
          <Button size="sm" className="bg-[#F4B400] text-[#0A0A0A] hover:bg-[#FBBF24] font-semibold">Uzupełnij profil</Button>
        </Link>
      </div>
    )
  }

  if (application.status === 'pending') {
    return (
      <div className="mb-6 flex flex-col items-start gap-3 rounded-2xl border border-blue-500/30 bg-blue-500/5 p-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <Clock className="mt-0.5 h-5 w-5 shrink-0 text-blue-500" aria-hidden="true" />
          <div>
            <p className="text-sm font-semibold text-foreground">Profil czeka na weryfikację</p>
            <p className="mt-0.5 text-xs text-muted-foreground">Administrator sprawdza Twoje zgłoszenie. Pojawisz się w giełdzie zaraz po akceptacji.</p>
          </div>
        </div>
        <Link href="/dashboard/teacher/apply" className="shrink-0">
          <Button size="sm" variant="outline">Edytuj zgłoszenie</Button>
        </Link>
      </div>
    )
  }

  if (application.status === 'rejected') {
    return (
      <div className="mb-6 flex flex-col items-start gap-3 rounded-2xl border border-destructive/30 bg-destructive/5 p-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <XCircle className="mt-0.5 h-5 w-5 shrink-0 text-destructive" aria-hidden="true" />
          <div>
            <p className="text-sm font-semibold text-foreground">Zgłoszenie zostało odrzucone</p>
            <p className="mt-0.5 text-xs text-muted-foreground">Popraw dane profilu i wyślij je ponownie do weryfikacji.</p>
          </div>
        </div>
        <Link href="/dashboard/teacher/apply" className="shrink-0">
          <Button size="sm" className="bg-[#F4B400] text-[#0A0A0A] hover:bg-[#FBBF24] font-semibold">Popraw i wyślij ponownie</Button>
        </Link>
      </div>
    )
  }

  return (
    <div className="mb-6 flex flex-col items-start gap-3 rounded-2xl border border-emerald-500/30 bg-emerald-500/5 p-5 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-start gap-3">
        <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-500" aria-hidden="true" />
        <div>
          <p className="text-sm font-semibold text-foreground">Twój profil jest widoczny w giełdzie</p>
          <p className="mt-0.5 text-xs text-muted-foreground">Zweryfikowany profil — uczniowie mogą Cię teraz znaleźć i zarezerwować lekcję.</p>
        </div>
      </div>
      <Link href={`/teacher/${application.id}`} className="shrink-0">
        <Button size="sm" variant="outline">Zobacz swój profil</Button>
      </Link>
    </div>
  )
}
