import 'server-only'

import { cache } from 'react'
import { cookies } from 'next/headers'
import { unstable_cache } from 'next/cache'
import { jwtVerify } from 'jose'
import { getPayload } from 'payload'
import config from '@payload-config'
import type { RoleT } from '@/lib/auth/roles'
import { ROLES } from '@/lib/auth/roles'
import { CACHE_TAGS } from '@/lib/cache/tags'
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

// Tagged with the collection, not `entityTag('user', id)`, against the EX-849 rule: every write to
// `users` already expires it, so a writer that locks an account out cannot forget to — and an
// eviction costs one primary-key lookup per open session. The hour is a backstop for raw SQL.
const SESSION_ALIVE_REVALIDATE_SECONDS = 3600

const isSessionAliveCached = (userId: number, sid: string, role: RoleT): Promise<boolean> =>
  unstable_cache(
    async () => isSessionAlive(await getDb(await getPayload({ config })), userId, sid, role),
    ['session-alive', String(userId), sid, role],
    { tags: [CACHE_TAGS.users], revalidate: SESSION_ALIVE_REVALIDATE_SECONDS },
  )()

type SessionT = { user: SessionUserT; issuedAt: number }

/**
 * The token is 90 days long, so its signature alone cannot be the whole answer: deactivating or
 * trashing an account deletes its session rows, and the `sid` check here is what turns that into an
 * immediate logout. The answer is cached per `sid`, so a request pays a cache read, not a query.
 */
export const getSession = cache(async (): Promise<SessionT | undefined> => {
  const cookieStore = await cookies()
  const token = cookieStore.get('payload-token')?.value

  if (!token) return undefined

  let claims
  try {
    claims = (await jwtVerify(token, await getSecretKey())).payload
  } catch (err) {
    logError('[getCurrentUserJwt] JWT verify failed:', err)
    return undefined
  }

  const { id, email, name, role, sid, iat } = claims

  if (typeof id !== 'number' || typeof email !== 'string' || typeof name !== 'string') {
    return undefined
  }
  if (!ROLES.includes(role as RoleT)) return undefined
  if (typeof sid !== 'string' || typeof iat !== 'number') return undefined

  // Fails closed: a DB that cannot answer is no proof the session is alive.
  try {
    if (!(await isSessionAliveCached(id, sid, role as RoleT))) return undefined
  } catch (err) {
    logError('[getCurrentUserJwt] session check failed:', err)
    return undefined
  }

  return { user: { id, email, name, role: role as RoleT }, issuedAt: iat }
})

/** Requires `saveToJWT: true` on `name` and `role` in the Users collection. */
export const getCurrentUserJwt = async (): Promise<SessionUserT | undefined> =>
  (await getSession())?.user
