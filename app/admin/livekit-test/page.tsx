import type { Metadata } from 'next'
import { AdminLiveKitTestClient } from '@/components/admin/admin-livekit-test-client'
import { noIndexMetadata } from '@/lib/seo'

export const metadata: Metadata = noIndexMetadata('Test LiveKit')

export default function AdminLiveKitTestPage() {
  return <AdminLiveKitTestClient />
}
