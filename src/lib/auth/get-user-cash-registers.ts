import 'server-only'

import { cacheLife, cacheTag } from 'next/cache'
import { getPayload } from 'payload'
import config from '@payload-config'
import type { RoleT } from '@/lib/auth/roles'
import { CACHE_TAGS } from '@/lib/cache/tags'

/**
 * Returns the cash register ids owned by the given user.
 * Returns `undefined` for ADMIN (meaning "no restriction — all registers").
 * OWNER and MANAGER are restricted to their own registers as transfer source.
 */
export async function getUserCashRegisterIds(
  userId: number,
  role: RoleT,
): Promise<number[] | undefined> {
  if (role === 'ADMIN') return undefined
  return getCachedUserRegisterIds(userId)
}

async function getCachedUserRegisterIds(userId: number) {
  'use cache'
  cacheLife('max')
  cacheTag(CACHE_TAGS.cashRegisters)

  const payload = await getPayload({ config })
  const { docs } = await payload.find({
    collection: 'cash-registers',
    where: { owner: { equals: userId } },
    pagination: false,
    depth: 0,
  })
  return docs.map((doc) => doc.id as number)
}
