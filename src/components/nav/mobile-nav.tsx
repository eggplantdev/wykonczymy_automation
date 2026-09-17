'use client'

import { Menu, X } from 'lucide-react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Portal } from 'radix-ui'
import { useEffect, useState } from 'react'

import { BrandLogo } from '@/components/ui/brand-logo'
import { RoleBadge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ThemeToggle } from '@/components/nav/theme-toggle'
import { LogoutButton } from '@/components/nav/logout-button'
import { NavLinkItem } from '@/components/nav/nav-link-item'
import { useCurrentUser } from '@/hooks/use-current-user'
import { useNavLinks } from '@/hooks/use-nav-links'
import { ROLE_LABELS } from '@/lib/auth/roles'
import { cn } from '@/lib/utils/cn'

// Without this the page keeps scrolling under the open drawer.
// The lock lands on `<main>`, not on html/body: the shell is `h-screen` with the scroll on that
// inner element, so the document never scrolls and freezing it freezes nothing. Written as an inline
// style rather than a utility class because the element already carries `overflow-y-auto` — which of
// the two wins would come down to their order in the generated stylesheet.
function setScrollLocked(locked: boolean) {
  const main = document.querySelector('main')
  if (main) main.style.overflow = locked ? 'hidden' : ''
}

export function MobileNav() {
  const user = useCurrentUser()
  const { links, isActive } = useNavLinks()
  const pathname = usePathname()
  const [open, setOpen] = useState(false)
  const [openedOn, setOpenedOn] = useState<string | null>(null)

  // The drawer closes when the navigation COMMITS, not when the tap lands. Closing it from the
  // link's own onClick hid it instantly — on a cold start that is seconds before the page arrives,
  // and these links are never prefetched (the panel sits off-viewport, so Next's observer never
  // sees them), so there is no `loading.tsx` shell to cover the wait either. The tap read as doing
  // nothing at all. Not a plain `openedOn === pathname`, which would spring the drawer back open on
  // Back: this consumes the route it opened on, so it fires once.
  if (open && openedOn !== pathname) {
    setOpen(false)
    setOpenedOn(null)
  }

  const openDrawer = () => {
    setOpen(true)
    setOpenedOn(pathname)
  }

  // Tapping the route you are already on commits no navigation, so the branch above never fires and
  // the drawer would hang open with nothing to explain it.
  const closeIfSameRoute = (href: string) => {
    if (href === pathname) setOpen(false)
  }

  // The lock is a write on an element this component does not own, so it trails `open` rather than
  // riding the handlers — the drawer now also closes without one (a committed navigation, Back).
  useEffect(() => {
    setScrollLocked(open)
  }, [open])

  return (
    <>
      {/* Geometry kept in lockstep with the X in the panel: same size-11 box, same size-7 glyph,
          both centred in an h-14 row — the button must not appear to move or resize when the
          drawer opens over it. */}
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

      {/* Not a Dialog: this is a panel that is always there and slides, not content that exists only
          while open. Radix unmounts a closed dialog, which remounted the unread-count badges on
          every open — and a full-screen drawer has no outside to dim, click away or scroll behind,
          which is all the dialog bought. `visibility` transitions discretely but holds `visible` for
          the whole duration when leaving, so the slide-out plays before it leaves the tab order.
          Transitioning `translate`, not `transform`: Tailwind v4 compiles `-translate-x-full` to the
          standalone `translate` property, so naming `transform` here animates nothing.
          Sized to the LARGE viewport, not anchored by `inset-0`: iOS Safari resolves a fixed
          element's bottom edge to the small viewport, so the page shows through the strip behind the
          floating toolbar. Over-covering into that strip is the only thing that closes it.
          Portalled to `<body>` so that z means something: the trigger sits inside TopNav's sticky
          header, and `position: sticky` creates a stacking context whatever its z-index — so left in
          place the drawer's 10002 was resolved against its siblings INSIDE the header, and the whole
          header still met the env badge (10000) and the toasts (10001) at 40. Both painted over the
          open drawer, on top of „Wyloguj". */}
      <Portal.Root asChild>
        <nav
          id="mobile-nav"
          className={cn(
            'bg-background fixed inset-x-0 top-0 z-10002 flex h-lvh flex-col overflow-y-auto overscroll-contain transition-[translate,visibility] duration-300 ease-out sm:hidden',
            open ? 'translate-x-0' : 'pointer-events-none invisible -translate-x-full',
          )}
        >
          <div className="flex shrink-0 items-start gap-3 px-3">
            {/* The X rides its own h-14 box, not the row's height — the TopNav row this covers is
              h-14, so the button stays centred on the hamburger it replaces however tall the logo
              beside it grows. */}
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

          <div className="flex flex-col gap-1 px-3 pt-4">
            {links.map((link) => (
              <NavLinkItem
                key={link.href}
                link={link}
                active={isActive(link.href)}
                onNavigate={() => closeIfSameRoute(link.href)}
              />
            ))}
          </div>

          {/* The tail of the panel is behind iOS's toolbar, and `100lvh - 100dvh` IS that toolbar's
            height — without the clearance „Wyloguj" lands under it. Zero wherever chrome doesn't
            collapse, so this is plain `pb-3` on desktop. */}
          <div className="mt-auto flex flex-col gap-2 px-3 pt-4 pb-[calc(100lvh-100dvh+0.75rem)]">
            <div className="flex items-center gap-2">
              <span className="text-foreground text-sm font-medium">{user.name}</span>
              <RoleBadge role={user.role}>{ROLE_LABELS[user.role].pl}</RoleBadge>
            </div>
            <ThemeToggle collapsed={false} />
            {/* The one exit that never closes the drawer: the redirect tears the shell down around
                the lock. Releasing it here keeps the lock's correctness off the question of whether
                `<main>` happens to be remounted. */}
            <LogoutButton beforeLogout={() => setScrollLocked(false)} />
          </div>
        </nav>
      </Portal.Root>
    </>
  )
}
