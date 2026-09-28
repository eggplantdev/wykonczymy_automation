'use server'

import { requireAuth } from '@/lib/auth/require-auth'
import { MANAGEMENT_ROLES } from '@/lib/auth/roles'
import type { ClientViewSettingsT } from '@/lib/kosztorys/client-view-settings'
import { getClientViewSettings } from '@/lib/queries/kosztorys-client-view'

/**
 * The settings dialog's on-demand read, opened from the editor's „Opcje" menu. Named for what the
 * module IS — every export of a `'use server'` file is a public endpoint — because it wraps a
 * resolver that runs `overrideAccess` for the token entrance: publishing that one directly would
 * hand anyone an unauthenticated read. Here the session is checked first.
 */
export async function readClientViewSettings(investmentId: number): Promise<ClientViewSettingsT> {
  const session = await requireAuth(MANAGEMENT_ROLES)
  if (!session.success) throw new Error(session.error)

  return getClientViewSettings(investmentId)
}
