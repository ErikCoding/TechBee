'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { MessageSquare, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/lib/auth-context'
import { getOrCreateConversation, toParticipant } from '@/services/chat.service'

interface BookLessonActionsProps {
  teacherId: string
  teacherName: string
  teacherInitials: string
  teacherAvatarColor: string
  specialty: string
}

/** Booking/messaging require an account — browsing a teacher's profile does not. */
export function BookLessonActions({ teacherId, teacherName, teacherInitials, teacherAvatarColor, specialty }: BookLessonActionsProps) {
  const { status, user } = useAuth()
  const router = useRouter()
  const [messaging, setMessaging] = useState(false)
  const redirect = encodeURIComponent(`/teacher/${teacherId}`)

  function goToBooking() {
    if (status === 'authenticated') {
      router.push(`/teacher/${teacherId}/book`)
    } else {
      router.push(`/login?redirect=${redirect}`)
    }
  }

  async function goToChat() {
    if (status !== 'authenticated' || !user) {
      router.push(`/login?redirect=${redirect}`)
      return
    }
    setMessaging(true)
    try {
      const me = toParticipant(user)
      const teacher = toParticipant({ id: teacherId, name: teacherName, initials: teacherInitials, avatarColor: teacherAvatarColor, role: 'teacher', specialty })
      const conversationId = await getOrCreateConversation(me, teacher)
      router.push(`/chat?with=${conversationId}`)
    } finally {
      setMessaging(false)
    }
  }

  return (
    <div className="mt-4 flex flex-col gap-3">
      <Button onClick={goToBooking} className="w-full bg-[#F4B400] text-[#0A0A0A] hover:bg-[#FBBF24] font-semibold transition-transform hover:-translate-y-0.5">
        Zarezerwuj lekcję
      </Button>
      {status === 'authenticated' ? (
        <Button variant="outline" className="w-full" onClick={goToChat} disabled={messaging}>
          {messaging ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <MessageSquare className="mr-2 h-4 w-4" />}
          Wyślij wiadomość
        </Button>
      ) : (
        <Link href={`/login?redirect=${redirect}`}>
          <Button variant="outline" className="w-full">
            <MessageSquare className="mr-2 h-4 w-4" />
            Wyślij wiadomość
          </Button>
        </Link>
      )}
    </div>
  )
}
