import 'server-only'

import { cache } from 'react'
import { cookies } from 'next/headers'
import { jwtVerify } from 'jose'
import { getPayload } from 'payload'
import config from '@payload-config'
import type { RoleT } from '@/lib/auth/roles'
import { ROLES } from '@/lib/auth/roles'
import type { SessionUserT } from '@/types/auth'

let cachedSecretKey: Uint8Array | undefined

/** Derive the secret key from Payload's own config (cached after first call). */
async function getSecretKey(): Promise<Uint8Array> {
  if (cachedSecretKey) return cachedSecretKey
  const payload = await getPayload({ config })
  cachedSecretKey = new TextEncoder().encode(payload.secret)
  return cachedSecretKey
}

/**
 * Fast JWT-based auth for server actions and RSC pages.
 * Decodes the payload-token cookie directly — no DB round-trip.
 * Wrapped with React cache() for deduplication within a single render pass.
 *
 * Requires `saveToJWT: true` on `name` and `role` fields in Users collection.
 * Trade-off: a deleted/disabled user stays valid until token expires (24h).
 */
export const getCurrentUserJwt = cache(async (): Promise<SessionUserT | undefined> => {
  const cookieStore = await cookies()
  const token = cookieStore.get('payload-token')?.value

  if (!token) return undefined

  try {
    const secretKey = await getSecretKey()
    const { payload } = await jwtVerify(token, secretKey)

    const id = payload.id
    const email = payload.email
    const name = payload.name
    const role = payload.role

    if (typeof id !== 'number' || typeof email !== 'string' || typeof name !== 'string') {
      return undefined
    }

    if (!ROLES.includes(role as RoleT)) return undefined

    return { id, email, name, role: role as RoleT }
  } catch (err) {
    console.error('[getCurrentUserJwt] JWT verify failed:', err)
    return undefined
  }
})
