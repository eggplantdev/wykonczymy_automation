import '@/styles/globals.css'
import React from 'react'
import { redirect } from 'next/navigation'
import { abcFavorit, spaceMono } from '@/fonts'
import { cn } from '@/lib/cn'
import { getCurrentUserJwt } from '@/lib/auth/get-current-user-jwt'

export default async function AuthLayout({ children }: { children: React.ReactNode }) {
  console.log('[AUTH_LAYOUT] rendering')
  let user
  try {
    user = await getCurrentUserJwt()
    console.log('[AUTH_LAYOUT] getCurrentUserJwt:', user ? 'has user' : 'no user')
  } catch (err) {
    console.error('[AUTH_LAYOUT] getCurrentUserJwt THREW:', err)
    user = undefined
  }
  if (user) redirect('/')
  return (
    <html
      lang="pl"
      className={cn(abcFavorit.variable, spaceMono.variable, 'antialiased')}
      suppressHydrationWarning
    >
      <body className="bg-background text-foreground relative overscroll-none scroll-smooth">
        <main className="flex min-h-screen items-center justify-center">{children}</main>
      </body>
    </html>
  )
}
