import 'server-only'

import { cache } from 'react'
import { cookies } from 'next/headers'
import { unstable_cache } from 'next/cache'
import { jwtVerify } from 'jose'
import { getPayload } from 'payload'
import config from '@payload-config'
import type { RoleT } from '@/lib/auth/roles'
import { ROLES } from '@/lib/auth/roles'
import { entityTag } from '@/lib/cache/tags'
import { getDb } from '@/lib/db/get-db'
import { isSessionAlive } from '@/lib/db/user-sessions'
import type { SessionUserT } from '@/types/auth'
import { logError } from '@/lib/utils/log-error'

let cachedSecretKey: Uint8Array | undefined

/** Derive the secret key from Payload's own config (cached after first call). */
async function getSecretKey(): Promise<Uint8Array> {
  if (cachedSecretKey) return cachedSecretKey
  const payload = await getPayload({ config })
  cachedSecretKey = new TextEncoder().encode(payload.secret)
  return cachedSecretKey
}

// Backstop only: every writer that locks an account out expires the `user` entity tag on the spot.
const SESSION_ALIVE_REVALIDATE_SECONDS = 3600

const isSessionAliveCached = (userId: number, sid: string): Promise<boolean> =>
  unstable_cache(
    async () => isSessionAlive(await getDb(await getPayload({ config })), userId, sid),
    ['session-alive', String(userId), sid],
    { tags: [entityTag('user', userId)], revalidate: SESSION_ALIVE_REVALIDATE_SECONDS },
  )()

type SessionT = { user: SessionUserT; issuedAt: number }

/**
 * The token is 90 days long, so its signature alone cannot be the whole answer: deactivating or
 * trashing an account deletes its session rows, and the `sid` check here is what turns that into an
 * immediate logout. The answer is cached per `sid`, so a request pays a cache read, not a query.
 */
const readSession = cache(async (): Promise<SessionT | undefined> => {
  const cookieStore = await cookies()
  const token = cookieStore.get('payload-token')?.value

  if (!token) return undefined

  try {
    const secretKey = await getSecretKey()
    const { payload } = await jwtVerify(token, secretKey)

    const { id, email, name, role, sid, iat } = payload

    if (typeof id !== 'number' || typeof email !== 'string' || typeof name !== 'string') {
      return undefined
    }
    if (!ROLES.includes(role as RoleT)) return undefined
    if (typeof sid !== 'string' || typeof iat !== 'number') return undefined

    if (!(await isSessionAliveCached(id, sid))) return undefined

    return { user: { id, email, name, role: role as RoleT }, issuedAt: iat }
  } catch (err) {
    logError('[getCurrentUserJwt] JWT verify failed:', err)
    return undefined
  }
})

/**
 * Auth for server actions and RSC pages. Requires `saveToJWT: true` on `name` and `role` in the
 * Users collection. Wrapped with React cache() for deduplication within a single render pass.
 */
export const getCurrentUserJwt = cache(
  async (): Promise<SessionUserT | undefined> => (await readSession())?.user,
)

/** When the current token was minted (seconds since epoch) — drives the sliding refresh. */
export const getSessionIssuedAt = cache(
  async (): Promise<number | undefined> => (await readSession())?.issuedAt,
)
