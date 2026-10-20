'use client'

import { BrandLogo } from '@/components/ui/brand-logo'
import { SimpleTooltip } from '@/components/ui/tooltip'
import { ThemeToggle } from '@/components/nav/theme-toggle'
import { NavLinkItem } from '@/components/nav/nav-link-item'
import { LogoutButton } from '@/components/nav/logout-button'
import { RefreshDataButton } from '@/components/nav/refresh-data-button'
import { AdminButton } from '@/components/nav/admin-button'
import { TrashButton } from '@/components/nav/trash-button'
import { cn } from '@/lib/utils/cn'
import { PAGE_TITLES, TRASH_HREF } from '@/lib/constants/sections'
import { useCurrentUser } from '@/hooks/use-current-user'
import { useNavLinks } from '@/hooks/use-nav-links'
import { useTranslation } from '@/hooks/use-translation'
import { useSidebarCollapsed } from '@/hooks/use-sidebar-collapsed'
import { usePersistedFlag } from '@/hooks/use-persisted-value'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import {
  Collapsible,
  CollapsibleChevron,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import { OPEN_STATES } from '@/components/ui/collapsible-section'
import { Button } from '@/components/ui/button'
import { EdgeHandlePill } from '@/components/ui/edge-handle-pill'
import Link from 'next/link'

const ACCOUNT_STORAGE_KEY = 'nav:sidebar-account'

type SidebarPropsT = {
  openRouterBalance?: React.ReactNode
}

export function Sidebar({ openRouterBalance }: SidebarPropsT) {
  const user = useCurrentUser()
  const { links, isActive } = useNavLinks()
  const [collapsed, setCollapsed] = useSidebarCollapsed()
  const { t } = useTranslation('shell')
  const [accountOpen, setAccountOpen] = usePersistedFlag(ACCOUNT_STORAGE_KEY, OPEN_STATES, false)
  const toggleLabel = collapsed ? t('expandMenu') : t('collapseMenu')
  const accountToggleLabel = accountOpen ? t('hideAccountMenu') : t('showAccountMenu')

  return (
    <aside
      className={cn(
        // z-40: the handle overhangs into the page, and the kosztorys v2 grid paints its frozen
        // columns at z-30 — without a stacking context above that, the pill disappears under them.
        'border-border bg-background sticky top-0 z-40 hidden h-screen shrink-0 flex-col border-r pb-3 sm:flex',
        collapsed ? 'w-14 px-2' : 'w-64 px-3',
      )}
    >
      <SimpleTooltip content={toggleLabel}>
        <button
          type="button"
          onClick={() => setCollapsed(!collapsed)}
          aria-label={toggleLabel}
          aria-expanded={!collapsed}
          className="group absolute inset-y-0 -right-3 z-20 flex w-6 cursor-pointer items-center justify-center"
        >
          <EdgeHandlePill orientation="vertical">
            {collapsed ? <ChevronRight className="size-3" /> : <ChevronLeft className="size-3" />}
          </EdgeHandlePill>
        </button>
      </SimpleTooltip>
      {/* `-m-1 p-1`: the scroll container clips, and the collapsed unread badge overhangs its row by 4px. */}
      <div className="-m-1 flex min-h-0 flex-col overflow-y-auto p-1">
        <Link href="/" className="mx-auto flex items-center py-3">
          <BrandLogo height={collapsed ? 36 : 40} priority />
        </Link>
        <nav className="flex flex-col gap-1">
          {links.map((link) => (
            <CollapsibleTooltip key={link.href} collapsed={collapsed} label={link.label}>
              <NavLinkItem link={link} active={isActive(link.href)} collapsed={collapsed} />
            </CollapsibleTooltip>
          ))}
        </nav>
      </div>
      <Collapsible
        open={accountOpen}
        onOpenChange={setAccountOpen}
        className="mt-auto flex flex-col gap-2 pt-4"
      >
        <div
          className={cn(
            'flex items-center gap-1',
            collapsed ? 'justify-center' : 'justify-between',
          )}
        >
          {!collapsed && (
            <Link
              href={`/pracownicy/${user.id}`}
              className="text-foreground truncate text-sm font-medium hover:underline"
            >
              {user.name}
            </Link>
          )}
          <SimpleTooltip content={accountToggleLabel}>
            <CollapsibleTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="size-7"
                aria-label={accountToggleLabel}
              >
                <CollapsibleChevron open={accountOpen} />
              </Button>
            </CollapsibleTrigger>
          </SimpleTooltip>
        </div>
        <CollapsibleContent className="flex flex-col gap-2">
          <CollapsibleTooltip collapsed={collapsed} label={t('toggleTheme')}>
            <ThemeToggle collapsed={collapsed} />
          </CollapsibleTooltip>
          <CollapsibleTooltip collapsed={collapsed} label={t('refreshData')}>
            <RefreshDataButton collapsed={collapsed} />
          </CollapsibleTooltip>
          <CollapsibleTooltip collapsed={collapsed} label="Admin">
            <AdminButton collapsed={collapsed} />
          </CollapsibleTooltip>
          <CollapsibleTooltip collapsed={collapsed} label={PAGE_TITLES.trash}>
            <TrashButton collapsed={collapsed} active={isActive(TRASH_HREF)} />
          </CollapsibleTooltip>
          {!collapsed && openRouterBalance}
          <CollapsibleTooltip collapsed={collapsed} label={t('logout')}>
            <LogoutButton collapsed={collapsed} />
          </CollapsibleTooltip>
        </CollapsibleContent>
      </Collapsible>
    </aside>
  )
}

// The trigger is `asChild`: every child must spread its rest props onto its Button, or the handlers
// and ref land nowhere and the tooltip never opens.
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
