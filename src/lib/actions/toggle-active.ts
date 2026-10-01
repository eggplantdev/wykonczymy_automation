'use server'

import { getPayload, type Payload } from 'payload'
import config from '@payload-config'
import { revalidateCollections } from '@/lib/cache/revalidate'
import type { CACHE_TAGS } from '@/lib/cache/tags'
import { requireAuth } from '@/lib/auth/require-auth'
import { MANAGEMENT_ROLES, canManageAccount } from '@/lib/auth/roles'
import type { ActionResultT } from '@/types/action'
import { toActionFailure } from '@/lib/actions/action-failure'
import { logError } from '@/lib/utils/log-error'
import { getDb } from '@/lib/db/get-db'
import { deleteUserSessions } from '@/lib/db/user-sessions'
import { fetchRemovalSubject } from '@/lib/db/account-removal'
import { MANAGER_SCOPE_MESSAGE } from '@/lib/constants/worker-lock'
import { removalRefusal } from '@/lib/workers/account-removal'
import type { SessionUserT } from '@/types/auth'

type ToggleConfigT = {
  collection: 'users' | 'cash-registers'
  cacheTag: keyof typeof CACHE_TAGS
  data: (active: boolean) => Record<string, unknown>
  overrideAccess?: boolean
  refusal?: (
    payload: Payload,
    actor: SessionUserT,
    id: number,
    active: boolean,
  ) => Promise<string | undefined>
  afterUpdate?: (payload: Payload, id: number, active: boolean) => Promise<void>
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
    const refusal = await cfg.refusal?.(payload, session.user, id, active)
    if (refusal) return { success: false, error: refusal }
    await payload.update({
      collection: cfg.collection,
      id,
      data: cfg.data(active),
      ...(cfg.overrideAccess ? { overrideAccess: true } : {}),
    })
    await cfg.afterUpdate?.(payload, id, active)

    revalidateCollections([cfg.cacheTag])
    return { success: true }
  } catch (err) {
    logError('[TOGGLE_ACTIVE]', err)
    return toActionFailure(err)
  }
}

export async function toggleUserActive(id: number, active: boolean) {
  return toggleActive(id, active, {
    collection: 'users',
    cacheTag: 'users',
    data: (active) => ({ active }),
    overrideAccess: true,
    // A deactivated account is locked out like a trashed one, so it answers to the same rules.
    refusal: async (payload, actor, id, active) => {
      const subject = await fetchRemovalSubject(await getDb(payload), id)
      if (!subject) return undefined
      if (!canManageAccount(actor.role, subject.role)) return MANAGER_SCOPE_MESSAGE
      return active ? undefined : removalRefusal(subject, { isSelf: actor.id === id })
    },
    // A deactivated account is refused at login; this also shuts the `/admin` and REST sessions it
    // already holds. After the update, which would otherwise write them back.
    afterUpdate: async (payload, id, active) => {
      if (!active) await deleteUserSessions(await getDb(payload), id)
    },
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
