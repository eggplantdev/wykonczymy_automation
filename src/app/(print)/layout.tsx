import '@/styles/globals.css'
import { redirect } from 'next/navigation'
import { abcFavorit, spaceMono } from '@/fonts'
import { cn } from '@/lib/cn'
import { getCurrentUserJwt } from '@/lib/auth/get-current-user-jwt'

export default async function PrintLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUserJwt()
  if (!user) redirect('/zaloguj')

  return (
    <html
      lang="pl"
      className={cn(abcFavorit.variable, spaceMono.variable, 'antialiased')}
      suppressHydrationWarning
    >
      <body className="text-foreground bg-white pt-10 md:pt-0">
        {/* Inline style to bypass Tailwind processing — @page margin:0 removes browser header/footer zone */}
        <style>{`@page { margin: 0; }`}</style>
        {children}
      </body>
    </html>
  )
}
