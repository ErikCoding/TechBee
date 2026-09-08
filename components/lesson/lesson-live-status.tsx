'use client'

import { useEffect, useMemo, useState } from 'react'
import { Clock3, Radio, Users } from 'lucide-react'
import { getLiveLessonRoomStatus } from '@/services/livekit.service'
import {
  formatDurationClock,
  LESSON_JOIN_EARLY_MINUTES,
  lessonAutoEndAtMs,
  lessonStartAtMs,
} from '@/lib/lesson-time'
import { cn } from '@/lib/utils'
import type { Lesson } from '@/lib/types'

interface Props {
  lesson: Lesson
  className?: string
}

export function LessonLiveStatus({ lesson, className }: Props) {
  const [now, setNow] = useState(Date.now())
  const [participantCount, setParticipantCount] = useState(0)
  const [liveConfigured, setLiveConfigured] = useState(false)

  const startAt = useMemo(() => lessonStartAtMs(lesson) ?? undefined, [lesson])
  const autoEndAt = useMemo(() => lessonAutoEndAtMs(lesson) ?? undefined, [lesson])

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(timer)
  }, [])

  useEffect(() => {
    let cancelled = false
    async function poll() {
      const status = await getLiveLessonRoomStatus(lesson.id)
      if (cancelled) return
      setLiveConfigured(status.configured)
      setParticipantCount(status.participantCount)
    }
    poll()
    const timer = setInterval(poll, 15000)
    return () => {
      cancelled = true
      clearInterval(timer)
    }
  }, [lesson.id])

  let label = 'Termin zaplanowany'
  let tone = 'border-border bg-muted text-muted-foreground'
  let Icon = Clock3

  if (participantCount > 0) {
    label = `${participantCount} ${participantCount === 1 ? 'osoba w sali' : 'osoby w sali'}`
    tone = 'border-success/30 bg-success-surface text-success-on-surface'
    Icon = Users
  } else if (startAt && autoEndAt && now >= startAt && now <= autoEndAt) {
    label = `Trwa ${formatDurationClock(now - startAt)}`
    tone = 'border-primary/30 bg-accent text-accent-foreground'
    Icon = Radio
  } else if (startAt && now < startAt) {
    const joinAt = startAt - LESSON_JOIN_EARLY_MINUTES * 60 * 1000
    label = now >= joinAt ? 'Sala już dostępna' : `Start za ${formatDurationClock(startAt - now)}`
    tone = now >= joinAt
      ? 'border-primary/30 bg-accent text-accent-foreground'
      : 'border-border bg-muted text-muted-foreground'
  } else if (autoEndAt && now > autoEndAt) {
    label = 'Po czasie'
  }

  if (!liveConfigured && participantCount === 0 && startAt && autoEndAt && now >= startAt && now <= autoEndAt) {
    label = `Trwa ${formatDurationClock(now - startAt)}`
  }

  return (
    <span className={cn('inline-flex min-h-7 max-w-full items-center gap-1.5 rounded-full border px-2.5 text-[11px] font-semibold shadow-sm shadow-black/0', tone, className)}>
      <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
      <span className="truncate">{label}</span>
    </span>
  )
}
