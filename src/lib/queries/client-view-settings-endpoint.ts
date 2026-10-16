'use server'

import { requireAuth } from '@/lib/auth/require-auth'
import { MANAGEMENT_ROLES } from '@/lib/auth/roles'
import {
  getClientViewSettingsRead,
  type ClientViewSettingsReadT,
} from '@/lib/queries/kosztorys-client-view'

/**
 * it wraps a
 * resolver that runs `overrideAccess` for the token entrance: publishing that one directly would
 * hand anyone an unauthenticated read.
 */
export async function readClientViewSettings(
  investmentId: number,
): Promise<ClientViewSettingsReadT> {
  const session = await requireAuth(MANAGEMENT_ROLES)
  if (!session.success) throw new Error(session.error)

  return getClientViewSettingsRead(investmentId)
}
