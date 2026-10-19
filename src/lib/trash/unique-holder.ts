import type { Payload } from 'payload'

type UniqueKeyT = {
  collection: 'equipment' | 'vehicles' | 'users'
  field: string
  value: string
  ownId?: number
}

/** Trashed rows included — the unique index counts them too. */
export async function findUniqueHolder(
  payload: Payload,
  { collection, field, value, ownId }: UniqueKeyT,
) {
  const { docs } = await payload.find({
    collection,
    where: {
      and: [
        { [field]: { equals: value } },
        ...(ownId === undefined ? [] : [{ id: { not_equals: ownId } }]),
      ],
    },
    limit: 1,
    depth: 0,
    overrideAccess: true,
  })
  return docs[0]
}

/**
 * A trashed holder still blocks the value, so the refusal has to say where to find it — otherwise
 * the user is told the value is taken by a row no listing shows.
 */
export async function uniqueClash(
  payload: Payload,
  key: Omit<UniqueKeyT, 'value'> & { value: string | null | undefined; subject: string },
) {
  if (!key.value) return undefined
  const holder = await findUniqueHolder(payload, { ...key, value: key.value })
  if (!holder) return undefined
  return holder.trashedAt
    ? `${key.subject} jest w Koszu — przywróć go stamtąd.`
    : `${key.subject} już istnieje.`
}
