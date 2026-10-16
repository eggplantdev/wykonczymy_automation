'use client'

import Link from 'next/link'

import { Button } from '@/components/ui/button'
import { UnreadBadge } from '@/components/nav/unread-badge'
import type { NavLinkT } from '@/lib/constants/sections'
import { cn } from '@/lib/utils/cn'

type NavLinkItemPropsT = React.ComponentProps<typeof Button> & {
  link: NavLinkT
  active: boolean
  collapsed?: boolean
  onNavigate?: () => void
}

export function NavLinkItem({
  link,
  active,
  collapsed = false,
  onNavigate,
  ...props
}: NavLinkItemPropsT) {
  return (
    <Button
      {...props}
      variant="ghost"
      size="sm"
      align={collapsed ? 'center' : 'start'}
      className={cn(
        'relative',
        'max-sm:min-h-10 max-sm:gap-3 max-sm:px-4 max-sm:text-base',
        collapsed ? 'px-0' : 'h-auto min-h-8 py-1.5 whitespace-normal',
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
        {!collapsed && <span className="min-w-0 text-left">{link.label}</span>}
        {link.unreadStream && (
          <BadgeSlot collapsed={collapsed}>
            <UnreadBadge stream={link.unreadStream} path={link.href} />
          </BadgeSlot>
        )}
      </Link>
    </Button>
  )
}

function BadgeSlot({ collapsed, children }: { collapsed: boolean; children: React.ReactNode }) {
  if (!collapsed) return children

  return (
    <span className="pointer-events-none absolute -top-1 -right-1 [&>span]:ml-0">{children}</span>
  )
}
