'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { BookOpenCheck, CalendarPlus, Clock, PackageCheck, Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { useAuth } from '@/lib/auth-context'
import { getStudentLessonPackages } from '@/services/lesson-packages.service'
import { cn } from '@/lib/utils'
import type { LessonPackage } from '@/lib/types'

interface Props {
  initialPackages?: LessonPackage[]
}

function lessonsLabel(count: number): string {
  if (count === 1) return 'lekcja'
  if (count >= 2 && count <= 4) return 'lekcje'
  return 'lekcji'
}

function reservedLabel(count: number): string {
  return count === 1 ? 'zarezerwowana' : count >= 2 && count <= 4 ? 'zarezerwowane' : 'zarezerwowanych'
}

function activePackagesLabel(count: number): string {
  return `${count} ${count === 1 ? 'aktywny' : 'aktywne'}`
}

function packageProgress(pkg: LessonPackage): number {
  if (pkg.packageSize <= 0) return 0
  const unavailable = Math.min(pkg.packageSize, Math.max(0, pkg.usedCredits + pkg.reservedCredits))
  return Math.round((unavailable / pkg.packageSize) * 100)
}

function pln(grosze: number): string {
  return `${(grosze / 100).toLocaleString('pl-PL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} zł`
}

function PackageCard({ pkg, muted = false }: { pkg: LessonPackage; muted?: boolean }) {
  const progress = packageProgress(pkg)
  const remainingLabel = `${pkg.remainingCredits} z ${pkg.packageSize} ${lessonsLabel(pkg.packageSize)} pozostało`
  const subtotal = pkg.subtotalGrosze ?? pkg.totalPriceGrosze
  const serviceFee = pkg.studentServiceFeeGrosze ?? 0
  const total = pkg.studentTotalGrosze ?? subtotal + serviceFee

  return (
    <article className={cn('flex flex-col gap-4 px-5 py-4 transition-colors hover:bg-foreground/[0.03]', muted && 'opacity-75')}>
      <div className="flex items-start gap-3">
        <Avatar className="h-10 w-10 shrink-0">
          {pkg.teacherPhotoUrl && <AvatarImage src={pkg.teacherPhotoUrl} alt="" />}
          <AvatarFallback color={pkg.teacherColor} className="text-sm">
            {pkg.teacherInitials}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="truncate text-sm font-semibold text-foreground">{pkg.teacherName}</h3>
            <Badge variant={pkg.status === 'active' ? 'secondary' : 'outline'} className="text-[10px]">
              Pakiet {pkg.packageSize}
            </Badge>
          </div>
          <p className="mt-0.5 truncate text-xs text-muted-foreground">
            {pkg.specialty} · {pkg.duration} min
          </p>
        </div>
        {pkg.status === 'active' && pkg.remainingCredits > 0 && (
          <Link href={`/teacher/${pkg.teacherId}/book`} className="hidden shrink-0 sm:block">
            <Button size="sm" className="h-8 text-xs font-semibold">
              <CalendarPlus className="h-3.5 w-3.5" aria-hidden="true" />
              Zarezerwuj lekcję
            </Button>
          </Link>
        )}
      </div>

      <div>
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <p className="text-base font-bold text-foreground">{remainingLabel}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {pkg.usedCredits} wykorzystane · {pkg.reservedCredits} {reservedLabel(pkg.reservedCredits)}
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Zapłacono {pln(total)}
            {serviceFee > 0 ? ` · opłata serwisowa ${pln(serviceFee)}` : ''}
          </p>
        </div>
          {pkg.status !== 'active' && (
            <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-1 text-[11px] font-medium text-muted-foreground">
              <Clock className="h-3 w-3" aria-hidden="true" />
              Wyczerpany
            </span>
          )}
        </div>
        <div className="mt-3 h-2 overflow-hidden rounded-full bg-muted">
          <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${progress}%` }} />
        </div>
      </div>

      {pkg.status === 'active' && pkg.remainingCredits > 0 && (
        <Link href={`/teacher/${pkg.teacherId}/book`} className="sm:hidden">
          <Button size="sm" className="w-full font-semibold">
            <CalendarPlus className="h-3.5 w-3.5" aria-hidden="true" />
            Zarezerwuj lekcję
          </Button>
        </Link>
      )}
    </article>
  )
}

export function StudentPackagesPanel({ initialPackages = [] }: Props) {
  const { user } = useAuth()
  const [packages, setPackages] = useState(initialPackages)

  useEffect(() => {
    if (!user) return
    let cancelled = false
    getStudentLessonPackages(user.id)
      .then((fresh) => {
        if (!cancelled) setPackages(fresh)
      })
      .catch(() => {
        if (!cancelled) setPackages([])
      })
    return () => {
      cancelled = true
    }
  }, [user])

  const { activePackages, exhaustedPackages } = useMemo(() => ({
    activePackages: packages.filter((pkg) => pkg.status === 'active'),
    exhaustedPackages: packages.filter((pkg) => pkg.status === 'exhausted'),
  }), [packages])

  if (packages.length === 0) {
    return (
      <section className="overflow-hidden rounded-2xl border border-border bg-card/60">
        <div className="flex items-center gap-2 border-b border-border px-5 py-3.5">
          <PackageCheck className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
          <h2 className="min-w-0 flex-1 text-sm font-semibold text-foreground">Moje pakiety</h2>
        </div>
        <div className="flex flex-col items-center px-5 py-10 text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
            <PackageCheck className="h-6 w-6" aria-hidden="true" />
          </span>
          <h3 className="mt-3 text-base font-bold text-foreground">Brak pakietów</h3>
          <p className="mt-1 max-w-sm text-sm text-muted-foreground">
            Pakiet to kilka lekcji opłaconych z góry u jednego nauczyciela. Pakiet kupisz przy rezerwacji lekcji u nauczyciela, który go oferuje.
          </p>
          <Link href="/marketplace" className="mt-5">
            <Button className="font-semibold">
              <Search className="h-4 w-4" aria-hidden="true" />
              Wybierz nauczyciela
            </Button>
          </Link>
        </div>
      </section>
    )
  }

  return (
    <section className="overflow-hidden rounded-2xl border border-border bg-card/60">
      <div className="flex items-center gap-2 border-b border-border px-5 py-3.5">
        <PackageCheck className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
        <h2 className="min-w-0 flex-1 text-sm font-semibold text-foreground">Moje pakiety</h2>
        {activePackages.length > 0 && <Badge className="text-[10px]">{activePackagesLabel(activePackages.length)}</Badge>}
      </div>

      {activePackages.length > 0 ? (
        <div className="divide-y divide-border">
          {activePackages.map((pkg) => <PackageCard key={pkg.id} pkg={pkg} />)}
        </div>
      ) : (
        <div className="flex items-start gap-3 px-5 py-4">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
            <BookOpenCheck className="h-4 w-4" aria-hidden="true" />
          </span>
          <div>
            <p className="text-sm font-semibold text-foreground">Brak aktywnych pakietów</p>
            <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
              Wykorzystane pakiety zostają niżej jako krótka historia.
            </p>
          </div>
        </div>
      )}

      {exhaustedPackages.length > 0 && (
        <div className="border-t border-border">
          <div className="px-5 pt-3 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            Historia pakietów
          </div>
          <div className="divide-y divide-border/70">
            {exhaustedPackages.slice(0, 3).map((pkg) => <PackageCard key={pkg.id} pkg={pkg} muted />)}
          </div>
        </div>
      )}
    </section>
  )
}
