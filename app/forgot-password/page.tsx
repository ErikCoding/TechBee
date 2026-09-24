import type { Metadata } from 'next'
import { ForgotPasswordForm } from '@/components/auth/forgot-password-form'
import { noIndexMetadata } from '@/lib/seo'

export const metadata: Metadata = noIndexMetadata('Zmień hasło')

export default function ForgotPasswordPage() {
  return <ForgotPasswordForm />
}
