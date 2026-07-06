import '@/styles/globals.css'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Wykończymy — Informacje prawne',
  robots: { index: false, follow: false },
}

export default function LegalLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pl" suppressHydrationWarning>
      <body className="mx-auto max-w-2xl px-6 py-16 leading-relaxed">{children}</body>
    </html>
  )
}
