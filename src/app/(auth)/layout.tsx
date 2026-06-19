import '@/styles/globals.css'
import React from 'react'
import { redirect } from 'next/navigation'
import { abcFavorit, spaceMono } from '@/fonts'
import { cn } from '@/lib/cn'
import { getCurrentUserJwt } from '@/lib/auth/get-current-user-jwt'

export default async function AuthLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUserJwt()
  if (user) redirect('/')
  return (
    <html
      lang="pl"
      className={cn(
        abcFavorit.variable,
        spaceMono.variable,
        'antialiased',
        // Non-prod (local/preview) renders dark so it's impossible to mistake for prod.
        // process.env.NODE_ENV !== 'production' && 'dark',
      )}
      suppressHydrationWarning
    >
      <body className="bg-background text-foreground relative overscroll-none scroll-smooth">
        <main className="flex min-h-screen items-center justify-center">{children}</main>
      </body>
    </html>
  )
}
