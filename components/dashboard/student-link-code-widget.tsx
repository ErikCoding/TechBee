'use client'

import { useEffect, useState } from 'react'
import { Users, Copy, Check, RefreshCw, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/lib/auth-context'
import { generateStudentLinkCode, getLinkedParents, type LinkedPersonSummary } from '@/services/family-link.service'
import type { StudentLinkCode } from '@/lib/types'

/**
 * Lets a student generate a single-use code so a parent can link their
 * account as a supervising "konto rodzica" (see services/family-link.service.ts
 * and techbee-blueprint.md §3). Shows already-linked parents instead, once any exist.
 */
export function StudentLinkCodeWidget() {
  const { user } = useAuth()
  const [parents, setParents] = useState<LinkedPersonSummary[] | null>(null)
  const [code, setCode] = useState<StudentLinkCode | null>(null)
  const [generating, setGenerating] = useState(false)
  const [copied, setCopied] = useState(false)

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

  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <div className="flex items-center gap-2">
        <Users className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
        <h3 className="text-sm font-semibold text-foreground">Konto rodzica</h3>
      </div>

      {parents.length > 0 ? (
        <div className="mt-3 flex flex-col gap-2">
          <p className="text-xs text-muted-foreground">Twoje konto jest połączone z:</p>
          {parents.map((parent) => (
            <div key={parent.id} className="flex items-center gap-2 rounded-lg bg-muted px-3 py-2">
              <div
                className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white"
                style={{ backgroundColor: parent.avatarColor }}
                aria-hidden="true"
              >
                {parent.initials}
              </div>
              <span className="truncate text-xs font-medium text-foreground">{parent.name}</span>
            </div>
          ))}
        </div>
      ) : (
        <>
          <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
            Wygeneruj kod, aby rodzic mógł połączyć swoje konto z Twoim — będzie mógł rezerwować i opłacać lekcje oraz potwierdzać raporty.
          </p>
          {code ? (
            <div className="mt-3 flex flex-col gap-2">
              <div className="flex items-center justify-between rounded-lg border border-dashed border-[#F4B400]/50 bg-[#FEF3C7] px-3 py-2.5 dark:bg-[#3B2800]">
                <span className="font-mono text-lg font-bold tracking-[0.2em] text-[#78350F] dark:text-[#FBBF24]">{code.code}</span>
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
            <Button size="sm" className="mt-3 h-8 bg-[#F4B400] text-[#0A0A0A] hover:bg-[#FBBF24] font-semibold" onClick={handleGenerate} disabled={generating}>
              {generating ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" aria-hidden="true" /> : null}
              Wygeneruj kod
            </Button>
          )}
        </>
      )}
    </div>
  )
}
