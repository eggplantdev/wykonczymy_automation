import { Badge, type BadgeToneT } from '@/components/ui/badge'
import type { RoleT } from '@/lib/auth/roles'

const ROLE_TONES: Record<RoleT, BadgeToneT> = {
  ADMIN: 'pending',
  OWNER: 'violet',
  MANAGER: 'sky',
  EMPLOYEE: 'positive',
}

type RoleBadgePropsT = Omit<React.ComponentProps<typeof Badge>, 'tone' | 'appearance'> & {
  role: RoleT
}

export function RoleBadge({ role, ...props }: RoleBadgePropsT) {
  return <Badge tone={ROLE_TONES[role]} {...props} />
}
