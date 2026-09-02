import Link from 'next/link'
import { BeeLogo } from '@/components/shared/bee-logo'

interface AuthShellProps {
  title: string
  subtitle: string
  children: React.ReactNode
  footer: React.ReactNode
}

/**
 * Shared centered-card layout for /login and /register.
 *
 * This is the original Runbee auth design, restored after a split-screen
 * variant was tried and rejected. The only thing carried over from that
 * attempt is the glow using the `primary` token instead of a hardcoded
 * `#F4B400` inline style — same brand colour, but it now follows the
 * theme in dark mode instead of being pinned to one literal.
 */
export function AuthShell({ title, subtitle, children, footer }: AuthShellProps) {
  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-background px-4 py-12">
      <div
        className="pointer-events-none absolute -top-40 left-1/2 h-[500px] w-[500px] -translate-x-1/2 rounded-full bg-primary opacity-[0.08] blur-3xl"
        aria-hidden="true"
      />
      <div className="relative w-full max-w-md">
        <div className="mb-6 flex justify-center">
          <BeeLogo size="lg" />
        </div>
        <div className="animate-fade-in-up glass rounded-3xl border border-border p-7 shadow-xl shadow-black/[0.04] sm:p-8">
          <div className="text-center">
            <h1 className="text-xl font-bold text-foreground">{title}</h1>
            <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>
          </div>
          <div className="mt-6">{children}</div>
        </div>
        <p className="mt-5 text-center text-sm text-muted-foreground">{footer}</p>
        <p className="mt-3 text-center text-xs text-muted-foreground">
          <Link href="/" className="hover:text-foreground transition-colors">← Wróć do strony głównej</Link>
        </p>
      </div>
    </main>
  )
}
