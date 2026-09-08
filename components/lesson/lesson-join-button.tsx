'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { Clock, Video } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { canJoinLesson, formatDurationClock } from '@/lib/lesson-time'
import type { Lesson } from '@/lib/types'

interface Props {
  lesson: Lesson
  href: string
  label: string
  size?: 'default' | 'sm'
  variant?: 'default' | 'outline'
  className?: string
}

function allowEarlyJoinForTesting(): boolean {
  if (process.env.NEXT_PUBLIC_ALLOW_EARLY_LESSON_JOIN === 'true') return true
  if (typeof window === 'undefined') return false
  return window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
}

export function LessonJoinButton({ lesson, href, label, size = 'default', variant = 'default', className }: Props) {
  const [now, setNow] = useState(Date.now())
  const allowEarlyJoin = useMemo(() => allowEarlyJoinForTesting(), [])
  const joinState = canJoinLesson(lesson, now, { allowEarlyJoin })

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(timer)
  }, [])

  if (joinState.canJoin) {
    return (
      <Link href={href} className={className}>
        <Button size={size} variant={variant} className="w-full font-semibold transition-transform hover:-translate-y-0.5">
          <Video className={size === 'sm' ? 'h-3 w-3' : 'h-4 w-4'} aria-hidden="true" />
          {label}
        </Button>
      </Link>
    )
  }

  const startsIn = joinState.startsAt ? formatDurationClock(joinState.startsAt - now) : null
  const blockedLabel = startsIn ? (size === 'sm' ? startsIn : `Start za ${startsIn}`) : 'Niedostępne'

  return (
    <Button size={size} variant="outline" disabled className={className} title={joinState.reason}>
      <Clock className={size === 'sm' ? 'h-3 w-3' : 'h-4 w-4'} aria-hidden="true" />
      <span className="truncate">{blockedLabel}</span>
    </Button>
  )
}
