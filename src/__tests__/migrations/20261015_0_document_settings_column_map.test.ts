import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import type { Payload } from 'payload'
import { sql, type MigrateUpArgs } from '@payloadcms/db-postgres'
import { up, down } from '@/migrations/20261015_0_document_settings_column_map'
import { createTestInvestment, deleteTestInvestment } from '@/__tests__/helpers/investment'

// It updates whole tables, so each case runs inside a transaction that is rolled back — the
// other specs in this shared DB never see a half-converted table.

const ENV_READY = Boolean(process.env.DB_POSTGRES_URL && process.env.PAYLOAD_SECRET)

const ROLLBACK = new Error('rollback')

type TxT = Parameters<Parameters<Payload['db']['drizzle']['transaction']>[0]>[0]

describe.skipIf(!ENV_READY)('20261015_0_document_settings_column_map (DB)', () => {
  let payload: Payload
  let investmentId: number

  const inRolledBackTx = async (body: (tx: TxT) => Promise<void>) => {
    await payload.db.drizzle
      .transaction(async (tx) => {
        await body(tx)
        throw ROLLBACK
      })
      .catch((error: unknown) => {
        if (error !== ROLLBACK) throw error
      })
  }

  const migrationArgs = (tx: TxT) => ({ db: tx, payload }) as unknown as MigrateUpArgs

  const seedClientRow = (tx: TxT, hiddenColumns: unknown) =>
    tx.execute(sql`
      INSERT INTO "kosztorys_client_view" ("investment_id", "hidden_columns")
      VALUES (${investmentId}, ${JSON.stringify(hiddenColumns)}::jsonb)
    `)

  const readClientRow = async (tx: TxT) => {
    const result = await tx.execute(sql`
      SELECT "hidden_columns" FROM "kosztorys_client_view" WHERE "investment_id" = ${investmentId}
    `)
    return (result.rows[0] as { hidden_columns: unknown }).hidden_columns
  }

  beforeAll(async () => {
    const { getPayload } = await import('payload')
    const config = (await import('@payload-config')).default
    payload = await getPayload({ config })
    investmentId = await createTestInvestment(payload, 'EX-1033 column map migration spec')
  })

  afterAll(async () => {
    if (investmentId) await deleteTestInvestment(payload, investmentId)
  })

  it('turns a hidden list into one choice per client column, shown ones included', async () => {
    await inRolledBackTx(async (tx) => {
      await seedClientRow(tx, ['price', 'note', 'aiPlannedQty'])
      await up(migrationArgs(tx))

      expect(await readClientRow(tx)).toEqual({
        note: true,
        plannedQty: false,
        currentPlannedQty: false,
        stageQtySum: false,
        unit: false,
        price: true,
        discountType: false,
        discountValue: false,
        discountAmount: false,
        plannedNet: false,
        currentPlannedNet: false,
        net: false,
        remaining: false,
        stages: false,
        stageValueNet: false,
        donePercent: false,
        plannedDonePercent: false,
      })
    })
  })

  it('converts the worker setting over the worker ceiling', async () => {
    await inRolledBackTx(async (tx) => {
      await tx.execute(sql`DELETE FROM "kosztorys_worker_view_settings"`)
      await tx.execute(sql`
        INSERT INTO "kosztorys_worker_view_settings" ("hidden_columns") VALUES ('["unit", "price"]'::jsonb)
      `)
      await up(migrationArgs(tx))

      const result = await tx.execute(
        sql`SELECT "hidden_columns" FROM "kosztorys_worker_view_settings"`,
      )
      expect((result.rows[0] as { hidden_columns: unknown }).hidden_columns).toEqual({
        plannedQty: false,
        currentPlannedQty: false,
        stageQtySum: false,
        unit: true,
        rate: false,
        plannedNetForPlane: false,
        net: false,
        remainingForPlane: false,
        stages: false,
        stageValueNet: false,
        plannedDonePercent: false,
      })
    })
  })

  it('leaves a stored map untouched', async () => {
    await inRolledBackTx(async (tx) => {
      await seedClientRow(tx, { price: true })
      await up(migrationArgs(tx))

      expect(await readClientRow(tx)).toEqual({ price: true })
    })
  })

  it('leaves a row that never chose (NULL) as it is', async () => {
    await inRolledBackTx(async (tx) => {
      await tx.execute(sql`
        INSERT INTO "kosztorys_client_view" ("investment_id", "hidden_columns")
        VALUES (${investmentId}, NULL)
      `)
      await up(migrationArgs(tx))

      expect(await readClientRow(tx)).toBeNull()
    })
  })

  // A worker row inserted without the column must not come up as the legacy „hide nothing".
  it('defaults a new worker row to an empty map', async () => {
    await inRolledBackTx(async (tx) => {
      await up(migrationArgs(tx))
      await tx.execute(sql`DELETE FROM "kosztorys_worker_view_settings"`)
      await tx.execute(sql`INSERT INTO "kosztorys_worker_view_settings" DEFAULT VALUES`)

      const result = await tx.execute(
        sql`SELECT "hidden_columns" FROM "kosztorys_worker_view_settings"`,
      )
      expect((result.rows[0] as { hidden_columns: unknown }).hidden_columns).toEqual({})
    })
  })

  it('down turns the map back into the hidden list', async () => {
    await inRolledBackTx(async (tx) => {
      await seedClientRow(tx, ['price', 'note'])
      await up(migrationArgs(tx))
      await down(migrationArgs(tx))

      expect(await readClientRow(tx)).toEqual(['note', 'price'])
    })
  })
})
