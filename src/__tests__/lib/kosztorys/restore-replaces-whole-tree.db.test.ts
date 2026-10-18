import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import type { Payload } from 'payload'
import { serializeKosztorys } from '@/lib/kosztorys/serialize-kosztorys'
import { restoreKosztorys } from '@/lib/kosztorys/restore-kosztorys'
import { withPayloadTransaction } from '@/lib/db/with-payload-transaction'
import { createTestInvestment, deleteTestInvestment } from '@/__tests__/helpers/investment'
import { createKosztorysTree } from '@/__tests__/helpers/kosztorys-db-tree'
import { ENV_READY, bootTestPayload } from '@/__tests__/helpers/payload'

vi.mock('@/lib/auth/get-current-user-jwt', () => import('@/__tests__/stubs/get-current-user-jwt'))

describe.skipIf(!ENV_READY)('restore replaces the whole tree (DB)', () => {
  let payload: Payload
  let targetId: number
  let sourceId: number

  beforeAll(async () => {
    payload = await bootTestPayload()

    targetId = await createTestInvestment(payload, 'restore-replaces-target-test', {
      vatRate: 0.23,
    })
    sourceId = await createTestInvestment(payload, 'restore-replaces-source-test', {
      vatRate: 0.23,
    })

    const item = { unit: 'm2', plannedQty: 1, clientPrice: 100 }
    // Nothing here is named in the incoming tree, and the etapy deliberately open at ordinal 1 — the
    // same ordinal the source's own etap carries.
    await createKosztorysTree(payload, targetId, {
      sections: [
        {
          name: 'Stara sekcja A',
          items: [
            { ...item, description: 'stara pozycja pierwsza' },
            { ...item, description: 'stara pozycja druga' },
          ],
        },
        { name: 'Stara sekcja B', items: [{ ...item, description: 'stara pozycja trzecia' }] },
      ],
      stages: [
        { ordinal: 1, label: 'Stary etap 1' },
        { ordinal: 2, label: 'Stary etap 2' },
      ],
    })

    await createKosztorysTree(payload, sourceId, {
      sections: [{ name: 'Nowa sekcja', items: [{ ...item, description: 'nowa pozycja' }] }],
      stages: [{ ordinal: 1, label: 'Nowy etap 1' }],
    })
  })

  afterAll(async () => {
    if (targetId) await deleteTestInvestment(payload, targetId)
    if (sourceId) await deleteTestInvestment(payload, sourceId)
  })

  it('leaves only the incoming tree, including where an etap ordinal collides', async () => {
    const incoming = await serializeKosztorys(sourceId)
    // A restore writes each pozycja's `ref` back, and `ref` is unique across investments: the real
    // path restores a snapshot whose rows no longer exist. Leaving the source alive would collide on
    // its own refs, so it goes before the restore, as the snapshot's original does.
    await deleteTestInvestment(payload, sourceId)
    sourceId = 0

    await withPayloadTransaction(
      payload,
      (req) => restoreKosztorys(payload, req, targetId, incoming),
      { skipRevalidation: true },
    )

    const after = await serializeKosztorys(targetId)
    expect(after.sections.map((section) => section.name)).toEqual(['Nowa sekcja'])
    expect(after.items.map((item) => item.description)).toEqual(['nowa pozycja'])
    expect(after.stages.map((stage) => stage.ordinal)).toEqual([1])
    expect(after.stages.map((stage) => stage.label)).toEqual(['Nowy etap 1'])
  })
})
