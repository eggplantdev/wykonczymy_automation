import type { Payload } from 'payload'
import type { RoleT } from '@/lib/auth/roles'

// A snapshot's `taken_by` FK-references users(id), and a prod-dump test DB may have no user 1, so a
// spec whose action takes a snapshot sets `authState.userId` from this.
export async function firstUserId(
  payload: Payload,
  { role }: { role?: RoleT } = {},
): Promise<number> {
  const users = await payload.find({
    collection: 'users',
    where: {
      trashedAt: { exists: false },
      ...(role ? { role: { equals: role } } : {}),
    },
    limit: 1,
    sort: 'id',
    depth: 0,
    overrideAccess: true,
  })
  const firstUser = users.docs[0]
  if (!firstUser) throw new Error('no user in the DB to attribute the action to')
  return Number(firstUser.id)
}
