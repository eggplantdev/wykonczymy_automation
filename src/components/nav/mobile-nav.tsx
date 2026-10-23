'use client'

import { Menu } from 'lucide-react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'

import { BrandLogo } from '@/components/ui/brand-logo'
import { RoleBadge } from '@/components/users/role-badge'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from '@/components/ui/sheet'
import { ThemeToggle } from '@/components/nav/theme-toggle'
import { UiScaleSwitch } from '@/components/nav/ui-scale-switch'
import { LogoutButton } from '@/components/nav/logout-button'
import { NavLinkItem } from '@/components/nav/nav-link-item'
import { NavNameLink } from '@/components/nav/nav-name-link'
import { RefreshDataButton } from '@/components/nav/refresh-data-button'
import { AdminButton } from '@/components/nav/admin-button'
import { CompanyKnowledgeTrigger } from '@/components/company-knowledge/company-knowledge-button'
import { CompanyKnowledgeDialog } from '@/components/company-knowledge/company-knowledge-dialog'
import { TrashButton } from '@/components/nav/trash-button'
import { PushToggle } from '@/components/pwa/push-toggle'
import { useCompanyKnowledgeBook } from '@/hooks/use-company-knowledge-book'
import { useCurrentUser } from '@/hooks/use-current-user'
import { useNavLinks } from '@/hooks/use-nav-links'
import { useTranslation } from '@/hooks/use-translation'
import { ROLE_KEYS } from '@/lib/i18n/role-keys'
import { TRASH_HREF } from '@/lib/constants/sections'

// `h-screen` is `100vh`, which Safari resolves to the LARGE viewport, so the whole document slides
// under the open drawer.
function setScrollLocked(locked: boolean) {
  const main = document.querySelector('main')
  if (main) main.style.overflow = locked ? 'hidden' : ''
  document.documentElement.style.overflow = locked ? 'hidden' : ''
}

export function MobileNav() {
  const user = useCurrentUser()
  const { links, isActive } = useNavLinks()
  const { t } = useTranslation('shell')
  const { t: tPage } = useTranslation('workerPage')
  const pathname = usePathname()
  const [open, setOpen] = useState(false)
  const [openedOn, setOpenedOn] = useState<string | null>(null)
  const book = useCompanyKnowledgeBook(() => setOpen(false))

  // Clearing `openedOn` keeps Back from reopening.
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

  useEffect(() => {
    setScrollLocked(open)
  }, [open])

  return (
    <>
      <Sheet open={open} onOpenChange={(next) => (next ? openDrawer() : setOpen(false))}>
        <SheetTrigger asChild>
          <Button variant="ghost" size="iconTouch" className="sm:hidden" aria-label={t('menu')}>
            <Menu />
          </Button>
        </SheetTrigger>
        <SheetContent
          className="sm:hidden"
          overlayClassName="sm:hidden"
          aria-describedby={undefined}
        >
          <SheetTitle className="sr-only">{t('menu')}</SheetTitle>
          <div className="flex shrink-0 items-start gap-3 px-3">
            <Link href="/" className="py-2" onClick={() => closeIfSameRoute('/')}>
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
              <NavNameLink
                href={`/pracownicy/${user.id}`}
                onClick={() => closeIfSameRoute(`/pracownicy/${user.id}`)}
              >
                {user.name}
              </NavNameLink>
              <RoleBadge role={user.role}>{tPage(ROLE_KEYS[user.role])}</RoleBadge>
            </div>
            <UiScaleSwitch />
            <ThemeToggle collapsed={false} />
            <RefreshDataButton />
            <AdminButton />
            <CompanyKnowledgeTrigger onClick={book.openBook} />
            <TrashButton
              active={isActive(TRASH_HREF)}
              onClick={() => closeIfSameRoute(TRASH_HREF)}
            />
            <PushToggle />
            <LogoutButton beforeLogout={() => setScrollLocked(false)} />
          </div>
        </SheetContent>
      </Sheet>
      <CompanyKnowledgeDialog {...book.dialog} />
    </>
  )
}
