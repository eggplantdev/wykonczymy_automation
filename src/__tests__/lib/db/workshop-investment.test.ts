import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import type { Payload } from 'payload'
import { getDb } from '@/lib/db/get-db'
import { getWorkshop, setWorkshopPreset } from '@/lib/db/workshop-investment'
import { deletePreset, insertPreset } from '@/lib/db/presets'
import { TEMPLATE_INVESTMENT_STATUS } from '@/lib/constants/investment-lock'
import { createTestInvestment, deleteTestInvestment } from '@/__tests__/helpers/investment'
import { acquireTestWorkshop } from '@/__tests__/helpers/workshop'

const ENV_READY = Boolean(process.env.DB_POSTGRES_URL && process.env.PAYLOAD_SECRET)

// The warsztat is found by STATUS, and there is only ever one — both enforced in SQL, not app code,
// so they're only real against Postgres. Everything that writes a szablon keys on what this returns,
// so the pointer is asserted on the persisted row, not a return value.
describe.skipIf(!ENV_READY)('getWorkshop (DB)', () => {
  let payload: Payload
  let db: Awaited<ReturnType<typeof getDb>>
  let workshop: Awaited<ReturnType<typeof acquireTestWorkshop>>
  let decoyId: number
  let presetId: number

  beforeAll(async () => {
    const { getPayload } = await import('payload')
    const config = (await import('@payload-config')).default
    payload = await getPayload({ config })
    db = await getDb(payload)

    workshop = await acquireTestWorkshop(payload)
    // A normal investment created AFTER it: picking by status is what must exclude this one — an
    // „newest investment" or id-based rule would hand the warsztat's role to a real job.
    decoyId = await createTestInvestment(payload, 'warsztat-fixture-decoy')

    const id = await insertPreset(db, {
      name: 'warsztat-fixture-preset',
      createdBy: null,
      payload: {
        schemaVersion: 1,
        sections: [],
        items: [],
        stages: [],
        progress: [],
        settings: { wToolsCoeff: 0, ownToolsCoeff: 0, vatRate: 0 },
      },
    })
    if (id == null) throw new Error('fixture preset already exists — stale run?')
    presetId = id
  })

  afterAll(async () => {
    await workshop.release()
    if (presetId) await deletePreset(db, presetId)
    if (decoyId) await deleteTestInvestment(payload, decoyId)
  })

  it('finds the warsztat by its status, not by recency', async () => {
    expect(await getWorkshop(db)).toMatchObject({ id: workshop.id })
  })

  // The singleton rule lives in the DB index, not app code — `resolveWorkshopInvestment` is a
  // SELECT-then-INSERT, so two racing first-time „Otwórz" clicks both see nothing. Without the index
  // the loser becomes an orphan warsztat that `ORDER BY id LIMIT 1` never returns, silently eating edits.
  it('refuses a second warsztat at the database level', async () => {
    await expect(
      createTestInvestment(payload, 'warsztat-fixture-duplicate', {
        status: TEMPLATE_INVESTMENT_STATUS,
      }),
    ).rejects.toThrow()
  })

  it('reports which szablon the warsztat holds after one is opened into it', async () => {
    await setWorkshopPreset(db, workshop.id, presetId)

    expect(await getWorkshop(db)).toEqual({ id: workshop.id, presetId })
  })
})
