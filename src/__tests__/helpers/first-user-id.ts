import type { Payload } from 'payload'

// A snapshot's `taken_by` FK-references users(id), and a prod-dump test DB may have no user 1, so a
// spec whose action takes a snapshot sets `authState.userId` from this.
export async function firstUserId(payload: Payload): Promise<number> {
  const users = await payload.find({
    collection: 'users',
    limit: 1,
    depth: 0,
    overrideAccess: true,
  })
  const firstUser = users.docs[0]
  if (!firstUser) throw new Error('no user in the DB to attribute the action to')
  return Number(firstUser.id)
}
