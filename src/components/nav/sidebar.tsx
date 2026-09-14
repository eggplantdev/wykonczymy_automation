'use client'

import { BrandLogo } from '@/components/ui/brand-logo'
import { Button } from '@/components/ui/button'
import { SimpleTooltip } from '@/components/ui/tooltip'
import { logoutAction } from '@/lib/actions/auth'
import { refreshDataAction } from '@/lib/actions/refresh'
import { isManagementRole } from '@/lib/auth/roles'
import { SECTION_LINKS } from '@/lib/constants/sections'
import { UnreadEquipmentBadge } from '@/components/nav/unread-equipment-badge'
import { UnreadFleetBadge } from '@/components/nav/unread-fleet-badge'
import { cn } from '@/lib/utils/cn'
import { toastMessage } from '@/lib/utils/toast'
import { useCurrentUser } from '@/hooks/use-current-user'
import { useSidebarCollapsed } from '@/hooks/use-sidebar-collapsed'
import {
  Car,
  ChevronLeft,
  ChevronRight,
  FileSpreadsheet,
  ListChecks,
  LogOut,
  RefreshCw,
  Users,
  Wrench,
  type LucideIcon,
} from 'lucide-react'
import Link from 'next/link'
import type { ComponentType } from 'react'
import { useTransition } from 'react'

type SidebarPropsT = {
  openRouterBalance?: React.ReactNode
}

const MANAGEMENT_LINKS: {
  href: string
  label: string
  icon: LucideIcon
  badge?: ComponentType
}[] = [
  { href: '/kosztorysy', label: 'Kosztorysy v1', icon: FileSpreadsheet },
  { href: '/katalog-prac', label: 'Katalog prac', icon: ListChecks },
  { href: '/flota', label: 'Flota', icon: Car, badge: UnreadFleetBadge },
  { href: '/sprzet', label: 'Sprzęt', icon: Wrench, badge: UnreadEquipmentBadge },
  { href: '/pracownicy', label: 'Pracownicy', icon: Users },
]

export function Sidebar({ openRouterBalance }: SidebarPropsT) {
  const user = useCurrentUser()
  const [collapsed, setCollapsed] = useSidebarCollapsed()
  const [isPending, startTransition] = useTransition()
  const [isRefreshing, startRefreshTransition] = useTransition()

  const handleLogout = () => {
    startTransition(() => logoutAction())
  }

  const handleRefresh = () => {
    startRefreshTransition(async () => {
      await refreshDataAction()
      toastMessage('Dane odświeżone')
    })
  }

  const showUsers = isManagementRole(user.role)
  const links = showUsers ? [...SECTION_LINKS, ...MANAGEMENT_LINKS] : SECTION_LINKS

  // Roundcube can't auto-login via URL; _user only prefills the username field on its
  // login page (no-op when a Roundcube session is already active).
  // const roundcubeUrl = `https://www.wykonczymy.com.pl/webmail/?_user=${encodeURIComponent(user.email)}`

  return (
    <aside
      className={cn(
        // z-40: the handle overhangs into the page, and the kosztorys v2 grid paints its frozen
        // columns at z-30 — without a stacking context above that, the pill disappears under them.
        'border-border bg-background sticky top-0 z-40 hidden h-screen shrink-0 flex-col border-r pb-3 lg:flex',
        collapsed ? 'w-14 px-2' : 'w-fit min-w-48 px-3',
      )}
    >
      <SimpleTooltip content={collapsed ? 'Rozwiń menu' : 'Zwiń menu'}>
        <button
          type="button"
          onClick={() => setCollapsed(!collapsed)}
          aria-label={collapsed ? 'Rozwiń menu' : 'Zwiń menu'}
          aria-expanded={!collapsed}
          // Sits astride the divider itself, so the handle reads as "this edge moves" rather than as
          // one more item in the nav list. The hit area is wider than the visible pill.
          className="group absolute inset-y-0 -right-3 z-20 flex w-6 cursor-pointer items-center justify-center"
        >
          <span className="border-border bg-muted text-muted-foreground group-hover:border-primary group-hover:bg-primary group-hover:text-primary-foreground flex h-16 w-4 items-center justify-center rounded-full border transition-all group-hover:h-24">
            {collapsed ? <ChevronRight className="size-3" /> : <ChevronLeft className="size-3" />}
          </span>
        </button>
      </SimpleTooltip>
      <Link href="/" className="mx-auto flex items-center py-3">
        <BrandLogo height={collapsed ? 36 : 54} priority />
      </Link>
      {/* Navigation */}
      <nav className="flex flex-col gap-1">
        {links.map((link) => (
          <CollapsibleTooltip key={link.href} collapsed={collapsed} label={link.label}>
            <Button
              variant="ghost"
              size="sm"
              align={collapsed ? 'center' : 'start'}
              className={cn('relative', collapsed && 'px-0')}
              asChild
            >
              <Link href={link.href}>
                <link.icon />
                {!collapsed && link.label}
                {link.badge && (
                  <BadgeSlot collapsed={collapsed}>
                    <link.badge />
                  </BadgeSlot>
                )}
              </Link>
            </Button>
          </CollapsibleTooltip>
        ))}
      </nav>
      {/* User info + actions */}
      <div className="mt-auto flex flex-col gap-2 pt-4">
        {!collapsed && <div className="text-foreground text-sm font-medium">{user.name}</div>}
        <div className="flex flex-col gap-2">
          <CollapsibleTooltip collapsed={collapsed} label="Odśwież dane">
            <Button
              variant="outline"
              size="sm"
              className={cn(collapsed && 'px-0')}
              onClick={handleRefresh}
              disabled={isRefreshing}
              aria-label="Odśwież dane"
            >
              <RefreshCw className={isRefreshing ? 'animate-spin' : ''} />
              {!collapsed && 'Odśwież dane'}
            </Button>
          </CollapsibleTooltip>
          {/* <Button size="sm" asChild aria-label="Panel administracyjny">
            <Link href="/admin" target="_blank">
              <Shield />
              Admin
            </Link>
          </Button>
          <Button variant="outline" size="sm" asChild aria-label="Poczta (Roundcube)">
            <Link href={roundcubeUrl} target="_blank" rel="noopener noreferrer">
              <Mail />
              Poczta
            </Link>
          </Button> */}
          {!collapsed && openRouterBalance}
          <CollapsibleTooltip collapsed={collapsed} label="Wyloguj">
            <Button
              variant="outline"
              size="sm"
              className={cn(collapsed && 'px-0')}
              onClick={handleLogout}
              disabled={isPending}
              aria-label="Wyloguj"
            >
              <LogOut />
              {!collapsed && 'Wyloguj'}
            </Button>
          </CollapsibleTooltip>
        </div>
      </div>
    </aside>
  )
}

// Collapsed, the icon is the only thing left to identify a control, so it gets the label back on
// hover; expanded, the label is already on screen and a tooltip would just repeat it.
function CollapsibleTooltip({
  collapsed,
  label,
  children,
}: {
  collapsed: boolean
  label: string
  children: React.ReactNode
}) {
  if (!collapsed) return children

  return (
    <SimpleTooltip content={label} delayDuration={0}>
      {children}
    </SimpleTooltip>
  )
}

// Collapsed there is no label row for the count bubble to sit after, so it moves to the icon's
// corner — overriding the `ml-auto` CountBadge uses to push itself right in the expanded row.
function BadgeSlot({ collapsed, children }: { collapsed: boolean; children: React.ReactNode }) {
  if (!collapsed) return children

  return (
    <span className="pointer-events-none absolute -top-1 -right-1 [&>span]:ml-0">{children}</span>
  )
}
