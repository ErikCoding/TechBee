import type { Metadata } from 'next'
import { noIndexMetadata } from '@/lib/seo'

export const metadata: Metadata = noIndexMetadata('Panel użytkownika')

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return children
}

