import '@/styles/globals.css'
import React from 'react'
import { redirect } from 'next/navigation'
import { spaceMono } from '@/fonts'
import { cn } from '@/lib/utils/cn'
import { getCurrentUserJwt } from '@/lib/auth/get-current-user-jwt'
import { ThemeProvider } from 'next-themes'

export default async function AuthLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUserJwt()
  if (user) redirect('/')
  return (
    <html lang="pl" className={cn(spaceMono.variable, 'antialiased')} suppressHydrationWarning>
      <body className="bg-background text-foreground relative overscroll-none scroll-smooth">
        <ThemeProvider attribute="class" defaultTheme="light" enableSystem={true}>
          <main className="flex min-h-screen items-center justify-center">{children}</main>
        </ThemeProvider>
      </body>
    </html>
  )
}
