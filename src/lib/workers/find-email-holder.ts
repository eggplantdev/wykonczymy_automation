import type { Payload } from 'payload'

/** Any account holding `email`, trashed ones included — the unique index counts them too. */
export async function findEmailHolder(payload: Payload, email: string, ownId?: number) {
  const { docs } = await payload.find({
    collection: 'users',
    where: {
      and: [
        { email: { equals: email } },
        ...(ownId === undefined ? [] : [{ id: { not_equals: ownId } }]),
      ],
    },
    limit: 1,
    depth: 0,
    overrideAccess: true,
  })
  return docs[0]
}
