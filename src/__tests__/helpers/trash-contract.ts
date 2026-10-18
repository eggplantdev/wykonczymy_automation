import { afterAll, beforeAll, beforeEach, expect, it } from 'vitest'
import type { Payload } from 'payload'
import { sql } from '@payloadcms/db-postgres'
import { getDb } from '@/lib/db/get-db'
import { revalidateCollections } from '@/__tests__/stubs/cache-revalidate'
import type { ActionResultT } from '@/types/action'
import { bootTestPayload } from '@/__tests__/helpers/payload'

type TrashActionsT = {
  trash: (id: number) => Promise<ActionResultT>
  restore: (id: number) => Promise<ActionResultT>
  deleteForever: (id: number, typedName: string) => Promise<ActionResultT>
}

export type TrashContractT = {
  table: string
  nameColumn: string
  prefix: string
  create: (payload: Payload, name: string) => Promise<{ id: string | number }>
  addChild: (payload: Payload, id: number) => Promise<unknown>
  childTable: string
  childForeignKey: string
  loadActions: () => Promise<TrashActionsT>
  setRole: (role: string) => void
  missingError: string
  notInTrashError: string
  revalidated: { trash: string[]; deleteForever: string[] }
}

export function describeTrashContract(contract: TrashContractT) {
  let payload: Payload
  let db: Awaited<ReturnType<typeof getDb>>
  let actions: TrashActionsT
  let serial = 0

  const table = sql.raw(contract.table)
  const nameColumn = sql.raw(contract.nameColumn)

  const createRow = async () => {
    const name = `${contract.prefix} ${++serial}`
    const id = Number((await contract.create(payload, name)).id)
    return { id, name }
  }

  const trashedAt = async (id: number) => {
    const { rows } = await db.execute(sql`SELECT trashed_at FROM ${table} WHERE id = ${id}`)
    return rows[0]?.trashed_at ?? null
  }

  const exists = async (id: number) => {
    const { rows } = await db.execute(sql`SELECT 1 FROM ${table} WHERE id = ${id}`)
    return rows.length > 0
  }

  const childCount = async (id: number) => {
    const { rows } = await db.execute(
      sql`SELECT COUNT(*) AS count FROM ${sql.raw(contract.childTable)} WHERE ${sql.raw(contract.childForeignKey)} = ${id}`,
    )
    return Number(rows[0].count)
  }

  const purge = () =>
    db.execute(sql`DELETE FROM ${table} WHERE ${nameColumn} LIKE ${`${contract.prefix}%`}`)

  beforeAll(async () => {
    payload = await bootTestPayload()
    db = await getDb(payload)
    actions = await contract.loadActions()
    await purge()
  })

  beforeEach(() => {
    contract.setRole('OWNER')
    revalidateCollections.mockClear()
  })

  afterAll(async () => {
    await purge()
  })

  it('lets a MANAGER trash, restore and delete forever a row with children', async () => {
    contract.setRole('MANAGER')
    const { id, name } = await createRow()
    await contract.addChild(payload, id)

    expect((await actions.trash(id)).success).toBe(true)
    expect(await trashedAt(id)).not.toBeNull()
    expect(await childCount(id)).toBe(1)

    expect((await actions.restore(id)).success).toBe(true)
    expect(await trashedAt(id)).toBeNull()

    expect((await actions.trash(id)).success).toBe(true)
    expect((await actions.deleteForever(id, name)).success).toBe(true)
    expect(await exists(id)).toBe(false)
    expect(await childCount(id)).toBe(0)
  })

  it('treats trashing an already-trashed row as done, keeping its first date', async () => {
    const { id } = await createRow()
    await actions.trash(id)
    const first = await trashedAt(id)

    expect((await actions.trash(id)).success).toBe(true)
    expect(await trashedAt(id)).toEqual(first)
  })

  it('refuses a delete forever whose typed name does not match', async () => {
    const { id } = await createRow()
    await actions.trash(id)

    expect((await actions.deleteForever(id, 'inna nazwa')).success).toBe(false)
    expect(await exists(id)).toBe(true)
  })

  it('refuses a delete forever of a row that is not in the trash', async () => {
    const { id, name } = await createRow()

    expect(await actions.deleteForever(id, name)).toEqual({
      success: false,
      error: contract.notInTrashError,
    })
    expect(await exists(id)).toBe(true)
  })

  it('answers a missing row as missing', async () => {
    expect(await actions.trash(-1)).toEqual({ success: false, error: contract.missingError })
  })

  it('refuses an EMPLOYEE every action', async () => {
    const live = await createRow()
    const trashed = await createRow()
    await actions.trash(trashed.id)
    contract.setRole('EMPLOYEE')

    expect((await actions.trash(live.id)).success).toBe(false)
    expect((await actions.restore(trashed.id)).success).toBe(false)
    expect((await actions.deleteForever(trashed.id, trashed.name)).success).toBe(false)
    expect(await trashedAt(live.id)).toBeNull()
    expect(await exists(trashed.id)).toBe(true)
  })

  it('expires the readers, and the children too on a delete', async () => {
    const { id, name } = await createRow()

    await actions.trash(id)
    expect(revalidateCollections.mock.calls.at(-1)?.[0]).toEqual(contract.revalidated.trash)

    await actions.deleteForever(id, name)
    expect(revalidateCollections.mock.calls.at(-1)?.[0]).toEqual(contract.revalidated.deleteForever)
  })
}
