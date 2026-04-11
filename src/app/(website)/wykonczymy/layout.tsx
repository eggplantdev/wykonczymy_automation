import '@/styles/globals.css'
import './wykonczymy.css'
import { Geist } from 'next/font/google'
import { Playfair_Display } from 'next/font/google'
import type { Metadata } from 'next'

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
})

const playfair = Playfair_Display({
  variable: '--font-playfair',
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  style: ['normal', 'italic'],
})

export const metadata: Metadata = {
  title: 'Wykończymy — Profesjonalne remonty i wykończenia',
  description:
    'Kompleksowe remonty domów, mieszkań i biur w Warszawie. Profesjonalne wykończenia na każdą kieszeń.',
}

export default function WykonczymyLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="pl"
      className={`${geistSans.variable} ${playfair.variable} antialiased`}
      suppressHydrationWarning
    >
      <body className="wykonczymy-page">{children}</body>
    </html>
  )
}
