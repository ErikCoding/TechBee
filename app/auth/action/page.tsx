import { Suspense } from 'react'
import type { Metadata } from 'next'
import { AuthActionHandler } from '@/components/auth/auth-action-handler'
import { noIndexMetadata } from '@/lib/seo'

export const metadata: Metadata = noIndexMetadata('Potwierdzenie konta')

export default function AuthActionPage() {
  return (
    <Suspense fallback={null}>
      <AuthActionHandler />
    </Suspense>
  )
}
