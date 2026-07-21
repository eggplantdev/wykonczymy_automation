import '@/styles/globals.css'
import type { Metadata } from 'next'
import { cn } from '@/lib/utils/cn'
import { abcFavorit, spaceMono } from '@/fonts'

// A route group with no auth check: the token in the URL is the whole credential, so this layout
// deliberately does NOT read the session the way (frontend)/layout.tsx does. `noindex` keeps a
// shared link out of search results — a client forwards it, a crawler must not follow it.
export const metadata: Metadata = {
  title: 'Kosztorys',
  robots: { index: false, follow: false },
}

export default function ShareLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="pl"
      className={cn(abcFavorit.variable, spaceMono.variable, 'overscroll-none antialiased')}
      suppressHydrationWarning
    >
      <body className="bg-background text-foreground relative min-h-screen">{children}</body>
    </html>
  )
}
