'use client'

import { useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Reveal } from '@/components/shared/reveal'
import type { FaqItem } from '@/lib/types'

interface FaqSectionProps {
  items: FaqItem[]
}

export function FaqSection({ items }: FaqSectionProps) {
  const [openIndex, setOpenIndex] = useState<number | null>(0)

  return (
    <section className="section-pad bg-background" id="faq" aria-labelledby="faq-heading">
      <div className="mx-auto max-w-3xl px-4 md:px-8">
        {/* Header */}
        <Reveal className="text-center">
          <p className="text-sm font-semibold text-[#F4B400] uppercase tracking-wide">FAQ</p>
          <h2
            id="faq-heading"
            className="mt-1 text-3xl font-bold tracking-tight text-foreground text-balance"
          >
            Najczęstsze pytania
          </h2>
          <p className="mt-2 text-muted-foreground text-balance">
            Wszystko, co warto wiedzieć o TechBee. Nie widzisz odpowiedzi?{' '}
            <a href="/contact" className="text-foreground underline underline-offset-4 hover:text-[#F4B400] transition-colors">
              Skontaktuj się z nami.
            </a>
          </p>
        </Reveal>

        {/* Accordion */}
        <Reveal delay={100} className="mt-10 flex flex-col divide-y divide-border rounded-2xl border border-border overflow-hidden">
          {items.map((item, index) => (
            <div key={index}>
              <button
                type="button"
                aria-expanded={openIndex === index}
                aria-controls={`faq-answer-${index}`}
                id={`faq-question-${index}`}
                onClick={() => setOpenIndex(openIndex === index ? null : index)}
                className="flex w-full items-center justify-between gap-4 px-6 py-4 text-left transition-colors hover:bg-muted/50"
              >
                <span className="text-sm font-semibold text-foreground">{item.question}</span>
                <ChevronDown
                  className={cn(
                    'h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200',
                    openIndex === index && 'rotate-180',
                  )}
                  aria-hidden="true"
                />
              </button>
              <div
                id={`faq-answer-${index}`}
                role="region"
                aria-labelledby={`faq-question-${index}`}
                className={cn(
                  'overflow-hidden transition-all duration-200',
                  openIndex === index ? 'max-h-96' : 'max-h-0',
                )}
              >
                <p className="px-6 pb-5 pt-0 text-sm leading-relaxed text-muted-foreground">
                  {item.answer}
                </p>
              </div>
            </div>
          ))}
        </Reveal>
      </div>
    </section>
  )
}
