import type { RoleT } from '@/lib/auth/roles'
import type { MessageKeyT } from '@/lib/i18n/translations'

export const ROLE_KEYS: Record<RoleT, MessageKeyT<'workerPage'>> = {
  ADMIN: 'roleAdmin',
  OWNER: 'roleOwner',
  MANAGER: 'roleManager',
  EMPLOYEE: 'roleEmployee',
}
