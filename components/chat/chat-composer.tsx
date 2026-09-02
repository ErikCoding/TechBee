'use client'

import { useRef } from 'react'
import { Send, Paperclip } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { ChatMessage } from '@/lib/types'

interface Props {
  value: string
  onChange: (value: string) => void
  onSend: () => void
  onAttach: (attachment: NonNullable<ChatMessage['attachment']>) => void
  disabled?: boolean
}

/**
 * The composer.
 *
 * Auto-grows from one line to a few as the message gets longer instead
 * of being a fixed single-line input, and Enter sends while Shift+Enter
 * breaks the line — both expected in a messaging surface and neither
 * previously supported. Send stays disabled until there is something to
 * send, so the primary action never lies about being available.
 *
 * Attachment handling matches the previous behaviour exactly: the file
 * is classified by extension and dispatched through the same
 * `sendMessage` attachment payload.
 */
export function ChatComposer({ value, onChange, onSend, onAttach, disabled }: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  function autoGrow(el: HTMLTextAreaElement) {
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, 120)}px`
  }

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const ext = file.name.split('.').pop()?.toLowerCase() ?? ''
    const kind: NonNullable<ChatMessage['attachment']>['kind'] =
      ['png', 'jpg', 'jpeg', 'gif', 'webp'].includes(ext) ? 'image' :
      ext === 'pdf' ? 'pdf' :
      ext === 'zip' ? 'zip' : 'doc'
    onAttach({ name: file.name, size: `${(file.size / 1024).toFixed(0)} KB`, kind })
    e.target.value = ''
  }

  function submit() {
    onSend()
    const el = textareaRef.current
    if (el) {
      el.style.height = 'auto'
      el.focus()
    }
  }

  return (
    <form
      onSubmit={(e) => { e.preventDefault(); submit() }}
      className="shrink-0 border-t border-border bg-card p-2.5 sm:p-3"
    >
      <div className="flex items-end gap-1.5 rounded-2xl border border-border bg-background p-1.5 focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/25">
        <input ref={fileInputRef} type="file" className="hidden" onChange={handleFile} />
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-9 w-9 shrink-0 rounded-xl"
          onClick={() => fileInputRef.current?.click()}
          disabled={disabled}
          aria-label="Dodaj załącznik"
        >
          <Paperclip className="h-4 w-4" aria-hidden="true" />
        </Button>

        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => { onChange(e.target.value); autoGrow(e.target) }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              submit()
            }
          }}
          rows={1}
          placeholder="Napisz wiadomość…"
          aria-label="Treść wiadomości"
          disabled={disabled}
          className="max-h-[120px] min-h-9 flex-1 resize-none bg-transparent py-2 text-sm text-foreground outline-none placeholder:text-muted-foreground disabled:opacity-60"
        />

        <Button
          type="submit"
          size="icon"
          className="h-9 w-9 shrink-0 rounded-xl transition-transform hover:scale-105 disabled:hover:scale-100"
          disabled={disabled || !value.trim()}
          aria-label="Wyślij wiadomość"
        >
          <Send className="h-4 w-4" aria-hidden="true" />
        </Button>
      </div>
      <p className="mt-1.5 hidden px-1 text-[10px] text-muted-foreground md:block">
        Enter wysyła · Shift + Enter nowa linia
      </p>
    </form>
  )
}
