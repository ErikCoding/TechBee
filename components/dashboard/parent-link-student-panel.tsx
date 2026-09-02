'use client'

import { useState } from 'react'
import { UserPlus, Loader2, AlertCircle, ChevronDown } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useAuth } from '@/lib/auth-context'
import { redeemLinkCode } from '@/services/family-link.service'
import { cn } from '@/lib/utils'

interface Props {
  /** Expanded by default when no child is linked yet — that's the only thing a fresh parent account can usefully do. */
  defaultOpen: boolean
  onLinked: () => void
}

/**
 * The "wpisz kod dziecka" form, extracted from the old
 * ParentLinkedStudents component and turned into a disclosure.
 *
 * Linking is a one-time setup task, but the form previously sat as a
 * permanently expanded card at the very top of the parent's main column,
 * above their children and everything else — a parent who linked months
 * ago still met an empty code input first on every visit. It now starts
 * expanded only while there is nobody linked, and otherwise costs a
 * single collapsed row at the bottom of the rail.
 *
 * `redeemLinkCode` and its error handling are unchanged.
 */
export function ParentLinkStudentPanel({ defaultOpen, onLinked }: Props) {
  const { user } = useAuth()
  const [open, setOpen] = useState(defaultOpen)
  const [code, setCode] = useState('')
  const [redeeming, setRedeeming] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleRedeem(e: React.FormEvent) {
    e.preventDefault()
    if (!user || !code.trim()) return
    setRedeeming(true)
    setError(null)
    try {
      const result = await redeemLinkCode(user.id, code.trim())
      if (!result.ok) {
        setError(result.error)
        return
      }
      setCode('')
      onLinked()
    } finally {
      setRedeeming(false)
    }
  }

  return (
    <section className="overflow-hidden rounded-2xl border border-border bg-card">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center gap-2.5 px-5 py-3.5 text-left transition-colors hover:bg-muted/40"
      >
        <UserPlus className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
        <div className="min-w-0 flex-1">
          <h2 className="text-sm font-semibold text-foreground">Połącz konto ucznia</h2>
          <p className="truncate text-[11px] text-muted-foreground">Wpisz kod wygenerowany w panelu dziecka</p>
        </div>
        <ChevronDown
          className={cn('h-4 w-4 shrink-0 text-muted-foreground transition-transform', open && 'rotate-180')}
          aria-hidden="true"
        />
      </button>

      {open && (
        <div className="border-t border-border px-5 py-4">
          <p className="text-xs leading-relaxed text-muted-foreground">
            Kod znajdziesz u dziecka w panelu ucznia → „Konto rodzica".
          </p>
          <form onSubmit={handleRedeem} className="mt-3 flex flex-col gap-2 sm:flex-row">
            <Input
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="np. 7K9XQP"
              className="font-mono uppercase tracking-widest sm:max-w-[220px]"
              maxLength={6}
              aria-label="Kod ucznia"
            />
            <Button type="submit" disabled={redeeming || !code.trim()} className="font-semibold">
              {redeeming ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              ) : (
                <UserPlus className="h-4 w-4" aria-hidden="true" />
              )}
              Połącz
            </Button>
          </form>
          {error && (
            <div className="mt-3 flex items-start gap-2 rounded-lg bg-destructive/10 px-3 py-2 text-xs text-destructive">
              <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              {error}
            </div>
          )}
        </div>
      )}
    </section>
  )
}
