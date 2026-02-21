import '@/styles/globals.css'
import React from 'react'
import { abcFavorit, spaceMono } from '@/fonts'
import { cn } from '@/lib/cn'

export default function AuthLayout({ children }: { children: React.ReactNode }) {
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
