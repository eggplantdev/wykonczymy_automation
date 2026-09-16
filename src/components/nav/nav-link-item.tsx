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

/** One row of the nav list, shared by the sidebar and the mobile drawer — the two render the same
 *  link and must stay indistinguishable, which they were not while each carried its own copy of the
 *  active-state classes. */
export function NavLinkItem({ link, active, collapsed = false, onNavigate }: NavLinkItemPropsT) {
  return (
    <Button
      variant="ghost"
      size="sm"
      align={collapsed ? 'center' : 'start'}
      className={cn(
        'relative',
        collapsed && 'px-0',
        // Not `bg-accent` — that is what ghost's own hover paints, so the active row would be
        // indistinguishable from whatever the cursor happens to be over.
        active && 'bg-primary/10 text-primary hover:bg-primary/15 hover:text-primary font-semibold',
      )}
      asChild
    >
      <Link href={link.href} onClick={onNavigate} aria-current={active ? 'page' : undefined}>
        <link.icon />
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
