import 'server-only'

import { redirect } from 'next/navigation'
import { requireAuth } from '@/lib/auth/require-auth'
import { MANAGEMENT_ROLES } from '@/lib/auth/roles'
import type { SessionUserT } from '@/types/auth'

/**
 * Redirecting is the whole contract — a page that lets a DAL guard's `throw` decide instead shows an
 * error screen to someone who is merely logged out.
 */
export async function requireManagementPage(): Promise<SessionUserT> {
  const session = await requireAuth(MANAGEMENT_ROLES)
  if (!session.success) redirect('/zaloguj')
  return session.user
}
