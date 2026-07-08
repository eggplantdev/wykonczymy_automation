import type { RoleT } from '@/lib/auth/roles'
import { cn } from '@/lib/utils/cn'

/** Shared pill base for the app's status/role badges — colors layer on top. */
export const BADGE_BASE = 'inline-flex items-center rounded-md px-1.5 py-0.5 text-xs font-medium'

const ROLE_COLORS: Record<RoleT, string> = {
  ADMIN: 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200',
  OWNER: 'bg-violet-100 text-violet-800 dark:bg-violet-900 dark:text-violet-200',
  MANAGER: 'bg-sky-100 text-sky-800 dark:bg-sky-900 dark:text-sky-200',
  EMPLOYEE: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200',
}

type RoleBadgePropsT = React.ComponentProps<'span'> & {
  role: RoleT
}

function RoleBadge({ role, className, ...props }: RoleBadgePropsT) {
  return <span className={cn(BADGE_BASE, ROLE_COLORS[role], className)} {...props} />
}

export { RoleBadge }
