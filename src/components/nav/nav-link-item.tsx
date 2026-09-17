'use client'

import Link from 'next/link'

import { Button } from '@/components/ui/button'
import { UnreadBadge } from '@/components/nav/unread-badge'
import type { NavLinkT } from '@/lib/constants/sections'
import { cn } from '@/lib/utils/cn'

type NavLinkItemPropsT = {
  link: NavLinkT
  active: boolean
  collapsed?: boolean
  onNavigate?: () => void
}

/** Shared by the sidebar and the mobile drawer, which must render it indistinguishably. */
export function NavLinkItem({ link, active, collapsed = false, onNavigate }: NavLinkItemPropsT) {
  return (
    <Button
      variant="ghost"
      size="sm"
      align={collapsed ? 'center' : 'start'}
      className={cn(
        'relative',
        // Safe to hang drawer sizing off `max-sm:` rather than a prop: the sidebar is `hidden
        // sm:flex`, so below 768 only the mobile drawer renders this row.
        'max-sm:h-10 max-sm:gap-3 max-sm:px-4 max-sm:text-base',
        collapsed && 'px-0',
        // Not `bg-accent` — ghost's own hover paints that, so the active row would look like whatever
        // the cursor is over.
        active && 'bg-primary/10 text-primary hover:bg-primary/15 hover:text-primary font-semibold',
      )}
      asChild
    >
      <Link href={link.href} onClick={onNavigate} aria-current={active ? 'page' : undefined}>
        {/* Sized here, not via `max-sm:[&_svg]:size-6`: Button's base rule is guarded by
            `:not([class*='size-'])`, which outranks a bare descendant override. */}
        <link.icon className="size-4 max-sm:size-6" />
        {!collapsed && link.label}
        {link.unreadStream && (
          <BadgeSlot collapsed={collapsed}>
            <UnreadBadge stream={link.unreadStream} path={link.href} />
          </BadgeSlot>
        )}
      </Link>
    </Button>
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
