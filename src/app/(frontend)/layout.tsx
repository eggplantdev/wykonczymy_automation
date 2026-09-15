import '@/styles/globals.css'
// Build gate: importing both env entries here runs their schema parse during `next build`
// (every route renders through this layout), so a missing/invalid var fails the build.
import '@/lib/env'
import '@/lib/env/server'
import React, { Suspense } from 'react'
import { redirect } from 'next/navigation'
import { spaceMono } from '@/fonts'
import { cn } from '@/lib/utils/cn'
import { ToastContainer } from 'react-toastify'
import { ThemeProvider } from 'next-themes'
import { getCurrentUserJwt } from '@/lib/auth/get-current-user-jwt'
import { Navigation } from '@/components/nav/navigation'
import { Sidebar } from '@/components/nav/sidebar'
import { NavOpenRouterBalance } from '@/components/nav/nav-openrouter-balance'
import { AppFooter } from '@/components/nav/app-footer'
import { CurrentUserProvider } from '@/hooks/use-current-user'
import { Loader } from '@/components/ui/loader/loader'
import { EnvBadge } from '@/components/ui/env-badge'
import { PendingSubmitIndicator } from '@/components/ui/pending-submit-indicator'

type FrontendLayoutPropsT = {
  children: React.ReactNode
  // Parallel route slot: the only way the top bar can know which investment it's on, since this
  // layout has no params of its own. See src/app/(frontend)/@investmentCrumb.
  investmentCrumb: React.ReactNode
}

export default function FrontendLayout({ children, investmentCrumb }: FrontendLayoutPropsT) {
  return (
    <html
      lang="pl"
      className={cn(spaceMono.variable, 'overscroll-none antialiased')}
      suppressHydrationWarning
    >
      <body className="bg-background text-foreground relative min-h-screen scroll-smooth">
        <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false}>
          <Suspense fallback={<Loader loading={true} />}>
            <AuthenticatedShell investmentCrumb={investmentCrumb}>{children}</AuthenticatedShell>
          </Suspense>
          <ToastContainer style={{ zIndex: 10001 }} />
          <PendingSubmitIndicator />
          <EnvBadge />
        </ThemeProvider>
      </body>
    </html>
  )
}

async function AuthenticatedShell({ children, investmentCrumb }: FrontendLayoutPropsT) {
  const user = await getCurrentUserJwt()
  if (!user) redirect('/zaloguj')

  return (
    <CurrentUserProvider user={user}>
      <div className="flex h-screen">
        <Sidebar
          openRouterBalance={
            <Suspense fallback={null}>
              <NavOpenRouterBalance />
            </Suspense>
          }
        />
        {/* min-w-0: a flex item's default `min-width: auto` refuses to shrink below its content's
            min-content width, so one wide child (the kosztorys grid) widened this whole column past
            the viewport and took the sticky top bar with it — the page body scrolled sideways. */}
        <div className="flex min-w-0 flex-1 flex-col">
          <Navigation user={user} investmentCrumb={investmentCrumb} />
          {/* transform-gpu forces a compositing layer: Safari otherwise fails to
              repaint content streamed into this overflow scroll container after
              the initial paint (blank until you scroll / move the cursor). */}
          <main className="flex min-h-0 flex-1 transform-gpu flex-col overflow-y-auto">
            {children}
          </main>
          <AppFooter />
        </div>
      </div>
    </CurrentUserProvider>
  )
}
