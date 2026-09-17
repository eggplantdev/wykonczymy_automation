'use client'

import { Menu, X } from 'lucide-react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'

import { BrandLogo } from '@/components/ui/brand-logo'
import { RoleBadge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ThemeToggle } from '@/components/nav/theme-toggle'
import { LogoutButton } from '@/components/nav/logout-button'
import { NavLinkItem } from '@/components/nav/nav-link-item'
import { RefreshDataButton } from '@/components/nav/refresh-data-button'
import { useCurrentUser } from '@/hooks/use-current-user'
import { useNavLinks } from '@/hooks/use-nav-links'
import { ROLE_LABELS } from '@/lib/auth/roles'
import { cn } from '@/lib/utils/cn'

// Two scrollers, not one. `<main>` is the app's own, and inline style beats a utility class there
// because the element already carries `overflow-y-auto`.
//
// The document is the second, and only on iOS: `h-screen` is `100vh`, which Safari resolves to the
// LARGE viewport, so the shell stands taller than the visible page by the height of the bottom
// toolbar and the whole document slides under the open drawer. `100dvh` on the shell would remove
// that overflow — and with it the scroll that collapses the toolbar, costing that band on every
// screen for the sake of one drawer. Freezing it while the drawer is open keeps both.
function setScrollLocked(locked: boolean) {
  const main = document.querySelector('main')
  if (main) main.style.overflow = locked ? 'hidden' : ''
  document.documentElement.style.overflow = locked ? 'hidden' : ''
}

export function MobileNav() {
  const user = useCurrentUser()
  const { links, isActive } = useNavLinks()
  const pathname = usePathname()
  const [open, setOpen] = useState(false)
  const [openedOn, setOpenedOn] = useState<string | null>(null)

  // Closes when the navigation COMMITS, not on tap: these links are never prefetched, so an onClick
  // close left a blank wait that read as a dead tap. Clearing `openedOn` keeps Back from reopening.
  if (open && openedOn !== pathname) {
    setOpen(false)
    setOpenedOn(null)
  }

  const openDrawer = () => {
    setOpen(true)
    setOpenedOn(pathname)
  }

  // The route you are already on commits no navigation, so the branch above never fires.
  const closeIfSameRoute = (href: string) => {
    if (href === pathname) setOpen(false)
  }

  // The drawer also closes without a handler — on a committed navigation, or on Back.
  useEffect(() => {
    setScrollLocked(open)
  }, [open])

  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        className="size-11 sm:hidden"
        aria-label="Menu"
        aria-expanded={open}
        aria-controls="mobile-nav"
        onClick={openDrawer}
      >
        <Menu className="size-7" />
      </Button>

      {/* `visibility` stays `visible` for the whole leave transition, so the slide-out plays out
          before the drawer leaves the tab order. Tailwind v4 compiles `-translate-x-full` to the
          `translate` property, so the transition has to name it. `dvh`, not `lvh`: a fixed element
          can be painted `lvh` tall but iOS still only SHOWS the small viewport, so the bottom band
          lands under the floating toolbar — unreachable. `dvh` grows back to `lvh` on its own once
          the toolbar retracts. */}
      <nav
        id="mobile-nav"
        className={cn(
          'bg-background fixed inset-x-0 top-0 z-10002 flex h-dvh flex-col overflow-y-auto overscroll-contain transition-[translate,visibility] duration-300 ease-out sm:hidden',
          open ? 'translate-x-0' : 'pointer-events-none invisible -translate-x-full',
        )}
      >
        <div className="flex shrink-0 items-start gap-3 px-3">
          {/* Own box, so the X stays centred on the hamburger however tall the logo beside it grows. */}
          <div className="flex h-14 items-center">
            <Button
              variant="ghost"
              size="icon"
              className="size-11"
              aria-label="Zamknij"
              onClick={() => setOpen(false)}
            >
              <X className="size-7" />
            </Button>
          </div>
          <Link href="/" className="ml-auto py-2" onClick={() => closeIfSameRoute('/')}>
            <BrandLogo height={48} priority />
          </Link>
        </div>

        <div className="flex flex-col gap-1 px-3 pt-2">
          {links.map((link) => (
            <NavLinkItem
              key={link.href}
              link={link}
              active={isActive(link.href)}
              onNavigate={() => closeIfSameRoute(link.href)}
            />
          ))}
        </div>

        <div className="mt-auto flex flex-col gap-2 px-3 pt-12 pb-4">
          <div className="flex items-center gap-2">
            <span className="text-foreground text-sm font-medium">{user.name}</span>
            <RoleBadge role={user.role}>{ROLE_LABELS[user.role].pl}</RoleBadge>
          </div>
          <ThemeToggle collapsed={false} />
          <RefreshDataButton />
          <LogoutButton beforeLogout={() => setScrollLocked(false)} />
        </div>
      </nav>
    </>
  )
}
