import { BADGE_BASE, BADGE_TONE } from '@/components/ui/badge'
import type { RoleT } from '@/lib/auth/roles'
import { cn } from '@/lib/utils/cn'

const ROLE_COLORS: Record<RoleT, string> = {
  ADMIN: 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200',
  OWNER: 'bg-violet-100 text-violet-800 dark:bg-violet-900 dark:text-violet-200',
  MANAGER: 'bg-sky-100 text-sky-800 dark:bg-sky-900 dark:text-sky-200',
  EMPLOYEE: BADGE_TONE.positive,
}

type RoleBadgePropsT = React.ComponentProps<'span'> & {
  role: RoleT
}

export function RoleBadge({ role, className, ...props }: RoleBadgePropsT) {
  return <span className={cn(BADGE_BASE, ROLE_COLORS[role], className)} {...props} />
}
