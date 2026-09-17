'use client'

import { BrandLogo } from '@/components/ui/brand-logo'
import { SimpleTooltip } from '@/components/ui/tooltip'
import { ThemeToggle } from '@/components/nav/theme-toggle'
import { NavLinkItem } from '@/components/nav/nav-link-item'
import { LogoutButton } from '@/components/nav/logout-button'
import { RefreshDataButton } from '@/components/nav/refresh-data-button'
import { cn } from '@/lib/utils/cn'
import { useCurrentUser } from '@/hooks/use-current-user'
import { useNavLinks } from '@/hooks/use-nav-links'
import { useSidebarCollapsed } from '@/hooks/use-sidebar-collapsed'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import Link from 'next/link'

type SidebarPropsT = {
  openRouterBalance?: React.ReactNode
}

export function Sidebar({ openRouterBalance }: SidebarPropsT) {
  const user = useCurrentUser()
  const { links, isActive } = useNavLinks()
  const [collapsed, setCollapsed] = useSidebarCollapsed()

  // Roundcube can't auto-login via URL; _user only prefills the username field on its
  // login page (no-op when a Roundcube session is already active).
  // const roundcubeUrl = `https://www.wykonczymy.com.pl/webmail/?_user=${encodeURIComponent(user.email)}`

  return (
    <aside
      className={cn(
        // z-40: the handle overhangs into the page, and the kosztorys v2 grid paints its frozen
        // columns at z-30 — without a stacking context above that, the pill disappears under them.
        'border-border bg-background sticky top-0 z-40 hidden h-screen shrink-0 flex-col border-r pb-3 sm:flex',
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
            <NavLinkItem link={link} active={isActive(link.href)} collapsed={collapsed} />
          </CollapsibleTooltip>
        ))}
      </nav>
      {/* User info + actions */}
      <div className="mt-auto flex flex-col gap-2 pt-4">
        {!collapsed && <div className="text-foreground text-sm font-medium">{user.name}</div>}
        <div className="flex flex-col gap-2">
          <CollapsibleTooltip collapsed={collapsed} label="Przełącz motyw">
            <ThemeToggle collapsed={collapsed} />
          </CollapsibleTooltip>
          <CollapsibleTooltip collapsed={collapsed} label="Odśwież dane">
            <RefreshDataButton collapsed={collapsed} />
          </CollapsibleTooltip>
          {/* <Button variant="outline" size="sm" asChild aria-label="Poczta (Roundcube)">
            <Link href={roundcubeUrl} target="_blank" rel="noopener noreferrer">
              <Mail />
              Poczta
            </Link>
          </Button> */}
          {!collapsed && openRouterBalance}
          <CollapsibleTooltip collapsed={collapsed} label="Wyloguj">
            <LogoutButton collapsed={collapsed} />
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
