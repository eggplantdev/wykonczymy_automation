import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import type { Payload } from 'payload'
import { getDb } from '@/lib/db/get-db'
import { selectKosztorysTreeData } from '@/lib/db/kosztorys-tree'
import { createTestInvestment, deleteTestInvestment } from '@/__tests__/helpers/investment'
import { createKosztorysTree } from '@/__tests__/helpers/kosztorys-db-tree'

const ENV_READY = Boolean(process.env.DB_POSTGRES_URL && process.env.PAYLOAD_SECRET)

describe.skipIf(!ENV_READY)('selectKosztorysTreeData (DB)', () => {
  let payload: Payload
  let db: Awaited<ReturnType<typeof getDb>>

  const created = { alpha: 0, beta: 0, bare: 0 }

  async function seed(investmentId: number, qtyDone: number) {
    // B-second is declared FIRST and so is inserted first, out of display order, deliberately
    await createKosztorysTree(payload, investmentId, {
      sections: [
        { name: 'B-second', displayOrder: 2 },
        {
          name: 'A-first',
          displayOrder: 1,
          items: [{ displayOrder: 1, description: 'pozycja', plannedQty: 3, clientPrice: 100 }],
        },
      ],
      stages: [{ label: 'etap-1' }],
      progress: [{ item: 0, stage: 0, qtyDone }],
    })
  }

  beforeAll(async () => {
    const { getPayload } = await import('payload')
    const config = (await import('@payload-config')).default
    payload = await getPayload({ config })
    db = await getDb(payload)

    for (const key of ['alpha', 'beta', 'bare'] as const) {
      created[key] = await createTestInvestment(payload, `tree-${key}-${Date.now()}`)
    }

    // Distinct qtyDone per investment is what makes a broken join visible rather than merely wrong.
    await seed(created.alpha, 11)
    await seed(created.beta, 22)
  })

  afterAll(async () => {
    for (const id of Object.values(created)) {
      if (id) await deleteTestInvestment(payload, id).catch(() => {})
    }
  })

  it('returns empty arrays, not null, for an investment with no kosztorys rows', async () => {
    // Without the coalesce in the query every one of these is null and the caller's `.map` throws
    const data = await selectKosztorysTreeData(db, created.bare)

    expect(data).not.toBeNull()
    expect(data!.sections).toEqual([])
    expect(data!.items).toEqual([])
    expect(data!.stages).toEqual([])
    expect(data!.progress).toEqual([])
  })

  it('orders sections by displayOrder regardless of insertion order', async () => {
    const data = await selectKosztorysTreeData(db, created.alpha)

    expect(data!.sections.map((section) => section.name)).toEqual(['A-first', 'B-second'])
  })

  it('scopes progress to the investment through its item, not across investments', async () => {
    // stage_progress carries no investment column — it reaches the investment via a JOIN on
    // kosztorys_items.
    const alpha = await selectKosztorysTreeData(db, created.alpha)
    const beta = await selectKosztorysTreeData(db, created.beta)

    expect(alpha!.progress.map((row) => row.qtyDone)).toEqual([11])
    expect(beta!.progress.map((row) => row.qtyDone)).toEqual([22])
  })

  it('returns revision as an ISO string', async () => {
    // The editor shell compares `revision` by value to detect a stale tree.
    const data = await selectKosztorysTreeData(db, created.alpha)

    expect(typeof data!.investment.updatedAt).toBe('string')
    expect(data!.investment.updatedAt).toMatch(/^\d{4}-\d{2}-\d{2}T[\d:.]+Z$/)
  })

  it('returns null for an investment that does not exist', async () => {
    expect(await selectKosztorysTreeData(db, 2_000_000_000)).toBeNull()
  })
})
