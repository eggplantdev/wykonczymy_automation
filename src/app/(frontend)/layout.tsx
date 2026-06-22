import '@/styles/globals.css'
// Build gate: importing both env entries here runs their schema parse during `next build`
// (every route renders through this layout), so a missing/invalid var fails the build.
import '@/lib/env'
import '@/lib/env.server'
import React, { Suspense } from 'react'
import { redirect } from 'next/navigation'
import { abcFavorit, spaceMono } from '@/fonts'
import { cn } from '@/lib/cn'
import { ToastContainer } from 'react-toastify'
import { getCurrentUserJwt } from '@/lib/auth/get-current-user-jwt'
import { Navigation } from '@/components/nav/navigation'
import { Sidebar } from '@/components/nav/sidebar'
import { AppFooter } from '@/components/nav/app-footer'
import { CurrentUserProvider } from '@/hooks/use-current-user'
import { Loader } from '@/components/ui/loader/loader'
import { EnvBadge } from '@/components/ui/env-badge'

export default function FrontendLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="pl"
      className={cn(
        abcFavorit.variable,
        spaceMono.variable,
        'overscroll-none antialiased',
        // Non-prod (local/preview) renders dark so it's impossible to mistake for prod.
        // process.env.NODE_ENV !== 'production' && 'dark',
      )}
      suppressHydrationWarning
    >
      <body className="bg-background text-foreground relative min-h-screen scroll-smooth">
        <Suspense fallback={<Loader loading={true} />}>
          <AuthenticatedShell>{children}</AuthenticatedShell>
        </Suspense>
        <ToastContainer style={{ zIndex: 10001 }} />
        <EnvBadge />
      </body>
    </html>
  )
}

async function AuthenticatedShell({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUserJwt()
  if (!user) redirect('/zaloguj')

  return (
    <CurrentUserProvider user={user}>
      <div className="flex h-screen">
        <Sidebar />
        <div className="flex flex-1 flex-col">
          <Navigation user={user} />
          {/* transform-gpu forces a compositing layer: Safari otherwise fails to
              repaint content streamed into this overflow scroll container after
              the initial paint (blank until you scroll / move the cursor). */}
          <main className="min-h-0 flex-1 transform-gpu overflow-y-auto">{children}</main>
          <AppFooter />
        </div>
      </div>
    </CurrentUserProvider>
  )
}
