import type { Metadata } from 'next'
import { Mail, MapPin, Clock } from 'lucide-react'
import { Navbar } from '@/components/layout/navbar'
import { Footer } from '@/components/layout/footer'
import { ContactForm } from '@/components/contact/contact-form'

export const metadata: Metadata = { title: 'Kontakt' }

const contactInfo = [
  { icon: Mail, label: 'E-mail', value: 'kontakt@techbee.pl' },
  { icon: MapPin, label: 'Siedziba', value: 'Warszawa, Polska' },
  { icon: Clock, label: 'Czas odpowiedzi', value: 'Zwykle w ciągu 1 dnia roboczego' },
]

export default function ContactPage() {
  return (
    <>
      <Navbar />
      <main id="main-content" className="bg-background">
        <div className="mx-auto max-w-4xl px-4 py-14 md:px-8 md:py-20">
          <div className="text-center">
            <p className="text-sm font-semibold text-[#F4B400] uppercase tracking-wide">Kontakt</p>
            <h1 className="mt-2 text-3xl font-bold tracking-tight text-foreground md:text-4xl">Napisz do nas</h1>
            <p className="mt-2 text-muted-foreground">Masz pytanie o platformę, współpracę albo coś poszło nie tak? Chętnie pomożemy.</p>
          </div>

          <div className="mt-10 grid gap-8 md:grid-cols-[1fr_1.4fr]">
            <div className="flex flex-col gap-4">
              {contactInfo.map((info) => {
                const Icon = info.icon
                return (
                  <div key={info.label} className="flex items-start gap-3 rounded-2xl border border-border bg-card p-5">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#FEF3C7] dark:bg-[#3B2800]">
                      <Icon className="h-4 w-4 text-[#B45309] dark:text-[#FBBF24]" aria-hidden="true" />
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">{info.label}</p>
                      <p className="text-sm font-medium text-foreground">{info.value}</p>
                    </div>
                  </div>
                )
              })}
            </div>
            <ContactForm />
          </div>
        </div>
      </main>
      <Footer />
    </>
  )
}
