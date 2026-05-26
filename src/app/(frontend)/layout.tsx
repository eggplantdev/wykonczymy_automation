import '@/styles/globals.css'
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

export default function FrontendLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="pl"
      className={cn(abcFavorit.variable, spaceMono.variable, 'overscroll-none antialiased')}
      suppressHydrationWarning
    >
      <body className="bg-background text-foreground relative min-h-screen scroll-smooth">
        <Suspense fallback={<Loader loading={true} />}>
          <AuthenticatedShell>{children}</AuthenticatedShell>
        </Suspense>
        <ToastContainer style={{ zIndex: 10001 }} />
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
          <main className="min-h-0 flex-1 overflow-y-auto">{children}</main>
          <AppFooter />
        </div>
      </div>
    </CurrentUserProvider>
  )
}
