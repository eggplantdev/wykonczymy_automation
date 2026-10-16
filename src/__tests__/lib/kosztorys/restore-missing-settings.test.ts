import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import type { Payload } from 'payload'
import { withPayloadTransaction } from '@/lib/db/with-payload-transaction'
import { serializeKosztorys } from '@/lib/kosztorys/serialize-kosztorys'
import { restoreKosztorys } from '@/lib/kosztorys/restore-kosztorys'
import { createTestInvestment, deleteTestInvestment } from '@/__tests__/helpers/investment'
import { createKosztorysTree } from '@/__tests__/helpers/kosztorys-db-tree'

vi.mock('@/lib/auth/require-auth', () => ({
  requireAuth: vi.fn(async () => ({ success: true, user: { id: 1, role: 'OWNER' } })),
}))

const ENV_READY = Boolean(process.env.DB_POSTGRES_URL && process.env.PAYLOAD_SECRET)

describe.skipIf(!ENV_READY)('restore of a payload with no settings (DB)', () => {
  let payload: Payload
  let investmentId: number

  beforeAll(async () => {
    const { getPayload } = await import('payload')
    const config = (await import('@payload-config')).default
    payload = await getPayload({ config })

    investmentId = await createTestInvestment(payload, 'restore-missing-settings-test', {
      vatRate: 0.23,
      wToolsCoeff: 0.7,
      ownToolsCoeff: 0.5,
    })
    await createKosztorysTree(payload, investmentId, {
      sections: [
        {
          name: 'Sekcja A',
          items: [{ description: 'Malowanie', unit: 'm2', plannedQty: 10, clientPrice: 100 }],
        },
      ],
      stages: [{ label: 'Etap 1' }],
      progress: [{ item: 0, stage: 0, qtyDone: 4 }],
    })
  })

  afterAll(async () => {
    if (investmentId) await deleteTestInvestment(payload, investmentId)
  })

  it('restores the tree and keeps the live coefficients', async () => {
    const captured = await serializeKosztorys(investmentId)
    // The key is DELETED, not set to undefined: that is what a jsonb row written by older code holds.
    const { settings: _settings, ...withoutSettings } = captured

    await withPayloadTransaction(
      payload,
      (req) => restoreKosztorys(payload, req, investmentId, withoutSettings),
      { skipRevalidation: true },
    )

    const after = await serializeKosztorys(investmentId)
    expect(after.sections.map((s) => s.name)).toEqual(captured.sections.map((s) => s.name))
    expect(after.items.map((i) => i.description)).toEqual(captured.items.map((i) => i.description))
    expect(after.settings).toEqual(captured.settings)
  })
})
