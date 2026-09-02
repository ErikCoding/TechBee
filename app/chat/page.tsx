import { Suspense } from 'react'
import { Navbar } from '@/components/layout/navbar'
import { Footer } from '@/components/layout/footer'
import { ChatClient } from '@/components/chat/chat-client'
import { RequireAuth } from '@/components/auth/require-auth'
import { BackButton } from '@/components/shared/back-button'
import { Skeleton } from '@/components/ui/skeleton'

/**
 * On mobile the chat is the screen: the page chrome (back link, heading,
 * subtitle, footer) is hidden so the thread can own the full viewport
 * with a pinned composer, the way a messaging app behaves. From `md` up
 * the chrome returns and the client renders as a workspace panel.
 */
export default function ChatPage() {
  return (
    <>
      <Navbar />
      <main id="main-content" className="bg-background">
        <RequireAuth>
          <div className="mx-auto max-w-6xl md:px-8 md:py-6">
            <div className="hidden md:block">
              <BackButton />
              <h1 className="text-2xl font-bold text-foreground">Wiadomości</h1>
              <p className="mt-0.5 text-muted-foreground">Rozmawiaj z nauczycielami przed lekcją i po niej</p>
            </div>
            <div className="md:mt-5">
              <Suspense
                fallback={
                  <Skeleton className="h-[calc(100dvh-4rem)] rounded-none md:h-[calc(100vh-13rem)] md:min-h-[540px] md:rounded-2xl" />
                }
              >
                <ChatClient />
              </Suspense>
            </div>
          </div>
        </RequireAuth>
      </main>
      <div className="hidden md:block">
        <Footer />
      </div>
    </>
  )
}
