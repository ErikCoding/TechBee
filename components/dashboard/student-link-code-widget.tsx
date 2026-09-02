'use client'

import { useEffect, useState } from 'react'
import { Users, Copy, Check, RefreshCw, Loader2, ChevronDown } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { useAuth } from '@/lib/auth-context'
import { generateStudentLinkCode, getLinkedParents, type LinkedPersonSummary } from '@/services/family-link.service'
import { cn } from '@/lib/utils'
import type { StudentLinkCode } from '@/lib/types'

/**
 * Lets a student generate a single-use code so a parent can link their
 * account as a supervising "konto rodzica" (see services/family-link.service.ts
 * and techbee-blueprint.md §3). Shows already-linked parents instead, once any exist.
 *
 * Restructured as a disclosure row rather than a permanently expanded
 * card: linking a parent is a one-time setup task, but the old card
 * claimed a fixed block of prime side-rail space forever — including for
 * students who had already done it. Collapsed it costs one row; the
 * generate/copy flow and the linked-parent list are unchanged underneath.
 */
export function StudentLinkCodeWidget() {
  const { user } = useAuth()
  const [parents, setParents] = useState<LinkedPersonSummary[] | null>(null)
  const [code, setCode] = useState<StudentLinkCode | null>(null)
  const [generating, setGenerating] = useState(false)
  const [copied, setCopied] = useState(false)
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (!user) return
    let cancelled = false
    getLinkedParents(user.id).then((list) => {
      if (!cancelled) setParents(list)
    })
    return () => {
      cancelled = true
    }
  }, [user])

  async function handleGenerate() {
    if (!user) return
    setGenerating(true)
    setCopied(false)
    try {
      const entry = await generateStudentLinkCode(user.id, user.name)
      setCode(entry)
    } finally {
      setGenerating(false)
    }
  }

  async function handleCopy() {
    if (!code) return
    try {
      await navigator.clipboard.writeText(code.code)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // ignore — clipboard access can fail silently, code is still visible on screen
    }
  }

  if (!user || parents === null) return null

  const isLinked = parents.length > 0

  return (
    <section className="overflow-hidden rounded-2xl border border-border bg-card">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center gap-2.5 px-5 py-3.5 text-left transition-colors hover:bg-muted/40"
      >
        <Users className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
        <div className="min-w-0 flex-1">
          <h2 className="text-sm font-semibold text-foreground">Konto rodzica</h2>
          <p className="truncate text-[11px] text-muted-foreground">
            {isLinked
              ? `Połączone · ${parents.map((p) => p.name).join(', ')}`
              : 'Niepołączone — wygeneruj kod dla rodzica'}
          </p>
        </div>
        {!isLinked && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-warning" aria-hidden="true" />}
        <ChevronDown
          className={cn('h-4 w-4 shrink-0 text-muted-foreground transition-transform', open && 'rotate-180')}
          aria-hidden="true"
        />
      </button>

      {open && (
        <div className="border-t border-border px-5 py-4">
          {isLinked ? (
            <div className="flex flex-col gap-2">
              <p className="text-xs text-muted-foreground">Twoje konto jest połączone z:</p>
              {parents.map((parent) => (
                <div key={parent.id} className="flex items-center gap-2 rounded-lg bg-muted px-3 py-2">
                  <Avatar className="h-6 w-6">
                    <AvatarFallback color={parent.avatarColor} className="text-[10px]">
                      {parent.initials}
                    </AvatarFallback>
                  </Avatar>
                  <span className="truncate text-xs font-medium text-foreground">{parent.name}</span>
                </div>
              ))}
            </div>
          ) : (
            <>
              <p className="text-xs leading-relaxed text-muted-foreground">
                Wygeneruj kod, aby rodzic mógł połączyć swoje konto z Twoim — będzie mógł rezerwować i opłacać lekcje oraz potwierdzać raporty.
              </p>
              {code ? (
                <div className="mt-3 flex flex-col gap-2">
                  <div className="flex items-center justify-between rounded-lg border border-dashed border-primary/50 bg-accent px-3 py-2.5">
                    <span className="font-mono text-lg font-bold tracking-[0.2em] text-accent-foreground">{code.code}</span>
                    <Button size="sm" variant="ghost" className="h-7 px-2" onClick={handleCopy}>
                      {copied ? <Check className="h-3.5 w-3.5" aria-hidden="true" /> : <Copy className="h-3.5 w-3.5" aria-hidden="true" />}
                    </Button>
                  </div>
                  <p className="text-[11px] text-muted-foreground">Kod jest ważny 24h i jednorazowy.</p>
                  <Button size="sm" variant="outline" className="h-7 self-start text-xs" onClick={handleGenerate} disabled={generating}>
                    {generating ? <Loader2 className="mr-1 h-3 w-3 animate-spin" aria-hidden="true" /> : <RefreshCw className="mr-1 h-3 w-3" aria-hidden="true" />}
                    Wygeneruj nowy
                  </Button>
                </div>
              ) : (
                <Button size="sm" className="mt-3 h-8 font-semibold" onClick={handleGenerate} disabled={generating}>
                  {generating ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" aria-hidden="true" /> : null}
                  Wygeneruj kod
                </Button>
              )}
            </>
          )}
        </div>
      )}
    </section>
  )
}
