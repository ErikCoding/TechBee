import type { Metadata } from 'next'
import { Navbar } from '@/components/layout/navbar'
import { RequireAuth } from '@/components/auth/require-auth'
import { LiveKitTestJoinClient } from '@/components/lesson/livekit-test-join-client'
import { noIndexMetadata } from '@/lib/seo'

export const metadata: Metadata = noIndexMetadata('Test LiveKit')

interface Props {
  searchParams: Promise<{ invite?: string }>
}

export default async function LiveKitTestJoinPage({ searchParams }: Props) {
  const { invite } = await searchParams

  return (
    <>
      <Navbar />
      <RequireAuth>
        <LiveKitTestJoinClient invite={invite} />
      </RequireAuth>
    </>
  )
}
