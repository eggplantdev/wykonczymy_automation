import 'server-only'
import type { Payload } from 'payload'

// „Wersje" attributes each row to a person; `taken_by` is a bare user id on both snapshot planes.
export async function withTakenByNames<RowT extends { takenBy: number | null }>(
  payload: Payload,
  rows: RowT[],
): Promise<(RowT & { takenByName: string | null })[]> {
  const userIds = [...new Set(rows.map((row) => row.takenBy).filter((id) => id != null))]
  const nameById = new Map<number, string>()
  if (userIds.length > 0) {
    const users = await payload.find({
      collection: 'users',
      where: { id: { in: userIds } },
      limit: userIds.length,
      depth: 0,
      overrideAccess: true,
    })
    for (const user of users.docs) nameById.set(Number(user.id), user.name ?? user.email)
  }
  return rows.map((row) => ({
    ...row,
    takenByName: row.takenBy == null ? null : (nameById.get(row.takenBy) ?? null),
  }))
}
