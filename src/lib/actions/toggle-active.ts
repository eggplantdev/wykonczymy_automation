'use server'

import { getPayload } from 'payload'
import config from '@payload-config'
import { revalidateCollection } from '@/lib/cache/revalidate'
import type { CACHE_TAGS } from '@/lib/cache/tags'
import { requireAuth } from '@/lib/auth/require-auth'
import { MANAGEMENT_ROLES } from '@/lib/auth/roles'
import type { ActionResultT } from '@/types/action'
import { getErrorMessage } from './run-action'

type ToggleConfigT = {
  collection: 'users' | 'cash-registers' | 'investments'
  cacheTag: keyof typeof CACHE_TAGS
  data: (active: boolean) => Record<string, unknown>
  // Investments toggle their own `status` field and rely on Payload's default
  // access; the other two flip a shared `active` flag with elevated access.
  overrideAccess?: boolean
}

async function toggleActive(
  id: number,
  active: boolean,
  cfg: ToggleConfigT,
): Promise<ActionResultT> {
  const session = await requireAuth(MANAGEMENT_ROLES)
  if (!session.success) return session

  try {
    const payload = await getPayload({ config })
    await payload.update({
      collection: cfg.collection,
      id,
      data: cfg.data(active),
      ...(cfg.overrideAccess ? { overrideAccess: true } : {}),
    })

    revalidateCollection(cfg.cacheTag)
    return { success: true }
  } catch (err) {
    return { success: false, error: getErrorMessage(err) }
  }
}

export async function toggleUserActive(id: number, active: boolean) {
  return toggleActive(id, active, {
    collection: 'users',
    cacheTag: 'users',
    data: (active) => ({ active }),
    overrideAccess: true,
  })
}

export async function toggleCashRegisterActive(id: number, active: boolean) {
  return toggleActive(id, active, {
    collection: 'cash-registers',
    cacheTag: 'cashRegisters',
    data: (active) => ({ active }),
    overrideAccess: true,
  })
}

export async function toggleInvestmentStatus(id: number, active: boolean) {
  return toggleActive(id, active, {
    collection: 'investments',
    cacheTag: 'investments',
    data: (active) => ({ status: active ? 'active' : 'completed' }),
  })
}
