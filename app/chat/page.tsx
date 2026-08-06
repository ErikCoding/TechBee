import { Suspense } from 'react'
import { Navbar } from '@/components/layout/navbar'
import { Footer } from '@/components/layout/footer'
import { ChatClient } from '@/components/chat/chat-client'
import { RequireAuth } from '@/components/auth/require-auth'
import { BackButton } from '@/components/shared/back-button'

export default function ChatPage() {
  return (
    <>
      <Navbar />
      <main id="main-content" className="bg-background">
        <RequireAuth>
          <div className="mx-auto max-w-6xl px-4 py-6 md:px-8">
            <BackButton />
            <h1 className="text-2xl font-bold text-foreground">Wiadomości</h1>
            <p className="mt-0.5 text-muted-foreground">Rozmawiaj z nauczycielami przed lekcją i po niej</p>
            <div className="mt-5">
              <Suspense fallback={<div className="h-[calc(100vh-220px)] min-h-[520px] animate-pulse rounded-2xl border border-border bg-card" />}>
                <ChatClient />
              </Suspense>
            </div>
          </div>
        </RequireAuth>
      </main>
      <Footer />
    </>
  )
}
