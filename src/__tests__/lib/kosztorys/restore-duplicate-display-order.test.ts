import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import type { Payload } from 'payload'
import { serializeKosztorys } from '@/lib/kosztorys/serialize-kosztorys'
import { restoreKosztorys } from '@/lib/kosztorys/restore-kosztorys'
import { withPayloadTransaction } from '@/lib/db/with-payload-transaction'
import { createTestInvestment, deleteTestInvestment } from '@/__tests__/helpers/investment'
import { createKosztorysTree } from '@/__tests__/helpers/kosztorys-db-tree'

vi.mock('@/lib/auth/require-auth', () => ({
  requireAuth: vi.fn(async () => ({ success: true, user: { id: 1, role: 'OWNER' } })),
}))

const ENV_READY = Boolean(process.env.DB_POSTGRES_URL && process.env.PAYLOAD_SECRET)

describe.skipIf(!ENV_READY)('restore with tied display_order (DB)', () => {
  let payload: Payload
  let investmentId: number

  beforeAll(async () => {
    const { getPayload } = await import('payload')
    const config = (await import('@payload-config')).default
    payload = await getPayload({ config })

    investmentId = await createTestInvestment(payload, 'restore-tied-display-order-test', {
      vatRate: 0.23,
    })

    // Every `displayOrder: 0` below is deliberate, overriding the builder's index default — the tie
    // IS the fixture.
    const item = { displayOrder: 0, unit: 'm2', plannedQty: 1, clientPrice: 100 }
    await createKosztorysTree(payload, investmentId, {
      sections: [
        {
          name: 'Sekcja A',
          displayOrder: 0,
          items: [
            { ...item, description: 'A — pozycja pierwsza' },
            { ...item, description: 'A — pozycja druga' },
          ],
        },
        {
          name: 'Sekcja B',
          displayOrder: 0,
          items: [{ ...item, description: 'B — pozycja jedyna' }],
        },
      ],
    })
  })

  afterAll(async () => {
    if (investmentId) await deleteTestInvestment(payload, investmentId)
  })

  it('restores a tied tree without throwing, every item under its own section', async () => {
    const parentage = async () => {
      const tree = await serializeKosztorys(investmentId)
      const sectionName = new Map(tree.sections.map((section) => [section.id, section.name]))
      return Object.fromEntries(
        tree.items.map((item) => [item.description, sectionName.get(item.sectionId)]),
      )
    }

    const before = await serializeKosztorys(investmentId)
    const parentageBefore = await parentage()

    await withPayloadTransaction(
      payload,
      (req) => restoreKosztorys(payload, req, investmentId, before),
      { skipRevalidation: true },
    )

    const after = await serializeKosztorys(investmentId)
    expect(after.sections).toHaveLength(2)
    expect(after.items).toHaveLength(3)
    expect(await parentage()).toEqual(parentageBefore)
  })
})
