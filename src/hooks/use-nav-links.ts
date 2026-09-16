'use client'

import { usePathname } from 'next/navigation'
import { useCurrentUser } from '@/hooks/use-current-user'
import { isManagementRole } from '@/lib/auth/roles'
import { MANAGEMENT_LINKS, SECTION_LINKS, type NavLinkT } from '@/lib/constants/sections'

// „/" is every path's prefix, so „Transakcje" would light up on every screen — it matches exactly,
// while a section link also claims its sub-pages (`/inwestycje/12` keeps „Inwestycje" lit).
function isActiveLink(pathname: string, href: string): boolean {
  return href === '/' ? pathname === '/' : pathname === href || pathname.startsWith(`${href}/`)
}

export function useNavLinks(): { links: NavLinkT[]; isActive: (href: string) => boolean } {
  const user = useCurrentUser()
  const pathname = usePathname()

  return {
    links: isManagementRole(user.role) ? [...SECTION_LINKS, ...MANAGEMENT_LINKS] : SECTION_LINKS,
    isActive: (href) => isActiveLink(pathname, href),
  }
}
