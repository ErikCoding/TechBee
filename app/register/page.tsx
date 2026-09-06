import { Suspense } from 'react'
import type { Metadata } from 'next'
import { RegisterForm } from '@/components/auth/register-form'
import { noIndexMetadata } from '@/lib/seo'

export const metadata: Metadata = noIndexMetadata('Załóż konto')

export default function RegisterPage() {
  return (
    <Suspense fallback={null}>
      <RegisterForm />
    </Suspense>
  )
}
