import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import type { Payload } from 'payload'
import { getDb } from '@/lib/db/get-db'
import { investmentGateForRow } from '@/lib/db/investment-gate'
import { createTestInvestment, deleteTestInvestment } from '@/__tests__/helpers/investment'
import { createKosztorysTree } from '@/__tests__/helpers/kosztorys-db-tree'
import { ENV_READY, bootTestPayload } from '@/__tests__/helpers/payload'

describe.skipIf(!ENV_READY)('investmentGateForRow (DB)', () => {
  let payload: Payload
  let investmentId: number
  let rowIds: Record<'item' | 'section' | 'stage', number>

  beforeAll(async () => {
    payload = await bootTestPayload()
    investmentId = await createTestInvestment(payload, 'investment-gate-db')
    const tree = await createKosztorysTree(payload, investmentId, {
      sections: [{ name: 'Sekcja A', items: [{ description: 'Malowanie', plannedQty: 1 }] }],
      stages: [{}],
    })
    rowIds = { item: tree.itemIds[0], section: tree.sectionIds[0], stage: tree.stageIds[0] }
  })

  afterAll(async () => {
    if (investmentId) await deleteTestInvestment(payload, investmentId)
  })

  it.each(['item', 'section', 'stage'] as const)(
    'resolves a %s to its investment',
    async (kind) => {
      const gate = await investmentGateForRow(await getDb(payload), kind, rowIds[kind])

      expect(gate).toEqual({ investmentId, lockMessage: undefined })
    },
  )
})
