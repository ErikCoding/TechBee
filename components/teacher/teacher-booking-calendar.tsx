'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { CalendarDays, Clock, CheckCircle2, Loader2, MessageSquare } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { buildAvailability } from '@/lib/availability'
import { useAuth } from '@/lib/auth-context'
import { createBooking } from '@/services/lessons.service'
import { getWalletStats } from '@/services/wallet.service'
import { cn } from '@/lib/utils'
import type { Teacher } from '@/lib/types'

interface Props {
  teacher: Teacher
}

const DURATIONS = [
  { minutes: 60, label: '60 min' },
  { minutes: 90, label: '90 min' },
]

export function TeacherBookingCalendar({ teacher }: Props) {
  const { user } = useAuth()
  const router = useRouter()
  const days = useMemo(() => buildAvailability(teacher.availability), [teacher.availability])

  const [selectedDayIndex, setSelectedDayIndex] = useState(0)
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null)
  const [duration, setDuration] = useState(60)
  const [topic, setTopic] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [bookedLessonId, setBookedLessonId] = useState<string | null>(null)
  const [insufficientFunds, setInsufficientFunds] = useState(false)

  const selectedDay = days[selectedDayIndex]
  const price = Math.round((teacher.hourlyRate / 60) * duration)

  async function handleConfirm() {
    if (!user || !selectedDay || !selectedSlot || !topic.trim()) return
    setSubmitting(true)
    setInsufficientFunds(false)
    try {
      const wallet = await getWalletStats(user.id)
      if (wallet.balance < price) {
        setInsufficientFunds(true)
        return
      }
      const lesson = await createBooking({
        teacherId: teacher.id,
        teacherName: teacher.name,
        teacherInitials: teacher.initials,
        teacherColor: teacher.avatarColor,
        specialty: teacher.specialty,
        studentId: user.id,
        studentName: user.name,
        date: selectedDay.dayLabel,
        time: selectedSlot,
        duration,
        price,
        topic: topic.trim(),
      })
      setBookedLessonId(lesson.id)
    } finally {
      setSubmitting(false)
    }
  }

  if (days.length === 0) {
    return (
      <div className="rounded-2xl border border-border bg-card p-8 text-center">
        <p className="text-sm text-muted-foreground">Ten nauczyciel nie ma obecnie dostępnych terminów. Napisz do niego wiadomość, aby zapytać o dostępność.</p>
      </div>
    )
  }

  if (bookedLessonId) {
    return (
      <div className="animate-fade-in-up rounded-2xl border border-emerald-500/30 bg-emerald-500/5 p-8 text-center">
        <CheckCircle2 className="mx-auto h-10 w-10 text-emerald-500" aria-hidden="true" />
        <h2 className="mt-3 text-lg font-semibold text-foreground">Lekcja zarezerwowana!</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {selectedDay.dayLabel} o {selectedSlot} z {teacher.name} · {duration} min · {price} zł
        </p>
        <div className="mt-6 flex flex-col justify-center gap-2 sm:flex-row">
          <Button onClick={() => router.push('/dashboard/student')} className="bg-[#F4B400] text-[#0A0A0A] hover:bg-[#FBBF24] font-semibold">
            Przejdź do panelu ucznia
          </Button>
          <Link href={`/teacher/${teacher.id}`}>
            <Button variant="outline">Wróć do profilu nauczyciela</Button>
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Date picker */}
      <div>
        <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-foreground">
          <CalendarDays className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
          Wybierz dzień
        </h2>
        <div className="flex gap-2 overflow-x-auto pb-1">
          {days.map((day, i) => (
            <button
              key={day.isoDate}
              type="button"
              onClick={() => { setSelectedDayIndex(i); setSelectedSlot(null) }}
              className={cn(
                'flex shrink-0 flex-col items-center gap-0.5 rounded-xl border px-4 py-2.5 text-xs font-medium transition-colors',
                i === selectedDayIndex
                  ? 'border-[#F4B400] bg-[#FEF3C7] text-[#78350F] dark:bg-[#3B2800] dark:text-[#FBBF24]'
                  : 'border-border text-muted-foreground hover:bg-muted',
              )}
            >
              <span>{day.weekdayLabel}</span>
              <span className="text-[11px] opacity-80">{day.dayLabel.split(', ')[1]}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Time slots */}
      <div>
        <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-foreground">
          <Clock className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
          Wybierz godzinę — {selectedDay.dayLabel}
        </h2>
        <div className="flex flex-wrap gap-2">
          {selectedDay.slots.map((slot) => (
            <button
              key={slot}
              type="button"
              onClick={() => setSelectedSlot(slot)}
              className={cn(
                'rounded-lg border px-4 py-2 text-sm font-medium transition-colors',
                selectedSlot === slot
                  ? 'border-[#F4B400] bg-[#F4B400] text-[#0A0A0A]'
                  : 'border-border text-foreground hover:bg-muted',
              )}
            >
              {slot}
            </button>
          ))}
        </div>
      </div>

      {/* Duration */}
      <div>
        <h2 className="mb-3 text-sm font-semibold text-foreground">Długość lekcji</h2>
        <div className="flex gap-2">
          {DURATIONS.map((d) => (
            <button
              key={d.minutes}
              type="button"
              onClick={() => setDuration(d.minutes)}
              className={cn(
                'rounded-lg border px-4 py-2 text-sm font-medium transition-colors',
                duration === d.minutes
                  ? 'border-[#F4B400] bg-[#F4B400] text-[#0A0A0A]'
                  : 'border-border text-foreground hover:bg-muted',
              )}
            >
              {d.label}
            </button>
          ))}
        </div>
      </div>

      {/* Topic */}
      <div>
        <h2 className="mb-3 text-sm font-semibold text-foreground">Czego dotyczy lekcja?</h2>
        <Textarea
          value={topic}
          onChange={(e) => setTopic(e.target.value)}
          placeholder="np. Konfiguracja bloków funkcyjnych w TIA Portal, przygotowanie do egzaminu certyfikacyjnego..."
          rows={3}
        />
      </div>

      {insufficientFunds && (
        <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
          Niewystarczające środki w portfelu na tę lekcję ({price} zł).{' '}
          <Link href="/wallet" className="font-semibold underline underline-offset-2">Doładuj portfel</Link>, aby dokończyć rezerwację.
        </div>
      )}

      {/* Summary + confirm */}
      <div className="flex flex-col gap-3 rounded-2xl border border-border bg-muted/30 p-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm text-muted-foreground">Do zapłaty (z portfela BeeCoins)</p>
          <p className="text-2xl font-bold text-foreground">{price} zł</p>
        </div>
        <Button
          onClick={handleConfirm}
          disabled={!selectedSlot || !topic.trim() || submitting}
          className="bg-[#F4B400] text-[#0A0A0A] hover:bg-[#FBBF24] font-semibold transition-transform hover:-translate-y-0.5 disabled:hover:translate-y-0"
        >
          {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
          Potwierdź rezerwację
        </Button>
      </div>

      <Link href={`/teacher/${teacher.id}`} className="inline-flex w-fit items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground">
        <MessageSquare className="h-3.5 w-3.5" aria-hidden="true" />
        Wolisz najpierw zapytać? Napisz wiadomość z profilu nauczyciela.
      </Link>
    </div>
  )
}
