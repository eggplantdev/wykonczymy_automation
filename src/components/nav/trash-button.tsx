'use client'

import { Trash2 } from 'lucide-react'
import Link from 'next/link'

import { Button } from '@/components/ui/button'
import { useCurrentUser } from '@/hooks/use-current-user'
import { isManagementRole } from '@/lib/auth/roles'
import { PAGE_TITLES, TRASH_HREF } from '@/lib/constants/sections'
import { cn } from '@/lib/utils/cn'

type TrashButtonPropsT = React.ComponentProps<typeof Button> & {
  active: boolean
  collapsed?: boolean
}

export function TrashButton({ active, collapsed = false, ...props }: TrashButtonPropsT) {
  const user = useCurrentUser()

  // `/kosz` redirects every other role back to „/".
  if (!isManagementRole(user.role)) return null

  return (
    <Button
      {...props}
      variant="outline"
      size="sm"
      className={cn(
        collapsed && 'px-0',
        active &&
          'border-primary/40 bg-primary/10 text-primary hover:bg-primary/15 hover:text-primary',
      )}
      asChild
    >
      <Link href={TRASH_HREF} aria-current={active ? 'page' : undefined}>
        <Trash2 />
        {!collapsed && PAGE_TITLES.trash}
      </Link>
    </Button>
  )
}
