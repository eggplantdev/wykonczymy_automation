import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import type { Payload } from 'payload'
import { sql } from '@payloadcms/db-vercel-postgres'
import { getDb } from '@/lib/db/get-db'
import { purgeFixtureUsers } from '@/__tests__/helpers/purge-fixture-users'
import { createRegisterOwner, findExistingMediaId } from '@/__tests__/helpers/transfer-fixtures'

// `InvoiceCell` attaches a faktura via `setTransferInvoices`, which never sends `cancelledTransaction`
// — the field the CANCELLATION hook requires. It doesn't 400 because Payload merges the stored doc
// into `data` before `beforeValidate` on a Local API update — invisible from the hook's signature.

vi.mock('server-only', () => ({}))
vi.mock('next/server', async (importOriginal) => {
  const actual = await importOriginal<typeof import('next/server')>()
  return { ...actual, after: () => {} }
})

const ENV_READY = Boolean(process.env.DB_POSTGRES_URL && process.env.PAYLOAD_SECRET)
const MARKER = 'EX-770 invoice on cancellation'

describe.skipIf(!ENV_READY)('faktura on a CANCELLATION row (DB)', () => {
  let payload: Payload
  let db: Awaited<ReturnType<typeof getDb>>
  let registerId: number
  let cancellationId: number
  let mediaId: number
  const ctx = { context: { skipRevalidation: true, skipSheetSync: true } }

  beforeAll(async () => {
    const { getPayload } = await import('payload')
    const config = (await import('@payload-config')).default
    payload = await getPayload({ config })
    db = await getDb(payload)

    await db.execute(sql`DELETE FROM transactions WHERE description LIKE ${`${MARKER}%`}`)
    await purgeFixtureUsers(db)
    ;({ registerId } = await createRegisterOwner(
      payload,
      {
        name: 'Cancellation Invoice Owner',
        email: 'cancellation-invoice@test.local',
        registerName: 'cancellation-invoice-register',
      },
      ctx,
    ))
    mediaId = await findExistingMediaId(payload)

    const original = await payload.create({
      collection: 'transactions',
      data: {
        description: `${MARKER} original`,
        amount: 100,
        date: '2026-09-04T09:00:00.000Z',
        type: 'OTHER_DEPOSIT',
        paymentMethod: 'CASH',
        sourceRegister: registerId,
      },
      overrideAccess: true,
      ...ctx,
    })

    const cancellation = await payload.create({
      collection: 'transactions',
      data: {
        description: `${MARKER} cancellation`,
        amount: 100,
        date: '2026-09-04T10:00:00.000Z',
        type: 'CANCELLATION',
        cancelledTransaction: Number(original.id),
      },
      overrideAccess: true,
      ...ctx,
    })
    cancellationId = Number(cancellation.id)
  })

  afterAll(async () => {
    await db.execute(sql`DELETE FROM transactions WHERE description LIKE ${`${MARKER}%`}`)
    await purgeFixtureUsers(db)
  })

  async function attachedMediaIds(): Promise<number[]> {
    const result = await db.execute(sql`
      SELECT media_id FROM transactions_rels WHERE parent_id = ${cancellationId} AND media_id IS NOT NULL
    `)
    return result.rows.map((row) => Number(row.media_id))
  }

  it('attaches a faktura to an existing anulowanie', async () => {
    await payload.update({
      collection: 'transactions',
      id: cancellationId,
      data: { invoice: [mediaId] },
      overrideAccess: true,
      ...ctx,
    })
    expect(await attachedMediaIds()).toEqual([mediaId])
  })

  it('detaches it again', async () => {
    await payload.update({
      collection: 'transactions',
      id: cancellationId,
      data: { invoice: [] },
      overrideAccess: true,
      ...ctx,
    })
    expect(await attachedMediaIds()).toEqual([])
  })

  // Positive control: the reference is still required where it is genuinely absent — a CREATE.
  it('still refuses a CANCELLATION create with no reference', async () => {
    await expect(
      payload.create({
        collection: 'transactions',
        data: {
          description: `${MARKER} orphan`,
          amount: 50,
          date: '2026-09-04T11:00:00.000Z',
          type: 'CANCELLATION',
        },
        overrideAccess: true,
        ...ctx,
      }),
    ).rejects.toThrow(/Cancelled transaction reference/i)
  })
})
