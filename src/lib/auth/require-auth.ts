import 'server-only'

import { getCurrentUserJwt } from '@/lib/auth/get-current-user-jwt'
import type { SessionUserT } from '@/types/auth'
import type { RoleT } from '@/lib/auth/roles'

type AuthResultT = { success: true; user: SessionUserT } | { success: false; error: string }

/**
 * Checks authentication and verifies the user has one of the allowed roles.
 * Use in server actions as the first guard.
 */
export async function requireAuth(allowedRoles: readonly RoleT[]): Promise<AuthResultT> {
  const user = await getCurrentUserJwt()

  if (!user) {
    return { success: false, error: 'Nie jesteś zalogowany' }
  }

  if (!allowedRoles.includes(user.role)) {
    return { success: false, error: 'Brak uprawnień' }
  }

  return { success: true, user }
}
