import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import type { Payload } from 'payload'
import { withPayloadTransaction } from '@/lib/db/with-payload-transaction'
import { serializeKosztorys } from '@/lib/kosztorys/serialize-kosztorys'
import { restoreKosztorys } from '@/lib/kosztorys/restore-kosztorys'
import { createTestInvestment, deleteTestInvestment } from '@/__tests__/helpers/investment'
import { createKosztorysTree } from '@/__tests__/helpers/kosztorys-db-tree'

// restore rests on `getDb` finding the transaction-scoped Drizzle handle inside Payload internals
// (`adapter.sessions[txId].db`). When that shape changes on a Payload upgrade, getDb does not throw:
// it SILENTLY falls back to the non-transactional handle, restore stops being atomic, and a throw
// mid-reinsert leaves the tree half-wiped with nothing to say so.
vi.mock('@/lib/auth/require-auth', () => ({
  requireAuth: vi.fn(async () => ({ success: true, user: { id: 1, role: 'OWNER' } })),
}))

const ENV_READY = Boolean(process.env.DB_POSTGRES_URL && process.env.PAYLOAD_SECRET)

describe.skipIf(!ENV_READY)('restore rollback on error (DB)', () => {
  let payload: Payload
  let investmentId: number

  beforeAll(async () => {
    const { getPayload } = await import('payload')
    const config = (await import('@payload-config')).default
    payload = await getPayload({ config })

    investmentId = await createTestInvestment(payload, 'restore-rollback-test', {
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
      stages: [{ label: 'Etap 1' }, { label: 'Etap 2' }],
      progress: [{ item: 0, stage: 0, qtyDone: 4 }],
    })
  })

  afterAll(async () => {
    if (investmentId) {
      await deleteTestInvestment(payload, investmentId)
    }
  })

  it('leaves the live tree untouched when the reinsert throws after the wipe', async () => {
    const before = await serializeKosztorys(investmentId)
    expect(before.sections.length).toBeGreaterThan(0)
    expect(before.items.length).toBeGreaterThan(0)

    const poisoned = {
      ...before,
      stages: before.stages.map((stage) => ({ ...stage, ordinal: before.stages[0].ordinal })),
    }

    let caught: unknown
    try {
      await withPayloadTransaction(
        payload,
        (req) => restoreKosztorys(payload, req, investmentId, poisoned),
        { skipRevalidation: true },
      )
    } catch (err) {
      caught = err
    }

    // Assert WHERE it threw, not just that it did: the danger window is after the wipe and after
    // sections+items are reinserted, so a new guard that starts throwing earlier would leave a bare
    // `threw === true` green while this spec silently stopped testing atomicity.
    // Drizzle wraps the driver error, so the pg fields live on `cause`.
    const pgError = (caught as { cause?: { code?: string; constraint?: string } } | undefined)
      ?.cause
    expect(pgError?.code).toBe('23505')
    expect(pgError?.constraint).toBe('kosztorys_stages_investment_ordinal_unique')

    // Identity INCLUDING ids: content equality alone would also pass if the wipe had committed and
    // the tree been rebuilt from the snapshot. Same ids prove the delete itself rolled back.
    const after = await serializeKosztorys(investmentId)
    expect(after).toEqual(before)
  })
})
