'use client'

import type { ReactNode } from 'react'
import Link from 'next/link'
import { MessageSquare } from 'lucide-react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { BackButton } from '@/components/shared/back-button'
import { BookingStepper } from './booking-stepper'
import { useBookingFlow } from './booking-flow-provider'

export function BookingShell({ children }: { children: ReactNode }) {
  const { teacher, bookingFor, error, completed } = useBookingFlow()
  return (
    <div className="w-full px-4 pb-12 pt-5 sm:px-5 lg:px-6 lg:pt-6">
      <div className="mx-auto w-full max-w-[900px]">
        {!completed && <BackButton fallbackHref={`/teacher/${teacher.id}`} />}
        <div className="flex items-center gap-3 py-3">
          <Avatar className="h-10 w-10 shrink-0">
            {teacher.photoUrl && <AvatarImage src={teacher.photoUrl} alt="" />}
            <AvatarFallback color={teacher.avatarColor}>{teacher.initials}</AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <h1 className="truncate text-base font-bold text-foreground sm:text-lg">
              {bookingFor ? `Rezerwacja dla ${bookingFor.name}` : `Rezerwacja lekcji z ${teacher.name}`}
            </h1>
            <p className="truncate text-xs text-muted-foreground">{teacher.specialty} · {teacher.hourlyRate} zł/godz.</p>
          </div>
        </div>
        <div className="mx-auto w-full"><BookingStepper /></div>
        <div className="mt-6 w-full">{children}</div>
        {error && (
          <div role="alert" className="mt-4 rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">{error}</div>
        )}
        {!completed && (
          <Link href={`/teacher/${teacher.id}`} className="mt-6 inline-flex items-center gap-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground">
            <MessageSquare className="h-3.5 w-3.5" aria-hidden="true" />
            Wolisz najpierw zapytać? Napisz wiadomość z profilu nauczyciela.
          </Link>
        )}
      </div>
    </div>
  )
}
