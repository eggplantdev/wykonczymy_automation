'use client'

import { ArrowLeft } from 'lucide-react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Button } from '@/components/ui/button'

// Needs the live pathname to derive the back target, so it's the one island of TopNav that must be
// client. On a kosztorys page the back target is the same path without the trailing /kosztorys
// segment, i.e. the investment detail page; elsewhere there's no back button.
export function NavBackButton() {
  const pathname = usePathname()
  const investmentHref = pathname.endsWith('/kosztorys')
    ? pathname.slice(0, -'/kosztorys'.length)
    : undefined

  if (!investmentHref) return null

  return (
    <Button variant="outline" size="sm" asChild>
      <Link href={investmentHref}>
        <ArrowLeft />
        Wróć do inwestycji
      </Link>
    </Button>
  )
}
