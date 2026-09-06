import type { Metadata } from 'next'
import { Navbar } from '@/components/layout/navbar'
import { RequireAuth } from '@/components/auth/require-auth'
import { LessonRoomClient } from '@/components/lesson/lesson-room-client'
import { noIndexMetadata } from '@/lib/seo'

export const metadata: Metadata = noIndexMetadata('Pokój lekcji')

interface Props {
  params: Promise<{ id: string }>
  searchParams: Promise<{ topic?: string; with?: string }>
}

export default async function LessonRoomPage({ params, searchParams }: Props) {
  const { id } = await params
  const { topic, with: withName } = await searchParams

  return (
    <>
      <Navbar />
      <main id="main-content" className="bg-[#0A0A0A]">
        <RequireAuth>
          <LessonRoomClient lessonId={id} topic={topic} participantName={withName} />
        </RequireAuth>
      </main>
    </>
  )
}
